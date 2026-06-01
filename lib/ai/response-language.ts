export type ResponseLanguage = "zh" | "en";

const CHINESE_CHAR_PATTERN = /[\u4e00-\u9fff]/g;
const LATIN_CHAR_PATTERN = /[A-Za-z]/g;

function countMatches(text: string, pattern: RegExp) {
  const matches = text.match(pattern);

  return matches ? matches.length : 0;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function inferResponseLanguage(texts: string[], fallback: ResponseLanguage = "zh"): ResponseLanguage {
  const normalized = texts.map(normalizeText).filter(Boolean).join(" ");

  if (!normalized) {
    return fallback;
  }

  const chineseCount = countMatches(normalized, CHINESE_CHAR_PATTERN);
  const latinCount = countMatches(normalized, LATIN_CHAR_PATTERN);

  if (chineseCount === 0 && latinCount === 0) {
    return fallback;
  }

  if (latinCount > chineseCount * 1.2) {
    return "en";
  }

  if (chineseCount > latinCount * 1.2) {
    return "zh";
  }

  return fallback;
}

export function getResponseLanguageInstruction(language: ResponseLanguage) {
  return language === "en"
    ? "Respond in English and keep the answer natural in English."
    : "Respond in Chinese and keep the answer natural in Chinese.";
}

export function getQuestionMark(language: ResponseLanguage) {
  return language === "en" ? "?" : "？";
}
