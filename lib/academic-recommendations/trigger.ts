import type {
  AcademicRecommendationRequest,
  AcademicRetrievalQuery,
  AcademicTriggerDecision,
  AcademicTriggerReason
} from "@/types/academic-recommendations";

const EXPLICIT_REQUEST_PATTERNS = [
  /论文/,
  /学者/,
  /学术/,
  /研究/,
  /理论/,
  /背景资料/,
  /相关著作/,
  /权威/,
  /数据支撑/,
  /证据支撑/,
  /来源/,
  /出处/,
  /paper/i,
  /scholar/i,
  /academic/i,
  /theory/i,
  /background/i,
  /bibliography/i,
  /authoritative/i,
  /source/i,
  /evidence/i
];

const ENTITY_BACKGROUND_QUESTION_PATTERNS = [
  /是谁/,
  /是什么/,
  /出自哪里/,
  /来自哪里/,
  /什么背景/,
  /有什么背景/,
  /有何背景/,
  /who is/i,
  /what is/i,
  /where.*from/i,
  /background/i
];

const THEME_PATTERNS: Array<{ reason: AcademicTriggerReason; theme: string; patterns: RegExp[] }> = [
  {
    reason: "feminist_or_gender_studies",
    theme: "女性主义",
    patterns: [/女性主义/, /性别/, /父权/, /女人/, /女性/, /feminis/i, /gender/i, /patriarch/i, /women/i]
  },
  {
    reason: "modernism",
    theme: "现代主义",
    patterns: [/现代主义/, /意识流/, /内心独白/, /modernis/i, /stream of consciousness/i]
  },
  {
    reason: "literary_theory",
    theme: "文学理论",
    patterns: [/叙事/, /象征/, /隐喻/, /互文/, /文体/, /literary theory/i, /narrat/i, /metaphor/i, /intertext/i]
  },
  {
    reason: "named_entity_background_context",
    theme: "文学典故或古典语境",
    patterns: [
      /典故/,
      /神话/,
      /戏剧/,
      /悲剧/,
      /史诗/,
      /古希腊/,
      /希腊/,
      /西多会/,
      /cistercian/i,
      /罗马/,
      /荷马/,
      /埃斯库罗斯/,
      /索福克勒斯/,
      /欧里庇得斯/,
      /克吕泰涅斯特拉/,
      /克吕泰涅斯特拉/i,
      /clytemnestra/i,
      /agamemnon/i,
      /aeschylus/i,
      /sophocles/i,
      /euripides/i,
      /homer/i,
      /myth/i,
      /tragedy/i,
      /classical/i,
      /allusion/i
    ]
  },
  {
    reason: "historical_context",
    theme: "历史文化语境",
    patterns: [/历史/, /战争/, /帝国/, /殖民/, /阶级/, /世纪/, /伦敦/, /十字军东征/, /history/i, /war/i, /crusade/i, /empire/i, /colonial/i, /class/i, /century/i, /London/i]
  },
  {
    reason: "author_biography",
    theme: "作者生平背景",
    patterns: [/伍尔夫/, /作者/, /传记/, /生平/, /woolf/i, /author/i, /biograph/i]
  },
  {
    reason: "philosophy_or_cultural_studies",
    theme: "哲学或文化研究",
    patterns: [/哲学/, /主体/, /身份/, /文化研究/, /权力/, /philosoph/i, /subjectivity/i, /identity/i, /cultural studies/i, /power/i]
  }
];

const RETRIEVAL_THEME_TERMS: Record<string, string> = {
  女性主义: "feminism gender women",
  现代主义: "modernism stream of consciousness",
  文学理论: "literary theory narrative",
  专名或背景语境: "named entity background reference context",
  文学典故或古典语境: "classical allusion Greek tragedy myth literary criticism",
  历史文化语境: "historical context culture",
  作者生平背景: "author biography",
  哲学或文化研究: "philosophy cultural studies"
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function looksLikeNamedEntityOrConcept(text: string) {
  const normalized = normalizeText(text);

  if (normalized.length < 2 || normalized.length > 80) {
    return false;
  }

  if (/^[\p{Script=Han}·•]{2,24}$/u.test(normalized)) {
    return true;
  }

  if (/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4}\b/.test(normalized)) {
    return true;
  }

  return /[《「『].+[》」』]/.test(normalized);
}

function addUnique<T>(values: T[], value: T) {
  if (!values.includes(value)) {
    values.push(value);
  }
}

export function detectAcademicTrigger(request: AcademicRecommendationRequest): AcademicTriggerDecision {
  const haystack = normalizeText(
    [request.question, request.selectedText, request.paragraphText].join(" ")
  );
  const reasons: AcademicTriggerReason[] = [];
  const themes: string[] = [];

  if (EXPLICIT_REQUEST_PATTERNS.some((pattern) => pattern.test(request.question))) {
    addUnique(reasons, "explicit_user_request");
  }

  for (const item of THEME_PATTERNS) {
    if (item.patterns.some((pattern) => pattern.test(haystack))) {
      addUnique(reasons, item.reason);
      addUnique(themes, item.theme);
    }
  }

  const asksEntityBackground = ENTITY_BACKGROUND_QUESTION_PATTERNS.some((pattern) => pattern.test(request.question));

  if (asksEntityBackground && looksLikeNamedEntityOrConcept(request.selectedText)) {
    addUnique(reasons, "named_entity_background_context");
    addUnique(themes, "专名或背景语境");
  }

  if (reasons.includes("named_entity_background_context") && asksEntityBackground) {
    addUnique(reasons, "explicit_user_request");
  }

  if (reasons.includes("explicit_user_request") && themes.length === 0) {
    themes.push(normalizeText(request.selectedText || request.paragraphText).slice(0, 60) || request.bookTitle);
  }

  return {
    shouldRetrieve: reasons.length > 0 && themes.length > 0,
    reasons,
    themes
  };
}

export function buildAcademicRetrievalQueries(request: AcademicRecommendationRequest, trigger: AcademicTriggerDecision) {
  if (!trigger.shouldRetrieve) {
    return [];
  }

  const authorTitleQuery = [request.bookTitle, request.chapterTitle, trigger.themes[0]].filter(Boolean).join(" ");
  const sourceTerms = trigger.themes.map((theme) => RETRIEVAL_THEME_TERMS[theme] ?? theme).join(" ");
  const selectedTheme = normalizeText(request.selectedText).slice(0, 100);

  const queries: AcademicRetrievalQuery[] = [
    {
      query: `${request.bookTitle} ${sourceTerms}`,
      themes: trigger.themes
    },
    {
      query: `${authorTitleQuery} ${sourceTerms}`,
      themes: trigger.themes
    }
  ];

  if (selectedTheme) {
    queries.push({
      query: `${selectedTheme} ${trigger.themes[0]}`,
      themes: trigger.themes
    });
  }

  return queries.filter((query, index, all) => all.findIndex((item) => item.query === query.query) === index).slice(0, 3);
}
