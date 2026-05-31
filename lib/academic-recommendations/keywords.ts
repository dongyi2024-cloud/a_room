import "server-only";

import { generateDeepSeekChatCompletion } from "@/lib/ai/deepseek";
import type {
  AcademicKeywordGroups,
  AcademicRecommendationRequest,
  AcademicRetrievalQuery,
  AcademicSearchIntentType,
  AcademicSearchKeywordResult,
  AcademicTriggerDecision
} from "@/types/academic-recommendations";

export const ACADEMIC_KEYWORD_LIMITS = {
  primary: 4,
  secondary: 6,
  chinese: 5,
  english: 5,
  queryCount: 5,
  queryLength: 140,
  keywordLength: 80,
  contextExcerptLength: 220
} as const;

const ACADEMIC_KEYWORD_MODEL_TIMEOUT_MS = Number.parseInt(
  process.env.ACADEMIC_KEYWORD_MODEL_TIMEOUT_MS?.trim() || "2500",
  10
);

type KeywordGroupName = keyof AcademicKeywordGroups;

type KeywordGenerator = (params: {
  request: AcademicRecommendationRequest;
  trigger: AcademicTriggerDecision;
  intentType: AcademicSearchIntentType;
}) => Promise<Partial<AcademicSearchKeywordResult> | null>;

const EMPTY_KEYWORD_GROUPS: AcademicKeywordGroups = {
  primary: [],
  secondary: [],
  chinese: [],
  english: []
};

const UNSAFE_KEYWORD_PATTERNS = [
  /^https?:\/\//i,
  /\bwww\./i,
  /\bdoi\s*:/i,
  /\b10\.\d{4,9}\//,
  /<[^>]+>/,
  /\{|\}/
];

const ALIAS_KEYWORDS: Array<{
  patterns: RegExp[];
  primary: string[];
  secondary: string[];
  chinese: string[];
  english: string[];
}> = [
  {
    patterns: [/西多会/, /cistercian/i],
    primary: ["西多会", "Cistercian Order"],
    secondary: ["Cistercians", "medieval Europe", "monasticism", "Christian monastic orders"],
    chinese: ["西多会", "熙笃会", "中世纪欧洲", "修道院制度"],
    english: ["Cistercian Order", "Cistercians", "medieval monasticism", "Christian monasticism"]
  },
  {
    patterns: [/十字军东征/, /crusade/i],
    primary: ["十字军东征", "Crusades"],
    secondary: ["medieval history", "Christianity Islam", "cultural memory literature", "religious war"],
    chinese: ["十字军东征", "中世纪史", "基督教与伊斯兰", "文学文化记忆"],
    english: ["Crusades", "medieval history", "Christianity and Islam", "cultural memory literature"]
  },
  {
    patterns: [/伍尔夫|woolf/i, /女性主义|feminis/i],
    primary: ["Virginia Woolf", "feminism"],
    secondary: ["A Room of One's Own", "women and education", "women and fiction", "modernist literature"],
    chinese: ["伍尔夫", "女性主义", "女性与教育", "女性与小说"],
    english: ["Virginia Woolf", "A Room of One's Own", "feminism", "women and education"]
  },
  {
    patterns: [/作者|传记|生平|author|biograph/i, /伍尔夫|woolf/i],
    primary: ["Virginia Woolf", "author biography"],
    secondary: ["Bloomsbury Group", "women writers", "modernism", "education"],
    chinese: ["伍尔夫", "作者生平", "布卢姆斯伯里", "现代主义"],
    english: ["Virginia Woolf biography", "Bloomsbury Group", "modernism", "women writers"]
  },
  {
    patterns: [/莎士比亚|shakespeare/i, /戏剧|剧作|plays?|drama/i],
    primary: ["莎士比亚戏剧", "William Shakespeare plays"],
    secondary: ["Shakespeare canon", "Oxford Shakespeare", "bibliography", "early modern drama"],
    chinese: ["莎士比亚", "莎士比亚戏剧", "权威剧目", "早期现代戏剧"],
    english: ["William Shakespeare plays", "Shakespeare canon", "Oxford Shakespeare", "early modern drama"]
  },
  {
    patterns: [/简[·.]?爱|jane eyre/i],
    primary: ["简·爱", "Jane Eyre"],
    secondary: ["Charlotte Bronte", "Victorian novel", "nineteenth-century literature", "critical edition"],
    chinese: ["简·爱", "简爱", "夏洛蒂·勃朗特", "维多利亚小说"],
    english: ["Jane Eyre", "Charlotte Bronte", "Victorian novel", "nineteenth-century literature"]
  }
];

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function addKeyword(groups: AcademicKeywordGroups, group: KeywordGroupName, value: string | null | undefined) {
  const normalized = normalizeText(value);

  if (!normalized || normalized.length > ACADEMIC_KEYWORD_LIMITS.keywordLength) {
    return;
  }

  if (UNSAFE_KEYWORD_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return;
  }

  if (!groups[group].some((item) => item.toLowerCase() === normalized.toLowerCase())) {
    groups[group].push(normalized);
  }
}

function limitKeywordGroups(groups: AcademicKeywordGroups): AcademicKeywordGroups {
  return {
    primary: groups.primary.slice(0, ACADEMIC_KEYWORD_LIMITS.primary),
    secondary: groups.secondary.slice(0, ACADEMIC_KEYWORD_LIMITS.secondary),
    chinese: groups.chinese.slice(0, ACADEMIC_KEYWORD_LIMITS.chinese),
    english: groups.english.slice(0, ACADEMIC_KEYWORD_LIMITS.english)
  };
}

export function sanitizeAcademicKeywordGroups(input: Partial<AcademicKeywordGroups> | null | undefined) {
  const groups: AcademicKeywordGroups = {
    primary: [],
    secondary: [],
    chinese: [],
    english: []
  };

  for (const group of Object.keys(groups) as KeywordGroupName[]) {
    const values = Array.isArray(input?.[group]) ? input[group] : [];

    for (const value of values) {
      addKeyword(groups, group, typeof value === "string" ? value : "");
    }
  }

  return limitKeywordGroups(groups);
}

function mergeKeywordGroups(...items: Array<Partial<AcademicKeywordGroups> | null | undefined>) {
  const groups: AcademicKeywordGroups = {
    primary: [],
    secondary: [],
    chinese: [],
    english: []
  };

  for (const item of items) {
    const sanitized = sanitizeAcademicKeywordGroups(item);

    for (const group of Object.keys(groups) as KeywordGroupName[]) {
      for (const value of sanitized[group]) {
        addKeyword(groups, group, value);
      }
    }
  }

  return limitKeywordGroups(groups);
}

export function classifyAcademicSearchIntent(
  request: AcademicRecommendationRequest,
  trigger: AcademicTriggerDecision
): AcademicSearchIntentType {
  const text = normalizeText([request.question, request.selectedText, request.paragraphText, trigger.themes.join(" ")].join(" "));
  const hasExplicitAcademicSupportRequest =
    /学术文献支撑|学术支撑|学术文献|权威来源|权威学术|学者观点|论文|文献|paper|scholar|academic|source/i.test(text);

  if (
    !hasExplicitAcademicSupportRequest &&
    (trigger.reasons.includes("named_entity_background_context") || /是谁|是什么|what is|who is/i.test(request.question))
  ) {
    return "named_entity_background";
  }

  if (/作者|传记|生平|author|biograph/i.test(request.question)) {
    return "author_context";
  }

  if (trigger.reasons.includes("philosophy_or_cultural_studies") || /文化研究|cultural studies/i.test(request.question)) {
    return "cultural_context";
  }

  if (trigger.reasons.includes("historical_context") || /十字军东征|战争|革命|运动|时代|世纪|伦敦|城市史|社会史|crusade|war|movement|era|century|London|urban history|social history/i.test(text)) {
    return "historical_event_context";
  }

  if (
    trigger.reasons.includes("literary_theory") ||
    trigger.reasons.includes("feminist_or_gender_studies") ||
    trigger.reasons.includes("modernism") ||
    /理论|女性主义|现代主义|叙事|theory|feminis|modernis|narrative/i.test(text)
  ) {
    return "literary_theory";
  }

  if (trigger.reasons.includes("author_biography")) {
    return "author_context";
  }

  if (/相关研究|学者观点|论文|权威来源|权威学术|研究|paper|scholar|academic|bibliograph/i.test(text)) {
    return "book_research";
  }

  return "cultural_context";
}

function getContextExcerpt(request: AcademicRecommendationRequest) {
  return normalizeText(request.paragraphText).slice(0, ACADEMIC_KEYWORD_LIMITS.contextExcerptLength) || null;
}

function buildOriginalQuery(request: AcademicRecommendationRequest) {
  return normalizeText(request.question || request.selectedText || request.paragraphText || request.bookTitle).slice(
    0,
    ACADEMIC_KEYWORD_LIMITS.queryLength
  );
}

function looksLikeShortSearchTerm(value: string) {
  const normalized = normalizeText(value);

  if (normalized.length < 2 || normalized.length > ACADEMIC_KEYWORD_LIMITS.keywordLength) {
    return false;
  }

  return (
    /^[\p{Script=Han}·•《》「」『』A-Za-z0-9\s'’.-]{2,80}$/u.test(normalized) &&
    !/[。！？!?；;，,]{2,}/.test(normalized)
  );
}

function extractAcademicSubjectFromQuestion(question: string) {
  const normalized = normalizeText(question)
    .replace(/请你|请|帮我|能不能|可以|详细|讨论|介绍|分析|说明|解释/g, "")
    .replace(/需要有(?:权威)?(?:学术)?(?:文献|论文|来源|数据|证据)?支撑/g, "")
    .replace(/需要(?:权威)?(?:学术)?(?:文献|论文|来源|数据|证据)/g, "")
    .replace(/有(?:什么)?(?:学者观点|相关研究|论文|权威来源|学术文献|文献支撑).*/g, "")
    .replace(/是什么样的|是什么|是啥|是谁|什么意思|什么背景|有何背景|有什么背景/g, "")
    .replace(/[？?。!！：:，,；;]+$/g, "")
    .trim();

  return looksLikeShortSearchTerm(normalized) ? normalized : "";
}

function addQuestionSubjectKeywords(groups: AcademicKeywordGroups, subject: string) {
  if (!subject) {
    return;
  }

  const compactChineseSubject = subject.replace(/的/g, "");

  addKeyword(groups, "primary", subject);
  addKeyword(groups, "chinese", subject);

  if (compactChineseSubject !== subject) {
    addKeyword(groups, "primary", compactChineseSubject);
    addKeyword(groups, "chinese", compactChineseSubject);
  }

  if (/18世纪|十八世纪/.test(subject) && /伦敦/.test(subject)) {
    addKeyword(groups, "primary", "18世纪伦敦");
    addKeyword(groups, "secondary", "城市史");
    addKeyword(groups, "secondary", "社会史");
    addKeyword(groups, "chinese", "18世纪伦敦");
    addKeyword(groups, "chinese", "伦敦城市史");
    addKeyword(groups, "english", "eighteenth-century London");
    addKeyword(groups, "english", "Georgian London");
    addKeyword(groups, "english", "London urban history");
    addKeyword(groups, "english", "London social history");
  }
}

function buildBaseFallbackKeywords(
  request: AcademicRecommendationRequest,
  trigger: AcademicTriggerDecision,
  intentType: AcademicSearchIntentType
): AcademicKeywordGroups {
  const groups: AcademicKeywordGroups = {
    primary: [],
    secondary: [],
    chinese: [],
    english: []
  };
  const selectedText = normalizeText(request.selectedText);
  const question = normalizeText(request.question);
  const bookTitle = normalizeText(request.bookTitle);
  const chapterTitle = normalizeText(request.chapterTitle);
  const paragraphText = normalizeText(request.paragraphText);
  const haystack = [selectedText, question, bookTitle, chapterTitle, paragraphText, trigger.themes.join(" ")].join(" ");
  const questionSubject = extractAcademicSubjectFromQuestion(question);

  addQuestionSubjectKeywords(groups, questionSubject);
  addKeyword(groups, "primary", questionSubject || (looksLikeShortSearchTerm(selectedText) ? selectedText : question));
  addKeyword(groups, "primary", question);
  addKeyword(groups, "primary", trigger.themes[0]);
  addKeyword(groups, "secondary", bookTitle);
  addKeyword(groups, "secondary", chapterTitle);

  for (const theme of trigger.themes) {
    addKeyword(groups, "secondary", theme);
    addKeyword(groups, /[\u4e00-\u9fff]/.test(theme) ? "chinese" : "english", theme);
  }

  if (looksLikeShortSearchTerm(selectedText)) {
    if (/[\u4e00-\u9fff]/.test(selectedText)) {
      addKeyword(groups, "chinese", selectedText);
    } else {
      addKeyword(groups, "english", selectedText);
    }
  }

  if (/woolf|伍尔夫|room of one's own|自己的房间/i.test(haystack)) {
    addKeyword(groups, "english", "Virginia Woolf");
    addKeyword(groups, "english", "A Room of One's Own");
    addKeyword(groups, "chinese", "伍尔夫");
  }

  if (intentType === "historical_event_context") {
    addKeyword(groups, "secondary", "historical context");
    addKeyword(groups, "english", "historical context");
    addKeyword(groups, "chinese", "历史文化语境");
  }

  if (intentType === "literary_theory") {
    addKeyword(groups, "secondary", "literary criticism");
    addKeyword(groups, "english", "literary criticism");
    addKeyword(groups, "chinese", "文学理论");
  }

  if (intentType === "author_context") {
    addKeyword(groups, "secondary", "author biography");
    addKeyword(groups, "english", "author biography");
    addKeyword(groups, "chinese", "作者生平");
  }

  for (const alias of ALIAS_KEYWORDS) {
    if (alias.patterns.some((pattern) => pattern.test(haystack))) {
      for (const group of Object.keys(EMPTY_KEYWORD_GROUPS) as KeywordGroupName[]) {
        for (const value of alias[group]) {
          addKeyword(groups, group, value);
        }
      }
    }
  }

  return limitKeywordGroups(groups);
}

function extractJsonObject(value: string) {
  const trimmed = value.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function isKeywordObject(value: unknown): value is { keywords?: Partial<AcademicKeywordGroups> } {
  return Boolean(value && typeof value === "object");
}

function shouldUseModelKeywordGeneration() {
  return process.env.ACADEMIC_KEYWORD_MODEL_ENABLED?.trim().toLowerCase() !== "false";
}

async function generateModelKeywords(params: {
  request: AcademicRecommendationRequest;
  trigger: AcademicTriggerDecision;
  intentType: AcademicSearchIntentType;
}) {
  if (!shouldUseModelKeywordGeneration() || !process.env.DEEPSEEK_API_KEY?.trim()) {
    return null;
  }

  const { request, trigger, intentType } = params;
  const completion = await generateDeepSeekChatCompletion({
    temperature: 0.2,
    maxTokens: 360,
    timeoutMs:
      Number.isFinite(ACADEMIC_KEYWORD_MODEL_TIMEOUT_MS) && ACADEMIC_KEYWORD_MODEL_TIMEOUT_MS > 0
        ? ACADEMIC_KEYWORD_MODEL_TIMEOUT_MS
        : 2500,
    systemPrompt:
      "You generate search keywords only for trusted academic retrieval. Return strict JSON. Do not invent paper titles, author names, URLs, claims, recommendations, or source metadata.",
    userPrompt: JSON.stringify({
      outputShape: {
        intentType,
        keywords: {
          primary: ["short academic query terms"],
          secondary: ["context expansion terms"],
          chinese: ["Chinese keyword variants"],
          english: ["English keyword variants"]
        }
      },
      constraints: {
        searchScope: "trusted_academic_sources_only",
        noSources: true,
        maxPrimary: ACADEMIC_KEYWORD_LIMITS.primary,
        maxSecondary: ACADEMIC_KEYWORD_LIMITS.secondary,
        maxChinese: ACADEMIC_KEYWORD_LIMITS.chinese,
        maxEnglish: ACADEMIC_KEYWORD_LIMITS.english
      },
      request: {
        bookTitle: request.bookTitle,
        chapterTitle: request.chapterTitle,
        selectedText: request.selectedText,
        question: request.question,
        paragraphExcerpt: getContextExcerpt(request),
        themes: trigger.themes,
        reasons: trigger.reasons
      }
    })
  });
  const parsed = extractJsonObject(completion.answer);

  if (!isKeywordObject(parsed)) {
    return null;
  }

  return {
    intentType,
    keywords: sanitizeAcademicKeywordGroups(parsed.keywords)
  };
}

export async function buildAcademicSearchKeywords(
  request: AcademicRecommendationRequest,
  trigger: AcademicTriggerDecision,
  options: { generator?: KeywordGenerator } = {}
): Promise<AcademicSearchKeywordResult> {
  const intentType = classifyAcademicSearchIntent(request, trigger);
  const fallbackKeywords = buildBaseFallbackKeywords(request, trigger, intentType);
  let modelKeywords: AcademicKeywordGroups | null = null;

  if (trigger.shouldRetrieve) {
    try {
      const generated = options.generator
        ? await options.generator({ request, trigger, intentType })
        : await generateModelKeywords({ request, trigger, intentType });
      modelKeywords = sanitizeAcademicKeywordGroups(generated?.keywords);
    } catch {
      modelKeywords = null;
    }
  }

  const keywords = mergeKeywordGroups(modelKeywords, fallbackKeywords);
  const fallbackUsed =
    !modelKeywords ||
    Object.values(modelKeywords).every((values) => values.length === 0) ||
    Object.values(keywords).every((values) => values.length === 0);

  return {
    intentType,
    originalQuery: buildOriginalQuery(request),
    selectedText: normalizeText(request.selectedText) || null,
    contextExcerpt: getContextExcerpt(request),
    keywords,
    searchScope: "trusted_academic_sources_only",
    fallbackUsed
  };
}

function buildQueryParts(result: AcademicSearchKeywordResult) {
  const groups = result.keywords;
  const candidates = [
    [...groups.primary, ...groups.english].join(" "),
    [...groups.primary, ...groups.chinese].join(" "),
    [...groups.primary, ...groups.secondary.slice(0, 3)].join(" "),
    [...groups.english, ...groups.secondary.slice(0, 2)].join(" "),
    [...groups.chinese, ...groups.secondary.slice(0, 2)].join(" ")
  ];

  return candidates
    .map((query) => normalizeText(query).slice(0, ACADEMIC_KEYWORD_LIMITS.queryLength))
    .filter(Boolean)
    .filter((query, index, all) => all.findIndex((item) => item.toLowerCase() === query.toLowerCase()) === index)
    .slice(0, ACADEMIC_KEYWORD_LIMITS.queryCount);
}

export function buildAcademicRetrievalQueriesFromKeywords(
  keywordResult: AcademicSearchKeywordResult,
  trigger: AcademicTriggerDecision
): AcademicRetrievalQuery[] {
  if (!trigger.shouldRetrieve || keywordResult.searchScope !== "trusted_academic_sources_only") {
    return [];
  }

  const keywords = Array.from(new Set(Object.values(keywordResult.keywords).flat())).slice(0, 16);

  return buildQueryParts(keywordResult).map((query) => ({
    query,
    themes: trigger.themes,
    originalQuery: keywordResult.originalQuery,
    selectedText: keywordResult.selectedText,
    contextExcerpt: keywordResult.contextExcerpt,
    keywords,
    intentType: keywordResult.intentType
  }));
}
