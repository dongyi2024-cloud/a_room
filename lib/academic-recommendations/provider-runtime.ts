import "server-only";

import { shouldUseInternetArchiveForQuery } from "@/lib/academic-recommendations/source-policy";
import type {
  AcademicEvidenceType,
  AcademicProviderQuery,
  AcademicProviderQueryLanguage,
  AcademicProviderSearchOptions,
  AcademicRetrievalQuery,
  AcademicSearchIntentType,
  AcademicSearchProvider,
  AcademicSourceCandidate,
  TrustedAcademicProvider
} from "@/types/academic-recommendations";

const DEFAULT_PROVIDER_TIMEOUT_MS = 5000;
const DEFAULT_PROVIDER_MAX_RESULTS = 5;

type FetchLike = typeof fetch;

type ProviderEnv = Record<string, string | undefined>;

function compactText(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function compactKeywords(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = compactText(value, 80);

    if (!normalized || seen.has(normalized.toLowerCase())) {
      continue;
    }

    seen.add(normalized.toLowerCase());
    result.push(normalized);
  }

  return result.slice(0, 12);
}

function getEnvBoolean(env: ProviderEnv, key: string, defaultValue: boolean) {
  const value = env[key]?.trim().toLowerCase();

  if (!value) {
    return defaultValue;
  }

  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function getConfiguredTimeoutMs(env: ProviderEnv) {
  const parsed = Number.parseInt(env.ACADEMIC_PROVIDER_TIMEOUT_MS?.trim() || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PROVIDER_TIMEOUT_MS;
}

function detectQueryLanguage(text: string): AcademicProviderQueryLanguage {
  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  const hasEnglish = /[a-z]/i.test(text);

  if (hasChinese && hasEnglish) {
    return "mixed";
  }

  if (hasChinese) {
    return "zh";
  }

  if (hasEnglish) {
    return "en";
  }

  return "unknown";
}

function inferIntentType(text: string): AcademicSearchIntentType {
  if (/是什么|是谁|what is|who is/i.test(text)) {
    return "named_entity_background";
  }

  if (/十字军东征|战争|革命|历史|中世纪|crusade|war|revolution|medieval|historical/i.test(text)) {
    return "historical_event_context";
  }

  if (/作者|传记|生平|author|biograph/i.test(text)) {
    return "author_context";
  }

  if (/相关研究|学者观点|论文|权威来源|书目|馆藏|isbn|bibliograph|scholar|paper|academic|research/i.test(text)) {
    return "book_research";
  }

  if (/理论|叙事|女性主义|现代主义|literary|theory|feminis|modernis|narrative/i.test(text)) {
    return "literary_theory";
  }

  if (/文化|语境|context|culture|cultural/i.test(text)) {
    return "cultural_context";
  }

  return "unknown";
}

function extractKeywords(text: string) {
  const normalized = compactText(text, 600);
  const chineseTerms = normalized.match(/[\u4e00-\u9fff]{2,12}/g) ?? [];
  const englishTerms = normalized.match(/[a-z][a-z'\-]{2,}(?:\s+[a-z][a-z'\-]{2,}){0,3}/gi) ?? [];
  return compactKeywords([...chineseTerms, ...englishTerms, normalized]);
}

function cleanHtmlSnippet(value: unknown) {
  return compactText(value, 900).replace(/<\/?[^>]+>/g, "");
}

function isGenericWikipediaSearchTerm(value: string) {
  const normalized = value.trim();
  return (
    /^(专名|背景|语境|历史|文化|文学|学术|相关研究|学者观点|论文|background|context|research|academic)$/i.test(
      normalized
    ) || /专名|背景语境|学术主题/.test(normalized)
  );
}

function normalizeWikipediaSearchTerm(value: string) {
  return compactText(value, 80)
    .replace(/^(请问|介绍一下|详细介绍|解释一下)/, "")
    .replace(/(是什么|是谁|什么意思|有何背景|有什么背景|什么背景|呢|吗|？|\?)$/g, "")
    .trim();
}

function buildWikipediaSearchTerms(query: AcademicProviderQuery) {
  const shortKeywords = query.keywords
    .map(normalizeWikipediaSearchTerm)
    .filter((keyword) => keyword.length >= 2 && keyword.length <= 48 && !isGenericWikipediaSearchTerm(keyword));
  const directTerms = extractKeywords([query.selectedText, query.originalQuery].filter(Boolean).join(" "))
    .map(normalizeWikipediaSearchTerm)
    .filter((keyword) => keyword.length >= 2 && keyword.length <= 48 && !isGenericWikipediaSearchTerm(keyword));
  const preferredChinese = shortKeywords.filter((keyword) => /[\u4e00-\u9fff]/.test(keyword));
  const preferredEnglish = shortKeywords.filter((keyword) => !/[\u4e00-\u9fff]/.test(keyword));

  return compactKeywords([
    ...preferredChinese,
    ...preferredEnglish,
    ...directTerms,
    query.originalQuery,
    query.normalizedQuery
  ]).slice(0, 3);
}

function isEnabled(env: ProviderEnv, key: string, defaultValue = false) {
  return getEnvBoolean(env, key, defaultValue);
}

function debugProviderFailure(providerId: string, message: string) {
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[academic-provider:${providerId}] ${message}`);
  }
}

export function normalizeAcademicProviderQuery(input: {
  query?: string;
  originalQuery?: string;
  keywords?: string[];
  intentType?: AcademicSearchIntentType;
  bookTitle?: string;
  chapterTitle?: string;
  selectedText?: string | null;
  contextExcerpt?: string | null;
  retrievalQuery?: AcademicRetrievalQuery;
}): AcademicProviderQuery {
  const originalQuery = compactText(
    input.originalQuery || input.retrievalQuery?.originalQuery || input.query || input.retrievalQuery?.query || "",
    160
  );
  const contextText = compactText(
    [
      originalQuery,
      input.bookTitle,
      input.chapterTitle,
      input.selectedText ?? input.retrievalQuery?.selectedText,
      input.contextExcerpt ?? input.retrievalQuery?.contextExcerpt,
      input.retrievalQuery?.themes?.join(" ")
    ]
      .filter(Boolean)
      .join(" "),
    800
  );
  const normalizedQuery = compactText(contextText || originalQuery, 240);
  const keywords = compactKeywords([
    ...(input.keywords ?? []),
    ...(input.retrievalQuery?.keywords ?? []),
    ...(input.retrievalQuery?.themes ?? []),
    ...extractKeywords(normalizedQuery)
  ]);

  return {
    originalQuery,
    normalizedQuery,
    keywords,
    language: detectQueryLanguage(normalizedQuery),
    intentType: input.intentType ?? input.retrievalQuery?.intentType ?? inferIntentType(normalizedQuery),
    bookTitle: compactText(input.bookTitle, 120) || undefined,
    chapterTitle: compactText(input.chapterTitle, 120) || undefined,
    selectedText: compactText(input.selectedText ?? input.retrievalQuery?.selectedText, 120) || undefined,
    contextExcerpt: compactText(input.contextExcerpt ?? input.retrievalQuery?.contextExcerpt, 240) || undefined
  };
}

function candidate(
  provider: TrustedAcademicProvider,
  evidenceType: AcademicEvidenceType,
  params: Omit<AcademicSourceCandidate, "provider" | "evidenceType">
): AcademicSourceCandidate {
  return {
    provider,
    evidenceType,
    ...params
  };
}

async function fetchJson(url: string, timeoutMs: number, fetchFn: FetchLike) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
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

export class WikipediaEncyclopediaProvider implements AcademicSearchProvider {
  id = "wikipedia";
  displayName = "Wikipedia";
  supportedLanguages: Array<"zh" | "en"> = ["zh", "en"];
  supportedEvidenceTypes: AcademicEvidenceType[] = ["encyclopedia_lead"];

  constructor(
    private readonly config: {
      enabled?: boolean;
      fetchFn?: FetchLike;
    } = {}
  ) {}

  async search(query: AcademicProviderQuery, options: AcademicProviderSearchOptions = {}) {
    if (this.config.enabled === false || options.allowNetwork === false) {
      return [];
    }

    const language = query.language === "en" ? "en" : "zh";
    const host = language === "en" ? "en.wikipedia.org" : "zh.wikipedia.org";
    let results: unknown[] = [];
    const terms = buildWikipediaSearchTerms(query);

    if (process.env.NODE_ENV !== "production") {
      console.info("[academic-provider:wikipedia] search terms", {
        terms,
        intentType: query.intentType,
        language: query.language
      });
    }

    for (const term of terms) {
      const url = new URL(`https://${host}/w/api.php`);
      url.searchParams.set("action", "query");
      url.searchParams.set("list", "search");
      url.searchParams.set("format", "json");
      url.searchParams.set("origin", "*");
      url.searchParams.set("srlimit", String(options.maxResults ?? DEFAULT_PROVIDER_MAX_RESULTS));
      url.searchParams.set("srsearch", term);

      const payload = await fetchJson(
        url.toString(),
        options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
        this.config.fetchFn ?? fetch
      );
      const searchResults =
        payload && typeof payload === "object" ? (payload as { query?: { search?: unknown } }).query?.search : null;

      if (Array.isArray(searchResults) && searchResults.length > 0) {
        if (process.env.NODE_ENV !== "production") {
          console.info("[academic-provider:wikipedia] results", {
            term,
            count: searchResults.length
          });
        }
        results = searchResults;
        break;
      }
    }

    if (results.length === 0) {
      if (process.env.NODE_ENV !== "production") {
        console.info("[academic-provider:wikipedia] no results", {
          terms
        });
      }
      return [];
    }

    return results
      .map((entry) => {
        const record = entry as Record<string, unknown>;
        const title = compactText(record.title, 240);

        if (!title) {
          return null;
        }

        return candidate("wikipedia", "encyclopedia_lead", {
          title,
          sourceName: "Wikipedia",
          url: `https://${host}/wiki/${encodeURIComponent(title).replace(/%20/g, "_")}`,
          authors: [],
          abstractOrSnippet: cleanHtmlSnippet(record.snippet),
          year: null,
          publicationYear: null,
          keywords: query.keywords,
          language,
          confidence: "medium",
          canUseAsAcademicEvidence: false,
          canUseAsBackgroundLead: true,
          canUseAsBibliography: false,
          externalId: compactText(record.pageid, 80) || `wikipedia:${language}:${title}`
        });
      })
      .filter(Boolean)
      .slice(0, options.maxResults ?? DEFAULT_PROVIDER_MAX_RESULTS) as AcademicSourceCandidate[];
  }
}

export class WorldCatBibliographyProvider implements AcademicSearchProvider {
  id = "worldcat";
  displayName = "WorldCat";
  supportedLanguages: Array<"zh" | "en"> = ["zh", "en"];
  supportedEvidenceTypes: AcademicEvidenceType[] = ["bibliography_record", "academic_book"];

  constructor(
    private readonly config: {
      env?: ProviderEnv;
      fetchFn?: FetchLike;
    } = {}
  ) {}

  private get env() {
    return this.config.env ?? process.env;
  }

  private get accessToken() {
    return this.env.WORLDCAT_ACCESS_TOKEN?.trim() || "";
  }

  private hasCredentials() {
    return Boolean(
      this.accessToken ||
        (this.env.WORLDCAT_CLIENT_ID?.trim() && this.env.WORLDCAT_CLIENT_SECRET?.trim())
    );
  }

  async search(query: AcademicProviderQuery, options: AcademicProviderSearchOptions = {}) {
    if (!this.hasCredentials()) {
      debugProviderFailure(this.id, "WorldCat credentials are not configured; returning empty results.");
      return [];
    }

    if (options.allowNetwork === false) {
      return [];
    }

    const baseUrl = this.env.WORLDCAT_API_BASE_URL?.trim() || "https://americas.discovery.api.oclc.org/worldcat/search/v2/bibs";
    const url = new URL(baseUrl);
    url.searchParams.set("q", query.normalizedQuery || query.originalQuery);
    url.searchParams.set("limit", String(options.maxResults ?? DEFAULT_PROVIDER_MAX_RESULTS));

    const timeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await (this.config.fetchFn ?? fetch)(url.toString(), {
        headers: {
          Accept: "application/json",
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {})
        },
        signal: controller.signal
      });

      if (!response.ok) {
        return [];
      }

      const payload = (await response.json()) as unknown;
      const records = extractWorldCatRecords(payload);

      return records
        .map((record) => normalizeWorldCatRecord(record, query))
        .filter((item): item is AcademicSourceCandidate => Boolean(item))
        .slice(0, options.maxResults ?? DEFAULT_PROVIDER_MAX_RESULTS);
    } catch (error) {
      debugProviderFailure(this.id, error instanceof Error ? error.message : "WorldCat request failed.");
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractWorldCatRecords(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.bibs, record.records, record.entries, record.items, record.searchResults];
  const firstArray = candidates.find(Array.isArray);
  return (firstArray ?? []) as Array<Record<string, unknown>>;
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => compactText(typeof item === "object" ? (item as { name?: unknown }).name : item, 80)).filter(Boolean);
  }

  const compacted = compactText(value, 80);
  return compacted ? [compacted] : [];
}

function normalizeWorldCatRecord(record: Record<string, unknown>, query: AcademicProviderQuery) {
  const title = compactText(record.title ?? record.name, 240);

  if (!title) {
    return null;
  }

  const authors = normalizeStringArray(record.author ?? record.authors ?? record.creator ?? record.contributors).slice(0, 5);
  const yearRaw = record.date ?? record.publicationDate ?? record.year;
  const year = typeof yearRaw === "number" ? yearRaw : Number.parseInt(compactText(yearRaw, 20).slice(0, 4), 10) || null;
  const url = compactText(record.url ?? record.uri ?? record.oclcUrl, 300) || null;
  const materialType = compactText(record.materialType ?? record.format ?? record.documentType, 120).toLowerCase();
  const abstract = compactText(record.summary ?? record.description ?? record.publisher ?? "WorldCat bibliography metadata.", 900);
  const isAcademicBook = /scholarly|academic|monograph|university press|学术|专著/.test(
    [materialType, abstract, title].join(" ").toLowerCase()
  );

  return candidate("worldcat", isAcademicBook ? "academic_book" : "bibliography_record", {
    title,
    sourceName: "WorldCat",
    url,
    authors,
    abstractOrSnippet: abstract,
    year,
    publicationYear: year,
    keywords: query.keywords,
    language: query.language === "zh" || query.language === "mixed" ? "zh" : query.language === "en" ? "en" : "unknown",
    confidence: "medium",
    canUseAsAcademicEvidence: false,
    canUseAsBackgroundLead: true,
    canUseAsBibliography: true,
    externalId: compactText(record.oclcNumber ?? record.identifier ?? record.id, 160) || (url ? `worldcat:${url}` : `worldcat:${title}`)
  });
}

export class NssdSocialScienceProvider implements AcademicSearchProvider {
  id = "nssd";
  displayName = "NSSD / NCPSDD";
  supportedLanguages: Array<"zh" | "en"> = ["zh"];
  supportedEvidenceTypes: AcademicEvidenceType[] = ["academic_paper", "academic_book"];

  constructor(private readonly config: { enabled?: boolean; fixtures?: AcademicSourceCandidate[] } = {}) {}

  async search(_query: AcademicProviderQuery, options: AcademicProviderSearchOptions = {}) {
    if (this.config.enabled !== true) {
      return [];
    }

    return options.useMockFallback ? (this.config.fixtures ?? []) : [];
  }
}

export class BaiduBaikeLeadProvider implements AcademicSearchProvider {
  id = "baidu_baike";
  displayName = "Baidu Baike";
  supportedLanguages: Array<"zh" | "en"> = ["zh"];
  supportedEvidenceTypes: AcademicEvidenceType[] = ["encyclopedia_lead"];

  async search() {
    return [];
  }
}

export class LicensedChineseAcademicProvider implements AcademicSearchProvider {
  id = "licensed_chinese_academic";
  displayName = "Licensed Chinese Academic Databases";
  supportedLanguages: Array<"zh" | "en"> = ["zh"];
  supportedEvidenceTypes: AcademicEvidenceType[] = ["academic_paper", "academic_book"];

  constructor(private readonly config: { enabled?: boolean } = {}) {}

  async search() {
    if (this.config.enabled === true) {
      debugProviderFailure(this.id, "Licensed provider is configured as enabled but has no authorized adapter implementation.");
    }

    return [];
  }
}

export function createDefaultAcademicSearchProviders(env: ProviderEnv = process.env): AcademicSearchProvider[] {
  return [
    new NssdSocialScienceProvider({
      enabled: isEnabled(env, "ENABLE_NSSD_PROVIDER", false)
    }),
    new LicensedChineseAcademicProvider({
      enabled: isEnabled(env, "ENABLE_LICENSED_CHINESE_ACADEMIC_PROVIDER", false)
    }),
    new WorldCatBibliographyProvider({ env }),
    new WikipediaEncyclopediaProvider({
      enabled: isEnabled(env, "ENABLE_WIKIPEDIA_PROVIDER", true)
    }),
    new BaiduBaikeLeadProvider()
  ];
}

function isChineseLike(query: AcademicProviderQuery) {
  return query.language === "zh" || query.language === "mixed";
}

function isBackgroundIntent(query: AcademicProviderQuery) {
  return query.intentType === "named_entity_background" || query.intentType === "historical_event_context";
}

function isResearchIntent(query: AcademicProviderQuery) {
  return query.intentType === "book_research" || /相关研究|学者观点|论文|权威来源|学术/.test(query.normalizedQuery);
}

export function selectAcademicProviders(
  query: AcademicProviderQuery,
  providers: AcademicSearchProvider[] = createDefaultAcademicSearchProviders(),
  allowedProviders?: string[]
): AcademicSearchProvider[] {
  const selected: AcademicSearchProvider[] = [];
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  const allowedProviderSet = allowedProviders && allowedProviders.length > 0 ? new Set(allowedProviders) : null;

  const add = (id: string) => {
    if (allowedProviderSet && !allowedProviderSet.has(id)) {
      return;
    }

    const provider = providerById.get(id);

    if (provider && !selected.some((item) => item.id === provider.id)) {
      selected.push(provider);
    }
  };

  if (isChineseLike(query)) {
    if (isResearchIntent(query)) {
      add("nssd");
      add("licensed_chinese_academic");
      add("worldcat");
      add("wikipedia");
      add("baidu_baike");
    } else if (isBackgroundIntent(query)) {
      add("wikipedia");
      add("baidu_baike");
      add("nssd");
      add("worldcat");
    } else {
      add("nssd");
      add("worldcat");
      add("wikipedia");
      add("baidu_baike");
    }
  } else {
    if (isResearchIntent(query)) {
      add("worldcat");
    }

    add("wikipedia");
  }

  return selected.filter((provider) => {
    if (allowedProviderSet && !allowedProviderSet.has(provider.id)) {
      return false;
    }

    if (provider.id === "internet_archive") {
      return shouldUseInternetArchiveForQuery(query.normalizedQuery);
    }

    return true;
  });
}

async function withProviderTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function searchAcademicProviders(
  providers: AcademicSearchProvider[],
  query: AcademicProviderQuery,
  options: AcademicProviderSearchOptions = {}
) {
  const timeoutMs = options.timeoutMs ?? getConfiguredTimeoutMs(process.env);
  const maxResults = options.maxResults ?? DEFAULT_PROVIDER_MAX_RESULTS;
  const allowedProviderSet =
    options.allowedProviders && options.allowedProviders.length > 0 ? new Set(options.allowedProviders) : null;
  const scopedProviders = allowedProviderSet ? providers.filter((provider) => allowedProviderSet.has(provider.id)) : providers;
  const results = await Promise.all(
    scopedProviders.map(async (provider) => {
      try {
        const value = await withProviderTimeout(provider.search(query, { ...options, timeoutMs, maxResults }), timeoutMs);
        return Array.isArray(value) ? value : [];
      } catch (error) {
        debugProviderFailure(provider.id, error instanceof Error ? error.message : "Provider search failed.");
        return [];
      }
    })
  );

  return results.flat().slice(0, maxResults);
}
