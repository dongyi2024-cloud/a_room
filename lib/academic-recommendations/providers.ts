import "server-only";

import type {
  AcademicRetrievalProvider,
  AcademicRetrievalQuery,
  AcademicSourceCandidate
} from "@/types/academic-recommendations";
import {
  normalizeAcademicProviderQuery,
  searchAcademicProviders,
  selectAcademicProviders
} from "@/lib/academic-recommendations/provider-runtime";
import { shouldUseInternetArchiveForQuery } from "@/lib/academic-recommendations/source-policy";

const DEFAULT_TIMEOUT_MS = 6500;
const DEFAULT_MAX_RESULTS = 8;

function compactText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function toNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchJson(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueByStableKey(candidates: AcademicSourceCandidate[], maxResults: number) {
  const seen = new Set<string>();
  const results: AcademicSourceCandidate[] = [];

  for (const candidate of candidates) {
    const key = (candidate.externalId || candidate.url || `${candidate.provider}:${candidate.title}`).toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    results.push(candidate);

    if (results.length >= maxResults) {
      break;
    }
  }

  return results;
}

async function searchSemanticScholar(query: AcademicRetrievalQuery, timeoutMs: number) {
  const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
  url.searchParams.set("query", query.query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("fields", "title,authors,venue,year,abstract,url,externalIds");

  const payload = await fetchJson(url.toString(), timeoutMs);

  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { data?: unknown }).data)) {
    return [];
  }

  return ((payload as { data: Array<Record<string, unknown>> }).data ?? []).map((entry) => {
    const authors = Array.isArray(entry.authors)
      ? entry.authors
          .map((author) => compactText((author as { name?: unknown }).name, 80))
          .filter(Boolean)
          .slice(0, 5)
      : [];
    const externalIds = entry.externalIds && typeof entry.externalIds === "object" ? entry.externalIds : {};
    const paperId =
      compactText((externalIds as { DOI?: unknown }).DOI, 120) ||
      compactText((externalIds as { CorpusId?: unknown }).CorpusId, 120) ||
      compactText(entry.url, 200);

    return {
      provider: "semantic_scholar" as const,
      title: compactText(entry.title, 240),
      sourceName: compactText(entry.venue, 160) || "Semantic Scholar",
      url: compactText(entry.url, 300) || null,
      authors,
      abstractOrSnippet: compactText(entry.abstract, 900),
      year: toNumberOrNull(entry.year),
      externalId: paperId || null
    };
  });
}

async function searchDoaj(query: AcademicRetrievalQuery, timeoutMs: number) {
  const url = new URL(`https://doaj.org/api/search/articles/${encodeURIComponent(query.query)}`);
  url.searchParams.set("pageSize", "5");

  const payload = await fetchJson(url.toString(), timeoutMs);

  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { results?: unknown }).results)) {
    return [];
  }

  return ((payload as { results: Array<Record<string, unknown>> }).results ?? []).map((entry) => {
    const bibjson = entry.bibjson && typeof entry.bibjson === "object" ? (entry.bibjson as Record<string, unknown>) : {};
    const journal = bibjson.journal && typeof bibjson.journal === "object" ? (bibjson.journal as Record<string, unknown>) : {};
    const authors = Array.isArray(bibjson.author)
      ? bibjson.author.map((author) => compactText((author as { name?: unknown }).name, 80)).filter(Boolean).slice(0, 5)
      : [];
    const links = Array.isArray(bibjson.link) ? bibjson.link : [];
    const firstLink = links.find((link) => compactText((link as { url?: unknown }).url, 300));

    return {
      provider: "doaj" as const,
      title: compactText(bibjson.title, 240),
      sourceName: compactText(journal.title, 160) || "DOAJ",
      url: compactText((firstLink as { url?: unknown } | undefined)?.url, 300) || null,
      authors,
      abstractOrSnippet: compactText(bibjson.abstract, 900),
      year: typeof bibjson.year === "string" ? Number.parseInt(bibjson.year, 10) || null : null,
      externalId: compactText(bibjson.identifier, 160) || compactText(entry.id, 160) || null
    };
  });
}

async function searchInternetArchive(query: AcademicRetrievalQuery, timeoutMs: number) {
  const url = new URL("https://archive.org/advancedsearch.php");
  url.searchParams.set("q", `(${query.query}) AND mediatype:texts`);
  url.searchParams.set("fl[]", "identifier");
  url.searchParams.append("fl[]", "title");
  url.searchParams.append("fl[]", "creator");
  url.searchParams.append("fl[]", "description");
  url.searchParams.append("fl[]", "date");
  url.searchParams.set("rows", "5");
  url.searchParams.set("output", "json");

  const payload = await fetchJson(url.toString(), timeoutMs);
  const response = payload && typeof payload === "object" ? (payload as { response?: unknown }).response : null;
  const docs = response && typeof response === "object" ? (response as { docs?: unknown }).docs : null;

  if (!Array.isArray(docs)) {
    return [];
  }

  return docs.map((entry) => {
    const record = entry as Record<string, unknown>;
    const identifier = compactText(record.identifier, 160);
    const creator = Array.isArray(record.creator)
      ? record.creator.map((item) => compactText(item, 80)).filter(Boolean)
      : compactText(record.creator, 80)
        ? [compactText(record.creator, 80)]
        : [];

    return {
      provider: "internet_archive" as const,
      title: compactText(record.title, 240),
      sourceName: "Internet Archive",
      url: identifier ? `https://archive.org/details/${encodeURIComponent(identifier)}` : null,
      authors: creator.slice(0, 5),
      abstractOrSnippet: compactText(record.description, 900),
      year: typeof record.date === "string" ? Number.parseInt(record.date.slice(0, 4), 10) || null : null,
      externalId: identifier || null
    };
  });
}

export function createTrustedAcademicProvider(): AcademicRetrievalProvider {
  return {
    async search(queries, options) {
      const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS;
      const allowedProviders = options?.allowedProviders;
      const allowedProviderSet =
        allowedProviders && allowedProviders.length > 0 ? new Set(allowedProviders) : null;
      const candidates: AcademicSourceCandidate[] = [];

      for (const query of queries.slice(0, 3)) {
        const providerQuery = normalizeAcademicProviderQuery({
          retrievalQuery: query
        });
        const selectedRuntimeProviders = selectAcademicProviders(providerQuery, undefined, allowedProviders);
        if (process.env.NODE_ENV !== "production") {
          console.info("[academic-provider:registry] selected providers", {
            query: providerQuery.originalQuery,
            intentType: providerQuery.intentType,
            language: providerQuery.language,
            providers: selectedRuntimeProviders.map((provider) => provider.id)
          });
        }
        const runtimeProviderSearch = searchAcademicProviders(selectedRuntimeProviders, providerQuery, {
          timeoutMs,
          maxResults,
          allowNetwork: true,
          allowedProviders
        });
        const primaryAcademicSearches: Array<Promise<AcademicSourceCandidate[]>> = [];

        if (!allowedProviderSet || allowedProviderSet.has("semantic_scholar")) {
          primaryAcademicSearches.push(searchSemanticScholar(query, timeoutMs));
        }

        if (!allowedProviderSet || allowedProviderSet.has("doaj")) {
          primaryAcademicSearches.push(searchDoaj(query, timeoutMs));
        }

        const trustedSearches: Array<Promise<AcademicSourceCandidate[]>> =
          providerQuery.intentType === "named_entity_background" || providerQuery.intentType === "historical_event_context"
            ? [runtimeProviderSearch, ...primaryAcademicSearches]
            : [...primaryAcademicSearches, runtimeProviderSearch];

        if ((!allowedProviderSet || allowedProviderSet.has("internet_archive")) && shouldUseInternetArchiveForQuery(query.query)) {
          trustedSearches.push(searchInternetArchive(query, timeoutMs));
        }

        const settled = await Promise.allSettled(trustedSearches);

        for (const result of settled) {
          if (result.status === "fulfilled") {
            candidates.push(...result.value);
          }
        }

        if (candidates.length >= maxResults) {
          break;
        }
      }

      return uniqueByStableKey(candidates, maxResults);
    }
  };
}
