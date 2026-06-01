import type { AiMemoryInteractionInput, UserMemoryCandidate, UserMemoryType } from "@/types/memory";

const MAX_MEMORY_CONTENT_CHARS = 180;
const SENSITIVE_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:\d[ -]*?){13,16}\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?\d[\d\s().-]{8,}\d)\b/,
  /身份证|护照|银行卡|信用卡|住址|地址|电话|手机号|邮箱|病历|诊断|药物|法院|律师|密码|secret|password|passport|diagnosis|medical|credit card|bank account|address|phone|email/i
];

const MEMORY_TYPE_LABELS: Record<UserMemoryType, string> = {
  explanation_style: "解释风格",
  interpretive_interest: "关注视角",
  recurring_question: "反复疑问",
  answer_length: "回答长度",
  reading_assistance: "阅读辅助"
};

function normalizeText(value: string, maxLength = MAX_MEMORY_CONTENT_CHARS) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function containsSensitiveInformation(value: string) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(value));
}

function isRawSelectedText(candidate: string, selectedText?: string) {
  if (!selectedText) {
    return false;
  }

  const normalizedCandidate = normalizeText(candidate, 500);
  const normalizedSelection = normalizeText(selectedText, 500);

  if (normalizedSelection.length < 40) {
    return normalizedCandidate === normalizedSelection;
  }

  return normalizedCandidate.includes(normalizedSelection.slice(0, 80));
}

function createCandidate(
  input: AiMemoryInteractionInput,
  memoryType: UserMemoryType,
  keySuffix: string,
  content: string,
  extraContext: Record<string, unknown> = {}
): UserMemoryCandidate {
  return {
    memoryType,
    memoryKey: `${memoryType}:${normalizeKey(keySuffix)}`,
    content: normalizeText(content),
    source: input.source,
    sourceContext: {
      bookTitle: input.bookTitle ?? null,
      chapterTitle: input.chapterTitle ?? null,
      questionSample: normalizeText(input.question, 160),
      ...extraContext
    }
  };
}

function detectInterpretiveInterest(question: string) {
  const normalized = question.toLowerCase();

  if (/女性|女性主义|女权|性别|feminism|feminist|gender|women|woman/.test(normalized)) {
    return "女性主义视角";
  }

  if (/写作|叙事|结构|隐喻|象征|metaphor|symbol|narrative|style/.test(normalized)) {
    return "叙事与文体";
  }

  if (/历史|时代|背景|社会|history|historical|context|society/.test(normalized)) {
    return "历史与社会背景";
  }

  return null;
}

function detectConceptQuestion(question: string) {
  const cleaned = question.replace(/\s+/g, " ").trim();
  const chineseMatch = cleaned.match(/(?:什么是|这段中的|这里的|如何理解|怎么理解)([^？?，。,]{2,24})/);

  if (chineseMatch?.[1]) {
    return chineseMatch[1].replace(/["“”]/g, "").trim();
  }

  const englishMatch = cleaned.match(/(?:what does|what is|explain|understand)\s+["']?([^?"'.]{3,40})/i);

  if (englishMatch?.[1]) {
    return englishMatch[1].trim();
  }

  return null;
}

function detectAssistancePreference(question: string) {
  const normalized = question.toLowerCase();

  if (/现实例子|举例|例子|example|analogy/.test(normalized)) {
    return "现实例子";
  }

  if (/总结|概括|summary|summarize/.test(normalized)) {
    return "简短总结";
  }

  if (/逐句|一句句|line by line|sentence by sentence/.test(normalized)) {
    return "逐句拆解";
  }

  return null;
}

export function filterSafeMemoryCandidates(candidates: UserMemoryCandidate[], selectedText?: string) {
  const accepted: UserMemoryCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const label = MEMORY_TYPE_LABELS[candidate.memoryType];
    const content = normalizeText(candidate.content);

    if (!label || !content || containsSensitiveInformation(content) || isRawSelectedText(content, selectedText)) {
      continue;
    }

    if (seen.has(candidate.memoryKey)) {
      continue;
    }

    seen.add(candidate.memoryKey);
    accepted.push({
      ...candidate,
      content
    });
  }

  return accepted;
}

export function generateMemoryCandidates(input: AiMemoryInteractionInput) {
  const candidates: UserMemoryCandidate[] = [];
  const question = normalizeText(input.question, 600);

  if (input.explanationMode === "close_reading") {
    candidates.push(
      createCandidate(input, "explanation_style", "close-reading", "用户偏好贴近原文的细读解释，适合保留文本语气与概念张力。", {
        explanationMode: input.explanationMode
      })
    );
  }

  if (input.answerLengthMode === "detailed") {
    candidates.push(createCandidate(input, "answer_length", "detailed", "用户在需要时会要求更详细的解释。"));
  }

  const interest = detectInterpretiveInterest(question);

  if (interest) {
    candidates.push(
      createCandidate(input, "interpretive_interest", interest, `用户经常关注${interest}。`, {
        detectedInterest: interest
      })
    );
  }

  const concept = detectConceptQuestion(question);

  if (concept) {
    candidates.push(
      createCandidate(input, "recurring_question", concept, `用户反复关注或提问概念：“${concept}”。`, {
        concept
      })
    );
  }

  const assistance = detectAssistancePreference(question);

  if (assistance) {
    candidates.push(
      createCandidate(input, "reading_assistance", assistance, `用户偏好使用${assistance}来辅助阅读理解。`, {
        assistance
      })
    );
  }

  return filterSafeMemoryCandidates(candidates, input.selectedText);
}

export function formatMemoriesForPrompt(memories: Array<{ content: string; memoryType: UserMemoryType }>) {
  if (memories.length === 0) {
    return "";
  }

  return [
    "Long-term reader memory for this user only:",
    ...memories.slice(0, 6).map((memory, index) => `${index + 1}. [${MEMORY_TYPE_LABELS[memory.memoryType]}] ${memory.content}`),
    "Use these as preference guidance only. Do not present them as source evidence or citations."
  ].join("\n");
}
