import "server-only";

import type { AnswerLengthMode, AnswerLengthPolicy } from "@/types/ai";

const DETAILED_REQUEST_PATTERNS = [
  "详细解释",
  "详细一点",
  "详细说明",
  "展开讲讲",
  "展开说说",
  "多说一点",
  "多讲一点",
  "讲详细点",
  "说详细点",
  "说得详细一点",
  "具体一点",
  "解释得更详细",
  "explain in detail",
  "more detail",
  "more detailed",
  "elaborate",
  "expand on",
  "say more",
  "go deeper"
];

function normalizeQuestion(question: string) {
  return question.replace(/\s+/g, " ").trim().toLowerCase();
}

function collectSentences(answer: string) {
  const normalized = answer.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [] as string[];
  }

  const sentences: string[] = [];
  let current = "";

  for (const character of normalized) {
    current += character;

    if ("。！？!?".includes(character)) {
      const sentence = current.trim();

      if (sentence) {
        sentences.push(sentence);
      }

      current = "";
    }
  }

  const trailing = current.trim();

  if (trailing) {
    sentences.push(trailing);
  }

  return sentences;
}

export function detectAnswerLengthMode(question: string): AnswerLengthMode {
  const normalized = normalizeQuestion(question);

  return DETAILED_REQUEST_PATTERNS.some((pattern) => normalized.includes(pattern)) ? "detailed" : "default";
}

export function buildAnswerLengthPolicy(question: string): AnswerLengthPolicy {
  const mode = detectAnswerLengthMode(question);

  return {
    mode,
    maxSentences: mode === "default" ? 3 : null
  };
}

export function countAnswerSentences(answer: string) {
  return collectSentences(answer).length;
}

export function enforceAnswerLengthPolicy(answer: string, policy: AnswerLengthPolicy) {
  const normalized = answer.replace(/\s+/g, " ").trim();

  if (!normalized || policy.maxSentences === null) {
    return normalized;
  }

  const sentences = collectSentences(normalized);

  if (sentences.length <= policy.maxSentences) {
    return normalized;
  }

  return sentences.slice(0, policy.maxSentences).join(" ");
}
