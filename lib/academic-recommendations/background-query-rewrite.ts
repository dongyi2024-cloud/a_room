import "server-only";

import { generateDeepSeekChatCompletion } from "@/lib/ai/deepseek";
import type {
  AcademicRecommendationRequest,
  BackgroundQueryEntityType,
  BackgroundQueryRewriteResult
} from "@/types/academic-recommendations";

const MAX_REWRITE_TERMS = 5;
const MAX_REWRITE_TERM_LENGTH = 48;
const DEFAULT_REWRITE_TIMEOUT_MS = 1800;

export type BackgroundRewriteGenerator = (params: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}) => Promise<string | { answer?: string }>;

const SUPPORTED_ENTITY_TYPES = new Set<BackgroundQueryEntityType>([
  "person",
  "literary_character",
  "place",
  "organization",
  "historical_event",
  "concept",
  "unknown"
]);

const KNOWN_BACKGROUND_ALIASES: Record<string, string[]> = {
  苔丝狄蒙娜: ["苔丝狄蒙娜", "黛丝德蒙娜", "Desdemona", "奥赛罗 Desdemona"],
  黛丝德蒙娜: ["黛丝德蒙娜", "苔丝狄蒙娜", "Desdemona", "奥赛罗 Desdemona"],
  克吕泰涅斯特拉: ["克吕泰涅斯特拉", "克莱泰姆涅斯特拉", "Clytemnestra", "希腊悲剧 Clytemnestra"]
};

function compactText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function stripMarkdownCodeFence(text: string) {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function extractJsonObject(text: string) {
  const trimmed = stripMarkdownCodeFence(text);
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace <= firstBrace) {
    return trimmed;
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function isUnsafeRewriteTerm(value: string) {
  return (
    /https?:\/\//i.test(value) ||
    /\bwww\./i.test(value) ||
    /\bdoi\b|doi\.org/i.test(value) ||
    /semanticscholar|worldcat|cnki|知网|万方|维普|维基百科|百度百科|wikipedia/i.test(value) ||
    /论文|期刊|引用|citation|reference|source|url|作者|学者|认为|指出|paper title/i.test(value)
  );
}

export function sanitizeBackgroundRewriteTerms(values: unknown, maxTerms = MAX_REWRITE_TERMS) {
  const rawTerms = Array.isArray(values) ? values : [];
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const value of rawTerms) {
    const term = compactText(value, MAX_REWRITE_TERM_LENGTH + 20)
      .replace(/^["'“”‘’《「『]+|["'“”‘’》」』]+$/g, "")
      .replace(/[。！？!?；;，,：:]+$/g, "")
      .trim();
    const key = term.toLowerCase();

    if (
      !term ||
      term.length < 2 ||
      term.length > MAX_REWRITE_TERM_LENGTH ||
      seen.has(key) ||
      isUnsafeRewriteTerm(term)
    ) {
      continue;
    }

    seen.add(key);
    terms.push(term);

    if (terms.length >= maxTerms) {
      break;
    }
  }

  return terms;
}

function getSafeEntityType(value: unknown): BackgroundQueryEntityType | undefined {
  return typeof value === "string" && SUPPORTED_ENTITY_TYPES.has(value as BackgroundQueryEntityType)
    ? (value as BackgroundQueryEntityType)
    : undefined;
}

export function buildDeterministicBackgroundRewriteTerms(request: AcademicRecommendationRequest) {
  const selectedText = compactText(request.selectedText, 80);
  const questionWithoutPrompt = compactText(request.question, 120)
    .replace(/(是什么|是啥|啥是|是谁|什么意思|什么背景|有何背景|有什么背景|呢|吗|\?|？)/g, " ")
    .trim();
  const knownAliases = KNOWN_BACKGROUND_ALIASES[selectedText] ?? [];

  return sanitizeBackgroundRewriteTerms([selectedText, questionWithoutPrompt, ...knownAliases]);
}

function buildRewritePrompt(request: AcademicRecommendationRequest) {
  const systemPrompt = [
    "You rewrite a selected-text reader question into short encyclopedia/background search terms only.",
    "Return strict JSON only.",
    "Do not answer the question.",
    "Do not create citations, URLs, scholar names, paper titles, source metadata, claims, or final prose.",
    "Only produce terms that are safe to pass to Wikipedia-like background providers."
  ].join("\n");
  const userPrompt = [
    'Return JSON shape: {"searchTerms":["term"],"entityType":"person|literary_character|place|organization|historical_event|concept|unknown"}.',
    "Keep at most 5 search terms. Prefer names, alternate translations, original-language names, and work+name combinations.",
    `Book: ${request.bookTitle}`,
    `Chapter: ${request.chapterTitle || "Untitled chapter"}`,
    `Selected text: ${request.selectedText}`,
    `Current paragraph: ${compactText(request.paragraphText, 500)}`,
    `User question: ${request.question}`
  ].join("\n\n");

  return { systemPrompt, userPrompt };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
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

function parseRewritePayload(payload: string): Omit<BackgroundQueryRewriteResult, "fallbackUsed"> {
  const parsed = JSON.parse(extractJsonObject(payload)) as {
    searchTerms?: unknown;
    entityType?: unknown;
  };

  return {
    searchTerms: sanitizeBackgroundRewriteTerms(parsed.searchTerms),
    entityType: getSafeEntityType(parsed.entityType)
  };
}

export async function rewriteBackgroundSearchTerms(
  request: AcademicRecommendationRequest,
  options: {
    generator?: BackgroundRewriteGenerator;
    timeoutMs?: number;
  } = {}
): Promise<BackgroundQueryRewriteResult> {
  const fallbackTerms = buildDeterministicBackgroundRewriteTerms(request);
  const timeoutMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_REWRITE_TIMEOUT_MS;
  const generator =
    options.generator ??
    (async (params) => generateDeepSeekChatCompletion(params));
  const { systemPrompt, userPrompt } = buildRewritePrompt(request);

  try {
    const rawResult = await withTimeout(
      generator({
        systemPrompt,
        userPrompt,
        maxTokens: 180,
        temperature: 0,
        timeoutMs
      }),
      timeoutMs
    );
    const rawText = typeof rawResult === "string" ? rawResult : rawResult?.answer ?? "";

    if (!rawText) {
      return {
        searchTerms: fallbackTerms,
        fallbackUsed: true
      };
    }

    const parsed = parseRewritePayload(rawText);

    if (parsed.searchTerms.length === 0) {
      return {
        searchTerms: fallbackTerms,
        entityType: parsed.entityType,
        fallbackUsed: true
      };
    }

    return {
      ...parsed,
      fallbackUsed: false
    };
  } catch {
    return {
      searchTerms: fallbackTerms,
      fallbackUsed: true
    };
  }
}
