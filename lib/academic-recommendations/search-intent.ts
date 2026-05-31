import type { SelectionAiRequest } from "@/types/ai";

export type SearchIntentMode = "none" | "background_lead" | "bibliography" | "academic_evidence";

export type SearchIntentDecision = {
  mode: SearchIntentMode;
  reason: string;
  maxWaitMs: number;
  allowedProviders: string[];
  searchEntity?: string;
};

const NO_EXTERNAL_SEARCH_WAIT_MS = 0;
const BACKGROUND_LEAD_WAIT_MS = Number.parseInt(process.env.FAST_BACKGROUND_LEAD_TIMEOUT_MS?.trim() || "3500", 10);
const BIBLIOGRAPHY_WAIT_MS = Number.parseInt(process.env.SELECTION_BIBLIOGRAPHY_TIMEOUT_MS?.trim() || "4500", 10);
const ACADEMIC_EVIDENCE_WAIT_MS = Number.parseInt(
  process.env.SELECTION_ACADEMIC_RECOMMENDATION_TIMEOUT_MS?.trim() || "8000",
  10
);

const BACKGROUND_PROVIDERS = ["wikipedia", "baidu_baike"];
const BIBLIOGRAPHY_PROVIDERS = ["worldcat", "national_library", "library_reference", "taiwan_new_books", "publisher_or_journal"];
const ACADEMIC_EVIDENCE_PROVIDERS = [
  "semantic_scholar",
  "doaj",
  "nssd",
  "ncpssd",
  "licensed_chinese_academic",
  "worldcat",
  "wikipedia",
  "baidu_baike",
  "university_repository",
  "publisher_or_journal"
];

const ACADEMIC_EVIDENCE_PATTERNS = [
  /权威/,
  /学者/,
  /学界/,
  /学术/,
  /论文/,
  /研究/,
  /数据支撑/,
  /证据支撑/,
  /来源/,
  /出处/,
  /文献/,
  /引用/,
  /paper/i,
  /scholar/i,
  /academic/i,
  /research/i,
  /source/i,
  /evidence/i,
  /citation/i,
  /authoritative/i
];

const BIBLIOGRAPHY_PATTERNS = [
  /书目/,
  /馆藏/,
  /isbn/i,
  /cip/i,
  /版本/,
  /版次/,
  /出版/,
  /出版社/,
  /出版方/,
  /目录/,
  /catalog/i,
  /bibliograph/i,
  /edition/i,
  /publisher/i,
  /worldcat/i,
  /library record/i
];

const BACKGROUND_QUESTION_PATTERNS = [
  /是什么/,
  /是啥/,
  /啥是/,
  /是谁/,
  /什么意思/,
  /什么背景/,
  /有何背景/,
  /有什么背景/,
  /出自哪里/,
  /来自哪里/,
  /what is/i,
  /who is/i,
  /what does.+mean/i,
  /meaning/i,
  /background/i
];

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function positiveTimeout(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function looksLikeSearchEntity(value: string) {
  const normalized = normalizeText(value);

  if (normalized.length < 2 || normalized.length > 80) {
    return false;
  }

  if (/^[\p{Script=Han}·•]{2,24}$/u.test(normalized)) {
    return true;
  }

  if (/^[《「『].+[》」』]$/.test(normalized)) {
    return true;
  }

  return /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4}\b/.test(normalized);
}

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function cleanExtractedEntity(value: string) {
  return normalizeText(value)
    .replace(/^(请问|请你|帮我|能不能|可以|解释一下|介绍一下|说说|讲讲|我想知道)/, "")
    .replace(/^(这句话里|这句话|这句里|这句|这段话里|这段话|这段里的|这段|这里的|文中的|这个|那个|那|这)/, "")
    .replace(/[“”"':：，,。；;！!？?]+$/g, "")
    .replace(/^(《|「|『|“|"|')|(?:》|」|』|”|"|')$/g, "")
    .trim();
}

function isGenericExtractedEntity(value: string) {
  return /^(话|句话|句|段|文本|原文|意思|背景|这里|文中|这个|那个)$/i.test(value);
}

export function extractBackgroundEntityFromQuestion(question: string) {
  const normalized = normalizeText(question);
  const forwardPatterns = [
    /^(.{1,48}?)(?:是什么|是啥|是谁|什么意思|什么背景|有何背景|有什么背景|出自哪里|来自哪里)(?:[？?。!！\s]*)$/i,
    /^(?:what is|who is)\s+(.{1,48}?)(?:[？?。!！\s]*)$/i,
    /^what does\s+(.{1,48}?)\s+mean(?:[？?。!！\s]*)$/i
  ];
  const reversePatterns = [
    /^(?:什么是|啥是)(.{1,48}?)(?:[？?。!！\s]*)$/i,
    /^(?:.+?里的|.+?中的)(.{1,48}?)(?:是什么|是谁|什么意思)(?:[？?。!！\s]*)$/i
  ];

  for (const pattern of [...forwardPatterns, ...reversePatterns]) {
    const match = normalized.match(pattern);
    const entity = cleanExtractedEntity(match?.[1] ?? "");

    if (entity && !isGenericExtractedEntity(entity) && looksLikeSearchEntity(entity)) {
      return entity;
    }
  }

  return "";
}

export function classifySelectionSearchIntent(request: SelectionAiRequest): SearchIntentDecision {
  const question = normalizeText(request.question);
  const selectedText = normalizeText(request.selectedText);
  const haystack = normalizeText([question, selectedText, request.paragraphText, request.bookTitle].join(" "));
  const questionEntity = extractBackgroundEntityFromQuestion(question);

  if (matchesAny(question, ACADEMIC_EVIDENCE_PATTERNS)) {
    return {
      mode: "academic_evidence",
      reason: "explicit_academic_or_source_backed_request",
      maxWaitMs: positiveTimeout(ACADEMIC_EVIDENCE_WAIT_MS, 8000),
      allowedProviders: ACADEMIC_EVIDENCE_PROVIDERS
    };
  }

  if (matchesAny(question, BIBLIOGRAPHY_PATTERNS)) {
    return {
      mode: "bibliography",
      reason: "explicit_bibliography_or_publication_request",
      maxWaitMs: positiveTimeout(BIBLIOGRAPHY_WAIT_MS, 4500),
      allowedProviders: BIBLIOGRAPHY_PROVIDERS
    };
  }

  if (matchesAny(question, BACKGROUND_QUESTION_PATTERNS) && looksLikeSearchEntity(selectedText)) {
    return {
      mode: "background_lead",
      reason: "short_named_entity_background_question",
      maxWaitMs: positiveTimeout(BACKGROUND_LEAD_WAIT_MS, 3500),
      allowedProviders: BACKGROUND_PROVIDERS,
      searchEntity: selectedText
    };
  }

  if (matchesAny(question, BACKGROUND_QUESTION_PATTERNS) && questionEntity) {
    return {
      mode: "background_lead",
      reason: "question_entity_background_question",
      maxWaitMs: positiveTimeout(BACKGROUND_LEAD_WAIT_MS, 3500),
      allowedProviders: BACKGROUND_PROVIDERS,
      searchEntity: questionEntity
    };
  }

  return {
    mode: "none",
    reason: matchesAny(haystack, BACKGROUND_QUESTION_PATTERNS)
      ? "background_phrase_without_searchable_selected_entity"
      : "no_clear_external_search_intent",
    maxWaitMs: NO_EXTERNAL_SEARCH_WAIT_MS,
    allowedProviders: []
  };
}

export function shouldAttemptExternalSearch(decision: SearchIntentDecision) {
  return decision.mode !== "none";
}

export function shouldAttemptAcademicEvidence(decision: SearchIntentDecision) {
  return decision.mode === "academic_evidence";
}
