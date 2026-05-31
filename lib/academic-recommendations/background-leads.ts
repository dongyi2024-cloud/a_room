import "server-only";

import {
  BaiduBaikeLeadProvider,
  normalizeAcademicProviderQuery,
  searchAcademicProviders,
  WikipediaEncyclopediaProvider,
  WorldCatBibliographyProvider
} from "@/lib/academic-recommendations/provider-runtime";
import {
  rewriteBackgroundSearchTerms,
  type BackgroundRewriteGenerator
} from "@/lib/academic-recommendations/background-query-rewrite";
import { buildAcademicSourceLeads } from "@/lib/academic-recommendations/validation";
import type { AcademicRecommendationRequest, AcademicSourceLead } from "@/types/academic-recommendations";

const FAST_BACKGROUND_LEAD_TIMEOUT_MS = Number.parseInt(
  process.env.FAST_BACKGROUND_LEAD_TIMEOUT_MS?.trim() || "1500",
  10
);
const FAST_BACKGROUND_LEAD_MAX_RESULTS = 2;

type FetchLike = typeof fetch;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isBackgroundQuestion(question: string) {
  return /是什么|是啥|啥是|是谁|什么意思|什么背景|有何背景|有什么背景|what is|who is|background/i.test(question);
}

function isResearchOrAcademicQuestion(question: string) {
  return /学者|学术|论文|研究|权威|来源|出处|证据|paper|scholar|academic|research|source|evidence/i.test(question);
}

function looksLikeShortEntity(value: string) {
  const normalized = normalizeText(value);

  if (normalized.length < 2 || normalized.length > 80) {
    return false;
  }

  return /^[\p{Script=Han}·•]{2,24}$/u.test(normalized) || /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4}\b/.test(normalized);
}

export function shouldAttemptFastBackgroundLeads(request: AcademicRecommendationRequest) {
  return isBackgroundQuestion(request.question) && looksLikeShortEntity(request.selectedText);
}

function shouldAttemptFastBackgroundLeadsForEntity(request: AcademicRecommendationRequest, preferredSearchEntity?: string) {
  return (
    shouldAttemptFastBackgroundLeads(request) ||
    (isBackgroundQuestion(request.question) && Boolean(preferredSearchEntity && looksLikeShortEntity(preferredSearchEntity)))
  );
}

export function shouldUseFastBackgroundOnly(request: AcademicRecommendationRequest) {
  return shouldAttemptFastBackgroundLeads(request) && !isResearchOrAcademicQuestion(request.question);
}

function getFastBackgroundLeadTimeoutMs() {
  return Number.isFinite(FAST_BACKGROUND_LEAD_TIMEOUT_MS) && FAST_BACKGROUND_LEAD_TIMEOUT_MS > 0
    ? FAST_BACKGROUND_LEAD_TIMEOUT_MS
    : 3500;
}

export function mergeAcademicSourceLeads(primary: AcademicSourceLead[], secondary: AcademicSourceLead[], maxLeads = 5) {
  const seen = new Set<string>();
  const merged: AcademicSourceLead[] = [];

  for (const lead of [...primary, ...secondary]) {
    const key = `${lead.displayClass}:${lead.url || lead.title}`.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(lead);

    if (merged.length >= maxLeads) {
      break;
    }
  }

  return merged;
}

export async function loadFastBackgroundSourceLeads(
  request: AcademicRecommendationRequest,
  options: {
    fetchFn?: FetchLike;
    timeoutMs?: number;
    maxResults?: number;
    allowedProviders?: string[];
    preferredSearchEntity?: string;
    rewriteGenerator?: BackgroundRewriteGenerator;
    rewriteTimeoutMs?: number;
  } = {}
) {
  if (!shouldAttemptFastBackgroundLeadsForEntity(request, options.preferredSearchEntity)) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[background-query-rewrite] skipped", {
        reason: "not_background_lead_candidate"
      });
    }

    return [];
  }

  const searchBackgroundLeads = async (keywords: string[], useRewrittenTerms = false) => {
    const providerQuery = normalizeAcademicProviderQuery({
      originalQuery: useRewrittenTerms ? keywords.join(" ") : request.question,
      query: useRewrittenTerms ? keywords.join(" ") : keywords[0] || request.selectedText || request.question,
      keywords,
      intentType: "named_entity_background",
      bookTitle: request.bookTitle,
      chapterTitle: request.chapterTitle,
      selectedText: useRewrittenTerms ? undefined : request.selectedText,
      contextExcerpt: request.paragraphText
    });
    const candidates = await searchAcademicProviders(
      [
        new WikipediaEncyclopediaProvider({
          enabled: true,
          fetchFn: options.fetchFn
        }),
        new BaiduBaikeLeadProvider()
      ],
      providerQuery,
      {
        timeoutMs: options.timeoutMs ?? getFastBackgroundLeadTimeoutMs(),
        maxResults: options.maxResults ?? FAST_BACKGROUND_LEAD_MAX_RESULTS,
        allowNetwork: true,
        allowedProviders: options.allowedProviders
      }
    );

    return buildAcademicSourceLeads(candidates, options.maxResults ?? FAST_BACKGROUND_LEAD_MAX_RESULTS).filter(
      (lead) => lead.displayClass === "background_lead"
    );
  };
  const firstPassLeads = await searchBackgroundLeads(
    [options.preferredSearchEntity, request.selectedText, request.question].filter((term): term is string => Boolean(term))
  );

  if (process.env.NODE_ENV !== "production") {
    console.info("[background-query-rewrite] first pass", {
      sourceLeadCount: firstPassLeads.length
    });
  }

  if (firstPassLeads.length > 0) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[background-query-rewrite] skipped", {
        reason: "first_pass_succeeded"
      });
    }

    return firstPassLeads;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[background-query-rewrite] attempted", {
      reason: "first_pass_no_result"
    });
  }

  const rewrite = await rewriteBackgroundSearchTerms(request, {
    generator: options.rewriteGenerator,
    timeoutMs: options.rewriteTimeoutMs
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[background-query-rewrite] terms", {
      terms: rewrite.searchTerms,
      fallbackUsed: rewrite.fallbackUsed
    });
  }

  if (rewrite.searchTerms.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[background-query-rewrite] fallback results", {
        sourceLeadCount: 0
      });
    }

    return [];
  }

  const fallbackLeads = await searchBackgroundLeads(rewrite.searchTerms, true).catch(() => []);

  if (process.env.NODE_ENV !== "production") {
    console.info("[background-query-rewrite] fallback results", {
      sourceLeadCount: fallbackLeads.length
    });
  }

  return fallbackLeads;
}

export async function loadBackgroundSourceLeadsWithoutRewrite(
  request: AcademicRecommendationRequest,
  options: {
    fetchFn?: FetchLike;
    timeoutMs?: number;
    maxResults?: number;
    allowedProviders?: string[];
  } = {}
) {
  if (!shouldAttemptFastBackgroundLeads(request)) {
    return [];
  }

  const providerQuery = normalizeAcademicProviderQuery({
    originalQuery: request.question,
    query: request.selectedText || request.question,
    keywords: [request.selectedText, request.question].filter(Boolean),
    intentType: "named_entity_background",
    bookTitle: request.bookTitle,
    chapterTitle: request.chapterTitle,
    selectedText: request.selectedText,
    contextExcerpt: request.paragraphText
  });
  const candidates = await searchAcademicProviders(
    [
      new WikipediaEncyclopediaProvider({
        enabled: true,
        fetchFn: options.fetchFn
      }),
      new BaiduBaikeLeadProvider()
    ],
    providerQuery,
    {
      timeoutMs: options.timeoutMs ?? getFastBackgroundLeadTimeoutMs(),
      maxResults: options.maxResults ?? FAST_BACKGROUND_LEAD_MAX_RESULTS,
      allowNetwork: true,
      allowedProviders: options.allowedProviders
    }
  );

  return buildAcademicSourceLeads(candidates, options.maxResults ?? FAST_BACKGROUND_LEAD_MAX_RESULTS).filter(
    (lead) => lead.displayClass === "background_lead"
  );
}

export async function loadBibliographySourceLeads(
  request: AcademicRecommendationRequest,
  options: {
    fetchFn?: FetchLike;
    timeoutMs?: number;
    maxResults?: number;
    allowedProviders?: string[];
  } = {}
) {
  const providerQuery = normalizeAcademicProviderQuery({
    originalQuery: request.question,
    query: [request.selectedText, request.bookTitle, request.question].filter(Boolean).join(" "),
    keywords: [request.selectedText, request.bookTitle, request.question].filter(Boolean),
    intentType: "book_research",
    bookTitle: request.bookTitle,
    chapterTitle: request.chapterTitle,
    selectedText: request.selectedText,
    contextExcerpt: request.paragraphText
  });
  const candidates = await searchAcademicProviders(
    [
      new WorldCatBibliographyProvider({
        fetchFn: options.fetchFn
      })
    ],
    providerQuery,
    {
      timeoutMs: options.timeoutMs ?? 4500,
      maxResults: options.maxResults ?? FAST_BACKGROUND_LEAD_MAX_RESULTS,
      allowNetwork: true,
      allowedProviders: options.allowedProviders
    }
  );

  return buildAcademicSourceLeads(candidates, options.maxResults ?? FAST_BACKGROUND_LEAD_MAX_RESULTS).filter(
    (lead) => lead.displayClass === "bibliography_information" || lead.displayClass === "publication_information"
  );
}
