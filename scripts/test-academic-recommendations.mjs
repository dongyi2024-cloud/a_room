import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const moduleCache = new Map();

function compileModule(relativePath, extraMocks = {}) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText;
  const exports = {};
  const module = { exports };
  const localRequire = (id) => {
    if (id in extraMocks) {
      return extraMocks[id];
    }

    if (id === "server-only") {
      return {};
    }

    if (id.startsWith("@/")) {
      const mapped = id.replace("@/", "");

      if (moduleCache.has(mapped)) {
        return moduleCache.get(mapped);
      }

      return loadModule(`${mapped}.ts`, extraMocks);
    }

    return require(id);
  };
  const context = {
    exports,
    module,
    require: localRequire,
    console,
    process,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch
  };

  vm.runInNewContext(compiled, context, { filename: relativePath });
  return context.module.exports;
}

function loadModule(relativePath, extraMocks = {}) {
  if (moduleCache.has(relativePath.replace(/\.ts$/, ""))) {
    return moduleCache.get(relativePath.replace(/\.ts$/, ""));
  }

  const loaded = compileModule(relativePath, extraMocks);
  moduleCache.set(relativePath.replace(/\.ts$/, ""), loaded);
  return loaded;
}

const triggerModule = loadModule("lib/academic-recommendations/trigger.ts");
const keywordsModule = loadModule("lib/academic-recommendations/keywords.ts");
const policyModule = loadModule("lib/academic-recommendations/policy.ts");
const sourcePolicyModule = loadModule("lib/academic-recommendations/source-policy.ts");
const validationModule = loadModule("lib/academic-recommendations/validation.ts");
const providerRuntimeModule = loadModule("lib/academic-recommendations/provider-runtime.ts");
const backgroundRewriteModule = loadModule("lib/academic-recommendations/background-query-rewrite.ts");
const backgroundLeadsModule = loadModule("lib/academic-recommendations/background-leads.ts");
const searchIntentModule = loadModule("lib/academic-recommendations/search-intent.ts");
const selectionFallbackModule = compileModule("lib/ai/selection-workflow.ts", {
  "@/lib/ai/selection-citations": {
    buildSelectionAiCitations: async () => []
  },
  "@/lib/ai/answer-length": {
    buildAnswerLengthPolicy: () => ({ mode: "default", maxSentences: 3 }),
    enforceAnswerLengthPolicy: (answer) => answer
  },
  "@/lib/academic-recommendations/workflow": {
    runAcademicRecommendationWorkflow: async () => ({
      shouldDisplay: false,
      trigger: { shouldRetrieve: false, reasons: [], themes: [] },
      recommendations: [],
      sourceLeads: [],
      emptyReason: "not_relevant"
    })
  },
  "@/lib/academic-recommendations/background-leads": {
    loadBibliographySourceLeads: async () => [],
    loadFastBackgroundSourceLeads: async () => [],
    mergeAcademicSourceLeads: (primary, secondary, maxLeads = 5) => [...primary, ...secondary].slice(0, maxLeads)
  },
  "@/lib/academic-recommendations/search-intent": {
    classifySelectionSearchIntent: () => ({ mode: "none", reason: "test", maxWaitMs: 0, allowedProviders: [] }),
    shouldAttemptAcademicEvidence: () => false
  },
  "@/lib/ai/deepseek": {
    generateDeepSeekChatCompletion: async () => ({ answer: "{\"answer\":\"ok\",\"citationChunkIds\":[]}", finishReason: "stop" })
  },
  "@/lib/ai/prompts": {
    enforceWoolfFirstPersonVoice: (answer) => answer,
    getWoolfVoiceInstruction: () => "voice",
    loadWoolfPersonaPrompt: async () => "persona"
  },
  "@/lib/ai/response-language": {
    getResponseLanguageInstruction: () => "respond in zh",
    inferResponseLanguage: () => "zh"
  },
  "@/lib/memory/data": {
    loadAiMemoryContext: async () => "",
    recordAiMemoryCandidates: async () => {}
  },
  "@/lib/rag/retrieval": {
    BookRetrievalSourceUnavailableError: class BookRetrievalSourceUnavailableError extends Error {},
    retrieveBookChunksForUser: async () => ({ chunks: [] })
  }
});

const baseRequest = {
  userId: "user-1",
  bookId: "book-1",
  bookTitle: "A Room of One's Own",
  chapterId: "chapter-1",
  chapterOrder: 1,
  chapterTitle: "Women and Fiction",
  paragraphId: "paragraph-1",
  paragraphOrder: 3,
  paragraphText: "Women and fiction raises questions about gender, authorship, and material conditions.",
  selectedText: "women and fiction",
  question: "有没有相关论文或学者观点？"
};

const baseSelectionRequest = {
  ...baseRequest,
  explanationMode: "plain",
  explanationContext: null,
  priorTurns: []
};

{
  const parsed = selectionFallbackModule.parseGroundedAnswerPayload(
    JSON.stringify({ answer: "有效 JSON 回答", citationChunkIds: ["chunk-1", "chunk-1"] })
  );
  const fallbackText = selectionFallbackModule.extractMalformedGroundedAnswerFallback([
    "伊丽莎白时代的文学通常与戏剧、诗歌和宫廷文化相关。"
  ]);
  const malformedJsonFallback = selectionFallbackModule.extractMalformedGroundedAnswerFallback([
    '"answer":"伊丽莎白时代文学可以从戏剧和出版文化理解", "citationChunkIds":['
  ]);
  const emptyFallback = selectionFallbackModule.extractMalformedGroundedAnswerFallback(["   ", "```json\n{\n```"]);

  assert.equal(parsed.answer, "有效 JSON 回答");
  assert.equal(parsed.citationChunkIds.join(","), "chunk-1");
  assert.equal(fallbackText, "伊丽莎白时代的文学通常与戏剧、诗歌和宫廷文化相关。");
  assert.equal(malformedJsonFallback, "伊丽莎白时代文学可以从戏剧和出版文化理解");
  assert.equal(emptyFallback, "");
}

{
  const simpleDecision = searchIntentModule.classifySelectionSearchIntent({
    ...baseSelectionRequest,
    question: "这句话是什么意思？",
    selectedText: "opened the door"
  });
  const reflectionDecision = searchIntentModule.classifySelectionSearchIntent({
    ...baseSelectionRequest,
    question: "写一点读后感",
    selectedText: "a room of one's own"
  });
  const ambiguousDecision = searchIntentModule.classifySelectionSearchIntent({
    ...baseSelectionRequest,
    question: "再讲讲",
    selectedText: "material conditions"
  });

  assert.equal(simpleDecision.mode, "none");
  assert.equal(simpleDecision.allowedProviders.length, 0);
  assert.equal(reflectionDecision.mode, "none");
  assert.equal(ambiguousDecision.mode, "none");
}

{
  const decision = searchIntentModule.classifySelectionSearchIntent({
    ...baseSelectionRequest,
    paragraphText: "她提到西多会，像是在召唤一个中世纪修会的背景。",
    selectedText: "西多会",
    question: "西多会是什么？"
  });

  assert.equal(decision.mode, "background_lead");
  assert.equal(decision.reason, "short_named_entity_background_question");
  assert.equal(decision.allowedProviders.includes("wikipedia"), true);
  assert.equal(decision.allowedProviders.includes("semantic_scholar"), false);
  assert.equal(decision.maxWaitMs > 0 && decision.maxWaitMs <= 5000, true);
}

{
  const decision = searchIntentModule.classifySelectionSearchIntent({
    ...baseSelectionRequest,
    paragraphText: "这一段很长，谈到战争、财产、继承、大学和女性生活处境，并不适合作为搜索词。",
    selectedText: "这一段很长，谈到战争、财产、继承、大学和女性生活处境，并不适合作为搜索词。",
    question: "百年大战是什么？"
  });

  assert.equal(decision.mode, "background_lead");
  assert.equal(decision.reason, "question_entity_background_question");
  assert.equal(decision.searchEntity, "百年大战");
  assert.equal(decision.allowedProviders.includes("wikipedia"), true);
}

{
  const decision = searchIntentModule.classifySelectionSearchIntent({
    ...baseSelectionRequest,
    paragraphText: "这一整段列举了许多戏剧人物和古典典故，选区本身不是一个短实体。",
    selectedText: "这一整段列举了许多戏剧人物和古典典故，选区本身不是一个短实体。",
    question: "克吕泰涅斯特拉是谁？"
  });

  assert.equal(decision.mode, "background_lead");
  assert.equal(decision.reason, "question_entity_background_question");
  assert.equal(decision.searchEntity, "克吕泰涅斯特拉");
  assert.equal(decision.allowedProviders.includes("wikipedia"), true);
}

{
  const decision = searchIntentModule.classifySelectionSearchIntent({
    ...baseSelectionRequest,
    paragraphText: "这一段很长，谈到历史和女性。",
    selectedText: "这一段很长，谈到历史和女性。",
    question: "这是什么背景？"
  });

  assert.equal(decision.mode, "none");
  assert.equal(decision.reason, "background_phrase_without_searchable_selected_entity");
}

{
  const decision = searchIntentModule.classifySelectionSearchIntent({
    ...baseSelectionRequest,
    bookTitle: "某本中文书",
    selectedText: "某本中文书",
    question: "这本书的ISBN和馆藏记录是什么？"
  });

  assert.equal(decision.mode, "bibliography");
  assert.equal(decision.allowedProviders.includes("worldcat"), true);
  assert.equal(decision.allowedProviders.includes("wikipedia"), false);
}

{
  const decision = searchIntentModule.classifySelectionSearchIntent({
    ...baseSelectionRequest,
    selectedText: "西多会",
    question: "西多会有什么学者观点，需要论文支撑？"
  });

  assert.equal(decision.mode, "academic_evidence");
  assert.equal(decision.allowedProviders.includes("semantic_scholar"), true);
  assert.equal(decision.allowedProviders.includes("nssd"), true);
  assert.equal(decision.searchEntity, undefined);
  assert.equal(searchIntentModule.shouldAttemptAcademicEvidence(decision), true);
  assert.equal(searchIntentModule.shouldAttemptExternalSearch(decision), true);
}

{
  const decision = searchIntentModule.classifySelectionSearchIntent({
    ...baseSelectionRequest,
    paragraphText: "读完这些书，我很想看看窗外，看看1928年10月26日清晨的伦敦正在发生什么。",
    selectedText: "读完这些书，我很想看看窗外，看看1928年10月26日清晨的伦敦正在发生什么。",
    question: "18世纪的伦敦是什么样的？需要有学术文献支撑"
  });

  assert.equal(decision.mode, "academic_evidence");
  assert.equal(decision.reason, "explicit_academic_or_source_backed_request");
}

{
  const trigger = triggerModule.detectAcademicTrigger(baseRequest);
  const keywordResult = await keywordsModule.buildAcademicSearchKeywords(baseRequest, trigger, {
    generator: async () => ({
      keywords: {
        primary: ["Virginia Woolf feminism", "https://bad.example/source"],
        secondary: ["women and education"],
        chinese: ["伍尔夫女性主义"],
        english: ["A Room of One's Own"]
      },
      title: "A fabricated paper title that must be ignored",
      url: "https://example.com/fabricated"
    })
  });

  assert.equal(trigger.shouldRetrieve, true);
  assert.equal(trigger.reasons.includes("explicit_user_request"), true);
  assert.equal(trigger.themes.includes("女性主义"), true);
  assert.equal(keywordResult.intentType, "literary_theory");
  assert.equal(keywordResult.searchScope, "trusted_academic_sources_only");
  assert.equal(keywordResult.fallbackUsed, false);
  assert.equal(keywordResult.keywords.primary.includes("Virginia Woolf feminism"), true);
  assert.equal(keywordResult.keywords.primary.some((keyword) => /https?:\/\//i.test(keyword)), false);
}

{
  const request = {
    ...baseRequest,
    paragraphText: "读完这些书，我很想看看窗外，看看1928年10月26日清晨的伦敦正在发生什么。",
    selectedText: "读完这些书，我很想看看窗外，看看1928年10月26日清晨的伦敦正在发生什么。",
    question: "18世纪的伦敦是什么样的？需要有学术文献支撑"
  };
  const trigger = triggerModule.detectAcademicTrigger(request);
  const keywordResult = await keywordsModule.buildAcademicSearchKeywords(request, trigger);
  const queries = keywordsModule.buildAcademicRetrievalQueriesFromKeywords(keywordResult, trigger);

  assert.equal(trigger.shouldRetrieve, true);
  assert.equal(keywordResult.intentType, "historical_event_context");
  assert.equal(keywordResult.keywords.primary.includes("18世纪伦敦"), true);
  assert.equal(keywordResult.keywords.english.includes("eighteenth-century London"), true);
  assert.equal(keywordResult.keywords.english.includes("Georgian London"), true);
  assert.equal(keywordResult.keywords.primary.some((keyword) => /1928年10月26日/.test(keyword)), false);
  assert.equal(queries.some((query) => /eighteenth-century London|Georgian London|18世纪伦敦/i.test(query.query)), true);
  assert.equal(queries.some((query) => /1928年10月26日/.test(query.query)), false);
}

{
  const trigger = triggerModule.detectAcademicTrigger({
    ...baseRequest,
    paragraphText: "She walked down the road and opened the door.",
    selectedText: "opened the door",
    question: "这句是什么意思？"
  });

  assert.equal(trigger.shouldRetrieve, false);
}

{
  const request = {
    ...baseRequest,
    paragraphText: "她提到西多会，像是在召唤一个中世纪修会的背景。",
    selectedText: "西多会",
    question: "西多会是什么？"
  };
  const trigger = triggerModule.detectAcademicTrigger(request);
  const keywordResult = await keywordsModule.buildAcademicSearchKeywords(request, trigger);
  const queries = keywordsModule.buildAcademicRetrievalQueriesFromKeywords(keywordResult, trigger);

  assert.equal(trigger.shouldRetrieve, true);
  assert.equal(keywordResult.intentType, "named_entity_background");
  assert.equal(keywordResult.fallbackUsed, true);
  assert.equal(keywordResult.keywords.chinese.includes("西多会"), true);
  assert.equal(keywordResult.keywords.english.includes("Cistercian Order"), true);
  assert.equal(queries.some((query) => /Cistercian Order|Cistercians/i.test(query.query)), true);
  assert.equal(queries.some((query) => /西多会/.test(query.query)), true);
  assert.equal(queries.length <= keywordsModule.ACADEMIC_KEYWORD_LIMITS.queryCount, true);
  assert.equal(queries.every((query) => query.query.length <= keywordsModule.ACADEMIC_KEYWORD_LIMITS.queryLength), true);
}

{
  const request = {
    ...baseRequest,
    paragraphText: "这一段把十字军东征当作一种历史记忆来调用。",
    selectedText: "十字军东征",
    question: "十字军东征呢？"
  };
  const trigger = triggerModule.detectAcademicTrigger(request);
  const keywordResult = await keywordsModule.buildAcademicSearchKeywords(request, trigger);

  assert.equal(trigger.shouldRetrieve, true);
  assert.equal(keywordResult.intentType, "historical_event_context");
  assert.equal(keywordResult.keywords.chinese.includes("十字军东征"), true);
  assert.equal(keywordResult.keywords.english.includes("Crusades"), true);
  assert.equal(keywordResult.keywords.english.includes("medieval history"), true);
}

{
  const request = {
    ...baseRequest,
    paragraphText: "这里提到莎士比亚作为戏剧传统的参照。",
    selectedText: "莎士比亚",
    question: "莎士比亚写过哪些权威戏剧，需要权威数据支撑"
  };
  const trigger = triggerModule.detectAcademicTrigger(request);
  const keywordResult = await keywordsModule.buildAcademicSearchKeywords(request, trigger);
  const queries = keywordsModule.buildAcademicRetrievalQueriesFromKeywords(keywordResult, trigger);

  assert.equal(trigger.shouldRetrieve, true);
  assert.equal(keywordResult.keywords.english.includes("William Shakespeare plays"), true);
  assert.equal(queries.some((query) => /William Shakespeare plays|Shakespeare canon/i.test(query.query)), true);
}

{
  const request = {
    ...baseRequest,
    bookTitle: "简·爱",
    chapterTitle: "第一章",
    paragraphText: "《简·爱》",
    selectedText: "《简·爱》",
    question: "介绍这本书，需要有权威来源"
  };
  const trigger = triggerModule.detectAcademicTrigger(request);
  const keywordResult = await keywordsModule.buildAcademicSearchKeywords(request, trigger);
  const queries = keywordsModule.buildAcademicRetrievalQueriesFromKeywords(keywordResult, trigger);

  assert.equal(trigger.shouldRetrieve, true);
  assert.equal(trigger.themes.includes("《简·爱》"), true);
  assert.equal(keywordResult.keywords.english.includes("Jane Eyre"), true);
  assert.equal(keywordResult.keywords.english.includes("Charlotte Bronte"), true);
  assert.equal(queries.some((query) => /Jane Eyre|Charlotte Bronte/i.test(query.query)), true);
}

{
  const request = {
    ...baseRequest,
    paragraphText: "Woolf links material conditions with women's education.",
    selectedText: "women's education",
    question: "这和伍尔夫的生平有关吗？"
  };
  const trigger = triggerModule.detectAcademicTrigger(request);
  const keywordResult = await keywordsModule.buildAcademicSearchKeywords(request, trigger);

  assert.equal(keywordResult.intentType, "author_context");
  assert.equal(keywordResult.keywords.english.includes("Virginia Woolf"), true);
  assert.equal(keywordResult.keywords.english.some((keyword) => /biography|Bloomsbury/i.test(keyword)), true);
}

{
  const request = {
    ...baseRequest,
    paragraphText: "The line opens questions of identity, class, and cultural memory.",
    selectedText: "cultural memory",
    question: "有没有文化研究角度的背景？"
  };
  const trigger = triggerModule.detectAcademicTrigger(request);
  const keywordResult = await keywordsModule.buildAcademicSearchKeywords(request, trigger, {
    generator: async () => {
      throw new Error("malformed model output");
    }
  });

  assert.equal(keywordResult.intentType, "cultural_context");
  assert.equal(keywordResult.fallbackUsed, true);
  assert.equal(keywordResult.keywords.secondary.includes("哲学或文化研究"), true);
}

{
  const trigger = triggerModule.detectAcademicTrigger({
    ...baseRequest,
    paragraphText: "戏剧中有克吕泰涅斯特拉。",
    selectedText: "克吕泰涅斯特拉",
    question: "这是谁？"
  });
  const queries = triggerModule.buildAcademicRetrievalQueries(
    {
      ...baseRequest,
      paragraphText: "戏剧中有克吕泰涅斯特拉。",
      selectedText: "克吕泰涅斯特拉",
      question: "这是谁？"
    },
    trigger
  );

  assert.equal(trigger.shouldRetrieve, true);
  assert.equal(trigger.reasons.includes("named_entity_background_context"), true);
  assert.equal(trigger.reasons.includes("explicit_user_request"), true);
  assert.equal(trigger.themes.includes("专名或背景语境"), true);
  assert.equal(trigger.themes.includes("文学典故或古典语境"), true);
  assert.equal(queries.some((query) => /classical allusion Greek tragedy myth literary criticism/i.test(query.query)), true);
}

{
  const trigger = triggerModule.detectAcademicTrigger({
    ...baseRequest,
    paragraphText: "她提到布卢姆斯伯里，仿佛那是一种隐秘的坐标。",
    selectedText: "布卢姆斯伯里",
    question: "这是什么背景？"
  });

  assert.equal(trigger.shouldRetrieve, true);
  assert.equal(trigger.reasons.includes("named_entity_background_context"), true);
  assert.equal(trigger.themes.includes("专名或背景语境"), true);
}

{
  assert.equal(policyModule.isTrustedAcademicHost("https://muse.jhu.edu/article/123"), true);
  assert.equal(policyModule.isTrustedAcademicHost("https://baike.baidu.com/item/%E7%AE%80%C2%B7%E7%88%B1"), true);
  assert.equal(policyModule.isTrustedAcademicHost("https://zh.wikipedia.org/wiki/Jane_Eyre"), true);
  assert.equal(policyModule.isTrustedAcademicHost("https://www.ncpssd.org/Literature/articleinfo?id=123"), true);
  assert.equal(policyModule.isTrustedAcademicHost("https://www.nssd.cn/html/1/156/159/index.html"), true);
  assert.equal(policyModule.isTrustedAcademicHost("https://www.nlc.cn/"), true);
  assert.equal(policyModule.isTrustedAcademicHost("https://ucdrs.superlib.net/"), true);
  assert.equal(policyModule.isTrustedAcademicHost("https://search.worldcat.org/title/123"), true);
  assert.equal(policyModule.isTrustedAcademicHost("https://isbn.ncl.edu.tw/NEW_ISBNNet/"), true);
  assert.equal(policyModule.isTrustedAcademicHost("https://www.wanfangdata.com.cn/details/detail.do?id=123"), true);
  assert.equal(policyModule.isTrustedAcademicHost("https://www.cqvip.com/qk/123"), true);
  assert.equal(policyModule.isTrustedAcademicHost("https://www.chaoxing.com/"), true);
  assert.equal(policyModule.isTrustedAcademicHost("https://example-blog.wordpress.com/post"), false);
  assert.equal(policyModule.isBackgroundReferenceProvider("baidu_baike"), true);
  assert.equal(policyModule.isBackgroundReferenceProvider("wikipedia"), true);
  assert.deepEqual(
    Array.from(sourcePolicyModule.ACADEMIC_EVIDENCE_TYPES),
    [
      "academic_paper",
      "academic_book",
      "bibliography_record",
      "publisher_page",
      "encyclopedia_lead",
      "archive_record",
      "low_quality_web"
    ]
  );
  assert.equal(sourcePolicyModule.SOURCE_DISPLAY_LABELS.academic_recommendation, "学术关联推荐");
  assert.equal(sourcePolicyModule.LICENSED_CHINESE_ACADEMIC_PROVIDER_NOTE.includes("CNKI"), true);
  assert.equal(sourcePolicyModule.getSourceDisplayPolicy("nssd").canDisplayAsAcademicEvidence, true);
  assert.equal(sourcePolicyModule.getSourceDisplayPolicy("worldcat").canDisplayAsAcademicEvidence, false);
  assert.equal(sourcePolicyModule.getSourceDisplayPolicy("worldcat").canDisplayAsBibliography, true);
  assert.equal(sourcePolicyModule.getSourceDisplayPolicy("baidu_baike").canDisplayAsBackgroundLead, true);
  assert.equal(sourcePolicyModule.getSourceDisplayPolicy("baidu_baike").canDisplayAsAcademicEvidence, false);
  assert.equal(sourcePolicyModule.getSourceDisplayPolicy("internet_archive").canDisplayAsAcademicEvidence, false);
  assert.equal(sourcePolicyModule.shouldUseInternetArchiveForQuery("人生的冒险 现代中文小说"), false);
  assert.equal(sourcePolicyModule.shouldUseInternetArchiveForQuery("红楼梦 古籍 影印 版本"), true);
  assert.equal(sourcePolicyModule.buildChineseTrustedSourceFailureMessage("zh"), "已尝试检索中文可信来源，但没有找到足够可靠、可验证的权威资料。");
}

{
  const candidates = validationModule.filterVerifiedAcademicCandidates(
    [
      {
        provider: "semantic_scholar",
        title: "Virginia Woolf and Feminist Literary Theory",
        sourceName: "Modern Fiction Studies",
        url: "https://www.semanticscholar.org/paper/example",
        authors: ["Scholar A"],
        abstractOrSnippet: "This article discusses feminist literary theory, women, fiction, and Woolf's modernist prose.",
        year: 2020,
        externalId: "paper-1"
      },
      {
        provider: "publisher_or_journal",
        title: "Unsourced summary about Woolf",
        sourceName: "Random Blog",
        url: "https://random-blog.wordpress.com/woolf",
        authors: [],
        abstractOrSnippet: "女性主义 and Woolf with no reliable source.",
        year: null,
        externalId: "bad-1"
      }
    ],
    ["女性主义", "feminist"]
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].externalId, "paper-1");
}

{
  const candidates = validationModule.filterVerifiedAcademicCandidates(
    [
      {
        provider: "semantic_scholar",
        title: "Clytemnestra and Greek Tragedy",
        sourceName: "Classical Philology",
        url: "https://www.semanticscholar.org/paper/classical-example",
        authors: ["Scholar C"],
        abstractOrSnippet: "This article reads Clytemnestra in Greek tragedy, myth, and classical literary criticism.",
        year: 2019,
        externalId: "classical-1"
      }
    ],
    ["文学典故或古典语境"]
  );

  assert.equal(candidates.length, 1);
}

{
  const nssdPaper = {
    provider: "nssd",
    evidenceType: "academic_paper",
    title: "中国现代文学中的人生叙事研究",
    sourceName: "国家哲学社会科学文献中心",
    url: "https://www.ncpssd.org/Literature/articleinfo?id=paper-1",
    authors: ["研究者甲"],
    abstractOrSnippet: "本文围绕中国现代文学中的人生叙事、现代性经验与文学史语境展开学术分析，并讨论作品中的冒险主题。",
    year: 2021,
    keywords: ["中国现代文学", "人生叙事"],
    language: "zh",
    confidence: "high",
    externalId: "nssd-paper-1"
  };
  const normalized = sourcePolicyModule.normalizeChineseTrustedSourceCandidate(nssdPaper);
  const candidates = validationModule.filterVerifiedAcademicCandidates([nssdPaper], ["中国现代文学", "人生叙事"]);

  assert.equal(normalized.evidenceType, "academic_paper");
  assert.equal(sourcePolicyModule.canUseAsAcademicEvidence(nssdPaper), true);
  assert.equal(sourcePolicyModule.getCandidateDisplayClass(nssdPaper), "academic_recommendation");
  assert.equal(validationModule.classifyAcademicSourceDisplay(nssdPaper), "academic_recommendation");
  assert.equal(candidates.length, 1);
}

{
  const academicBook = {
    provider: "publisher_or_journal",
    evidenceType: "academic_book",
    title: "中国当代文学研究",
    sourceName: "大学出版社",
    url: "https://www.cambridge.org/example",
    authors: ["研究者乙"],
    abstractOrSnippet: "A scholarly monograph about Chinese literature, Chinese contemporary literature, literary institutions, and modern reading culture.",
    year: 2019,
    keywords: ["Chinese literature"],
    language: "zh",
    confidence: "high",
    externalId: "academic-book-1"
  };
  const candidates = validationModule.filterVerifiedAcademicCandidates([academicBook], ["Chinese literature"]);

  assert.equal(sourcePolicyModule.getCandidateDisplayClass(academicBook), "academic_recommendation");
  assert.equal(candidates.length, 1);
}

{
  const bibliographyRecords = [
    {
      provider: "worldcat",
      evidenceType: "bibliography_record",
      title: "人生的冒险",
      sourceName: "WorldCat",
      url: "https://search.worldcat.org/title/123",
      authors: ["作者甲"],
      abstractOrSnippet: "WorldCat bibliography and holdings metadata for a Chinese book edition.",
      year: 2020,
      keywords: ["ISBN", "馆藏"],
      language: "zh",
      confidence: "high",
      externalId: "worldcat-1"
    },
    {
      provider: "national_library",
      evidenceType: "bibliography_record",
      title: "人生的冒险",
      sourceName: "国家图书馆",
      url: "https://www.nlc.cn/",
      authors: ["作者甲"],
      abstractOrSnippet: "国家图书馆馆藏与出版记录，可用于书目信息核验。",
      year: 2020,
      keywords: ["馆藏", "出版"],
      language: "zh",
      confidence: "high",
      externalId: "nlc-1"
    },
    {
      provider: "taiwan_new_books",
      evidenceType: "bibliography_record",
      title: "人生的冒险",
      sourceName: "全國新書資訊網",
      url: "https://isbn.ncl.edu.tw/NEW_ISBNNet/",
      authors: ["作者甲"],
      abstractOrSnippet: "ISBN and new-book metadata for publication verification.",
      year: 2020,
      keywords: ["ISBN"],
      language: "zh",
      confidence: "medium",
      externalId: "tw-isbn-1"
    }
  ];

  for (const record of bibliographyRecords) {
    assert.equal(sourcePolicyModule.getCandidateDisplayClass(record), "bibliography_information");
    assert.equal(sourcePolicyModule.canUseAsAcademicEvidence(record), false);
  }

  assert.equal(validationModule.filterVerifiedAcademicCandidates(bibliographyRecords, ["人生的冒险"]).length, 0);
}

{
  const leads = [
    {
      provider: "baidu_baike",
      evidenceType: "encyclopedia_lead",
      title: "简·爱",
      sourceName: "百度百科",
      url: "https://baike.baidu.com/item/简·爱",
      authors: [],
      abstractOrSnippet: "《简·爱》是英国女作家夏洛蒂·勃朗特创作的长篇小说。",
      year: null,
      language: "zh",
      confidence: "medium",
      externalId: "baike-jane-eyre"
    },
    {
      provider: "wikipedia",
      evidenceType: "encyclopedia_lead",
      title: "Jane Eyre",
      sourceName: "Wikipedia",
      url: "https://en.wikipedia.org/wiki/Jane_Eyre",
      authors: [],
      abstractOrSnippet: "Jane Eyre is a novel by Charlotte Bronte.",
      year: null,
      language: "en",
      confidence: "medium",
      externalId: "wiki-jane-eyre"
    }
  ];

  for (const lead of leads) {
    assert.equal(sourcePolicyModule.getCandidateDisplayClass(lead), "background_lead");
    assert.equal(sourcePolicyModule.canUseAsAcademicEvidence(lead), false);
  }
}

{
  const provider = new providerRuntimeModule.WikipediaEncyclopediaProvider({
    fetchFn: async (url) => {
      assert.match(url, /zh\.wikipedia\.org/);
      assert.match(url, /srsearch=%E8%A5%BF%E5%A4%9A%E4%BC%9A/);
      return {
        ok: true,
        async json() {
          return {
            query: {
              search: [
                {
                  pageid: 123,
                  title: "西多会",
                  snippet: "<span>西多会</span>，又称熙笃会，是天主教修会。"
                }
              ]
            }
          };
        }
      };
    }
  });
  const query = providerRuntimeModule.normalizeAcademicProviderQuery({
    query: "西多会是什么？",
    keywords: ["西多会", "Cistercian Order"]
  });
  const results = await provider.search(query, {
    allowNetwork: true,
    maxResults: 3
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].provider, "wikipedia");
  assert.equal(results[0].evidenceType, "encyclopedia_lead");
  assert.equal(results[0].canUseAsBackgroundLead, true);
  assert.equal(results[0].canUseAsAcademicEvidence, false);
  assert.equal(results[0].canUseAsBibliography, false);
  assert.equal(sourcePolicyModule.getCandidateDisplayClass(results[0]), "background_lead");
  const sourceLead = validationModule.toAcademicSourceLead(results[0]);
  assert.equal(sourceLead?.displayClass, "background_lead");
  assert.equal(sourceLead?.label, "背景线索");
  assert.equal(validationModule.filterVerifiedAcademicCandidates(results, ["西多会"]).length, 0);
}

{
  const requestedSearches = [];
  const provider = new providerRuntimeModule.WikipediaEncyclopediaProvider({
    fetchFn: async (url) => {
      requestedSearches.push(url);
      return {
        ok: true,
        async json() {
          return {
            query: {
              search: [
                {
                  pageid: 287162,
                  title: "熙笃会",
                  snippet: "熙笃会是一个天主教修会，又称西多会。"
                }
              ]
            }
          };
        }
      };
    }
  });
  const query = providerRuntimeModule.normalizeAcademicProviderQuery({
    retrievalQuery: {
      query: "西多会 Cistercian Order Cistercians medieval Europe monasticism",
      themes: ["专名或背景语境"],
      originalQuery: "西多会是什么？",
      selectedText: "西多会",
      keywords: ["西多会", "Cistercian Order"],
      intentType: "named_entity_background"
    }
  });
  const results = await provider.search(query, {
    allowNetwork: true,
    maxResults: 3
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].title, "熙笃会");
  assert.match(requestedSearches[0], /srsearch=%E8%A5%BF%E5%A4%9A%E4%BC%9A/);
}

{
  const wikiOnly = [
    {
      provider: "wikipedia",
      evidenceType: "encyclopedia_lead",
      title: "西多会",
      sourceName: "Wikipedia",
      url: "https://zh.wikipedia.org/wiki/%E8%A5%BF%E5%A4%9A%E4%BC%9A",
      authors: [],
      abstractOrSnippet: "西多会背景词条，可用于解释是什么，但不能作为学者观点。",
      year: null,
      keywords: ["西多会"],
      language: "zh",
      confidence: "medium",
      canUseAsAcademicEvidence: false,
      canUseAsBackgroundLead: true,
      canUseAsBibliography: false,
      externalId: "wiki-cistercian"
    }
  ];

  assert.equal(validationModule.filterVerifiedAcademicCandidates(wikiOnly, ["学者观点", "西多会"]).length, 0);
  assert.equal(sourcePolicyModule.getCandidateDisplayClass(wikiOnly[0]), "background_lead");
  assert.equal(sourcePolicyModule.SOURCE_DISPLAY_LABELS[sourcePolicyModule.getCandidateDisplayClass(wikiOnly[0])], "背景线索");
  assert.equal(validationModule.buildAcademicSourceLeads(wikiOnly).length, 1);
}

{
  const provider = new providerRuntimeModule.WorldCatBibliographyProvider({
    env: {
      ENABLE_WORLDCAT_PROVIDER: "true",
      WORLDCAT_ACCESS_TOKEN: "test-token",
      WORLDCAT_API_BASE_URL: "https://example.test/worldcat/v2/bibs"
    },
    fetchFn: async (url, init) => {
      assert.match(url, /worldcat\/v2\/bibs/);
      assert.equal(init.headers.Authorization, "Bearer test-token");
      return {
        ok: true,
        async json() {
          return {
            bibs: [
              {
                id: "oclc-1",
                title: "某本中文书",
                authors: [{ name: "作者甲" }],
                date: "2020",
                url: "https://search.worldcat.org/title/1",
                description: "WorldCat bibliography and holdings metadata."
              }
            ]
          };
        }
      };
    }
  });
  const query = providerRuntimeModule.normalizeAcademicProviderQuery({
    query: "《某本中文书》有什么相关研究？",
    keywords: ["某本中文书", "相关研究"]
  });
  const results = await provider.search(query, {
    allowNetwork: true,
    maxResults: 3
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].provider, "worldcat");
  assert.equal(results[0].evidenceType, "bibliography_record");
  assert.equal(results[0].canUseAsBibliography, true);
  assert.equal(results[0].canUseAsAcademicEvidence, false);
  assert.equal(sourcePolicyModule.getCandidateDisplayClass(results[0]), "bibliography_information");
  assert.equal(validationModule.toAcademicSourceLead(results[0])?.label, "书目信息");
  assert.equal(validationModule.filterVerifiedAcademicCandidates(results, ["某本中文书"]).length, 0);

  const disabledProvider = new providerRuntimeModule.WorldCatBibliographyProvider({
    env: {
      ENABLE_WORLDCAT_PROVIDER: "true"
    },
    fetchFn: async () => {
      throw new Error("WorldCat should not fetch without credentials");
    }
  });
  const disabledResults = await disabledProvider.search(query);
  assert.equal(disabledResults.length, 0);
}

{
  const timedOutProvider = {
    id: "timeout_provider",
    displayName: "Timeout Provider",
    supportedLanguages: ["zh"],
    supportedEvidenceTypes: ["academic_paper"],
    async search() {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return [
        {
          provider: "mock",
          title: "Late result",
          sourceName: "Mock",
          url: "https://semanticscholar.org/paper/late",
          authors: ["Scholar"],
          abstractOrSnippet: "This result should not arrive before timeout.",
          year: 2020,
          externalId: "late"
        }
      ];
    }
  };
  const fastProvider = {
    id: "fast_provider",
    displayName: "Fast Provider",
    supportedLanguages: ["zh"],
    supportedEvidenceTypes: ["academic_paper"],
    async search() {
      return [
        {
          provider: "mock",
          title: "Fast academic result",
          sourceName: "Mock Academic Index",
          url: "https://semanticscholar.org/paper/fast",
          authors: ["Scholar"],
          abstractOrSnippet: "A fast academic result about Chinese literature and research.",
          year: 2021,
          externalId: "fast"
        }
      ];
    }
  };
  const query = providerRuntimeModule.normalizeAcademicProviderQuery({
    query: "中国文学相关研究"
  });
  const results = await providerRuntimeModule.searchAcademicProviders([timedOutProvider, fastProvider], query, {
    timeoutMs: 5,
    maxResults: 5
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].externalId, "fast");
}

{
  const whatIsQuery = providerRuntimeModule.normalizeAcademicProviderQuery({
    query: "西多会是什么？"
  });
  const researchQuery = providerRuntimeModule.normalizeAcademicProviderQuery({
    query: "《人生的冒险》有什么相关研究，需要学者观点？"
  });
  const contemporaryBookQuery = providerRuntimeModule.normalizeAcademicProviderQuery({
    query: "人生的冒险 现代中文书 相关研究"
  });
  const providers = [
    new providerRuntimeModule.WikipediaEncyclopediaProvider({ enabled: true }),
    new providerRuntimeModule.BaiduBaikeLeadProvider(),
    new providerRuntimeModule.NssdSocialScienceProvider(),
    new providerRuntimeModule.WorldCatBibliographyProvider({ env: {} }),
    {
      id: "internet_archive",
      displayName: "Internet Archive",
      supportedLanguages: ["zh", "en"],
      supportedEvidenceTypes: ["archive_record"],
      async search() {
        return [];
      }
    }
  ];

  const whatIsIds = providerRuntimeModule.selectAcademicProviders(whatIsQuery, providers).map((provider) => provider.id);
  const researchIds = providerRuntimeModule.selectAcademicProviders(researchQuery, providers).map((provider) => provider.id);
  const contemporaryIds = providerRuntimeModule.selectAcademicProviders(contemporaryBookQuery, providers).map((provider) => provider.id);
  const backgroundOnlyIds = providerRuntimeModule
    .selectAcademicProviders(whatIsQuery, providers, ["wikipedia", "baidu_baike"])
    .map((provider) => provider.id);
  const bibliographyOnlyIds = providerRuntimeModule
    .selectAcademicProviders(researchQuery, providers, ["worldcat"])
    .map((provider) => provider.id);

  assert.equal(whatIsIds[0], "wikipedia");
  assert.equal(whatIsIds.includes("baidu_baike"), true);
  assert.equal(researchIds.indexOf("nssd") < researchIds.indexOf("wikipedia"), true);
  assert.equal(researchIds.indexOf("worldcat") < researchIds.indexOf("wikipedia"), true);
  assert.equal(contemporaryIds.includes("internet_archive"), false);
  assert.equal(backgroundOnlyIds.join(","), "wikipedia,baidu_baike");
  assert.equal(bibliographyOnlyIds.join(","), "worldcat");
}

{
  const licensedProvider = new providerRuntimeModule.LicensedChineseAcademicProvider();
  const query = providerRuntimeModule.normalizeAcademicProviderQuery({
    query: "中文文学相关论文"
  });
  const results = await providerRuntimeModule.searchAcademicProviders(
    [
      licensedProvider,
      {
        id: "mock_fast",
        displayName: "Mock Fast",
        supportedLanguages: ["zh"],
        supportedEvidenceTypes: ["academic_paper"],
        async search() {
          return [
            {
              provider: "mock",
              title: "Mock Chinese academic paper",
              sourceName: "Mock Academic Index",
              url: "https://semanticscholar.org/paper/mock-chinese",
              authors: ["研究者"],
              abstractOrSnippet: "A mock academic paper about Chinese literature research and scholarly context.",
              year: 2022,
              externalId: "mock-chinese"
            }
          ];
        }
      }
    ],
    query,
    {
      timeoutMs: 20,
      maxResults: 5,
      allowNetwork: false
    }
  );

  assert.equal(await licensedProvider.search(query).then((items) => items.length), 0);
  assert.equal(results.length, 1);
  assert.equal(results[0].externalId, "mock-chinese");
}

{
  const publisherPage = {
    provider: "publisher_or_journal",
    evidenceType: "publisher_page",
    title: "人生的冒险",
    sourceName: "权威出版社",
    url: "https://www.oup.com/example",
    authors: ["作者甲"],
    abstractOrSnippet: "Official publisher page with publication background and book introduction.",
    year: 2020,
    keywords: ["出版信息"],
    language: "zh",
    confidence: "medium",
    externalId: "publisher-page-1"
  };

  assert.equal(sourcePolicyModule.getCandidateDisplayClass(publisherPage), "publication_information");
  assert.equal(sourcePolicyModule.canUseAsAcademicEvidence(publisherPage), false);
  assert.equal(validationModule.filterVerifiedAcademicCandidates([publisherPage], ["人生的冒险"]).length, 0);
}

{
  const archiveRecord = {
    provider: "internet_archive",
    evidenceType: "archive_record",
    title: "A public domain Chinese classic scan",
    sourceName: "Internet Archive",
    url: "https://archive.org/details/classic-scan",
    authors: ["作者丙"],
    abstractOrSnippet: "A scanned public-domain edition record useful for archive and version context.",
    year: 1920,
    keywords: ["scan", "edition"],
    language: "zh",
    confidence: "medium",
    externalId: "ia-archive-1"
  };

  assert.equal(sourcePolicyModule.getCandidateDisplayClass(archiveRecord), "archive_lead");
  assert.equal(sourcePolicyModule.canUseAsAcademicEvidence(archiveRecord), false);
  assert.equal(validationModule.filterVerifiedAcademicCandidates([archiveRecord], ["edition"]).length, 0);
}

{
  const lowQualityCandidates = [
    {
      provider: "internet_archive",
      evidenceType: "archive_record",
      title: "转生恶役贵族，异世界求生记",
      sourceName: "Internet Archive",
      url: "https://archive.org/details/fanqienovel-7329807622788353086",
      authors: ["沧天一粟"],
      abstractOrSnippet: "番茄小说 非爽文 日式西幻 异世界 无系统 被迫成长流。",
      year: 2024,
      language: "zh",
      confidence: "low",
      externalId: "fanqie-1"
    },
    {
      provider: "publisher_or_journal",
      evidenceType: "low_quality_web",
      title: "AI生成的书评聚合页",
      sourceName: "Content Farm",
      url: "https://content-farm.example/book",
      authors: [],
      abstractOrSnippet: "AI生成 无来源 无日期 营销号内容。",
      year: null,
      language: "zh",
      confidence: "low",
      externalId: "content-farm-1"
    }
  ];

  for (const candidate of lowQualityCandidates) {
    assert.equal(sourcePolicyModule.isLowQualityWebCandidate(candidate), true);
    assert.equal(sourcePolicyModule.getCandidateDisplayClass(candidate), "suppressed");
    assert.equal(sourcePolicyModule.canUseAsAcademicEvidence(candidate), false);
  }

  assert.equal(validationModule.filterVerifiedAcademicCandidates(lowQualityCandidates, ["人生的冒险"]).length, 0);
}

{
  const incompleteAcademicPaper = {
    provider: "nssd",
    evidenceType: "academic_paper",
    title: "中国文学研究",
    sourceName: "",
    url: null,
    authors: [],
    abstractOrSnippet: "",
    year: null,
    keywords: [],
    language: "zh",
    confidence: "low",
    externalId: "incomplete-1"
  };

  assert.equal(sourcePolicyModule.hasChineseTrustedSourceMetadata(sourcePolicyModule.normalizeChineseTrustedSourceCandidate(incompleteAcademicPaper)), false);
  assert.equal(sourcePolicyModule.canUseAsAcademicEvidence(incompleteAcademicPaper), false);
}

{
  const candidates = validationModule.filterVerifiedAcademicCandidates(
    [
      {
        provider: "wikipedia",
        title: "Jane Eyre",
        sourceName: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Jane_Eyre",
        authors: [],
        abstractOrSnippet: "Jane Eyre is a novel by the English writer Charlotte Bronte.",
        year: null,
        externalId: "wiki-jane-eyre"
      },
      {
        provider: "baidu_baike",
        title: "简·爱",
        sourceName: "百度百科",
        url: "https://baike.baidu.com/item/简·爱",
        authors: [],
        abstractOrSnippet: "《简·爱》是英国女作家夏洛蒂·勃朗特创作的长篇小说。",
        year: null,
        externalId: "baike-jane-eyre"
      }
    ],
    ["《简·爱》"]
  );

  assert.equal(candidates.length, 0);
}

{
  const candidates = validationModule.filterVerifiedAcademicCandidates(
    [
      {
        provider: "mock",
        title: "Jane Eyre and the Victorian novel",
        sourceName: "Mock Academic Index",
        url: "https://semanticscholar.org/paper/jane-eyre",
        authors: ["Scholar E"],
        abstractOrSnippet: "A scholarly overview of Jane Eyre, Charlotte Bronte, and the Victorian novel tradition.",
        year: 2022,
        externalId: "jane-eyre-1"
      }
    ],
    ["《简·爱》"]
  );

  assert.equal(candidates.length, 1);
}

{
  const candidates = validationModule.filterVerifiedAcademicCandidates(
    [
      {
        provider: "mock",
        title: "William Shakespeare plays and the early modern drama canon",
        sourceName: "Mock Academic Index",
        url: "https://semanticscholar.org/paper/shakespeare",
        authors: ["Scholar D"],
        abstractOrSnippet: "A scholarly reference entry about William Shakespeare, plays, drama, and the early modern canon.",
        year: 2021,
        externalId: "shakespeare-1"
      }
    ],
    ["莎士比亚"]
  );

  assert.equal(candidates.length, 1);
}

{
  const workflowMocks = {
    "@/lib/academic-recommendations/data": {
      buildAcademicRecommendationCacheKey: () => "cache-key",
      getCachedAcademicRecommendations: async () => null,
      cacheAcademicRecommendations: async () => {}
    },
    "@/lib/academic-recommendations/providers": {
      createTrustedAcademicProvider: () => ({
        search: async () => []
      })
    },
    "@/lib/memory/data": {
      loadAiMemoryContext: async () => "Reader memory: preference guidance only, not citation evidence."
    }
  };
  const workflowModule = compileModule("lib/academic-recommendations/workflow.ts", workflowMocks);
  const receivedQueries = [];
  const mockProvider = {
    async search(queries) {
      receivedQueries.push(...queries);
      return [
        {
          provider: "mock",
          title: "A Room of One's Own and Feminist Thought",
          sourceName: "Mock Academic Index",
          url: "https://semanticscholar.org/paper/mock",
          authors: ["Scholar B"],
          abstractOrSnippet: "A reliable academic abstract about feminist thought, women, fiction, and Woolf.",
          year: 2018,
          externalId: "mock-1"
        }
      ];
    }
  };
  const result = await workflowModule.runAcademicRecommendationWorkflow(baseRequest, mockProvider);

  assert.equal(result.shouldDisplay, true);
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].title, "A Room of One's Own and Feminist Thought");
  assert.equal(receivedQueries.length > 0, true);
  assert.equal(receivedQueries.some((query) => /Virginia Woolf|feminism|women/i.test(query.query)), true);

  const emptyResult = await workflowModule.runAcademicRecommendationWorkflow(
    {
      ...baseRequest,
      paragraphText: "She walked down the road and opened the door.",
      selectedText: "opened the door",
      question: "这句是什么意思？"
    },
    mockProvider
  );

  assert.equal(emptyResult.shouldDisplay, false);
  assert.equal(emptyResult.emptyReason, "not_relevant");

  const noSourceResult = await workflowModule.runAcademicRecommendationWorkflow(baseRequest, {
    async search() {
      return [];
    }
  });

  assert.equal(noSourceResult.shouldDisplay, false);
  assert.equal(noSourceResult.emptyReason, "no_reliable_sources");
  assert.equal(noSourceResult.sourceLeads.length, 0);

  const backgroundLeadResult = await workflowModule.runAcademicRecommendationWorkflow(
    {
      ...baseRequest,
      paragraphText: "她提到西多会，像是在召唤一个中世纪修会的背景。",
      selectedText: "西多会",
      question: "西多会是什么？"
    },
    {
      async search() {
        return [
          {
            provider: "wikipedia",
            evidenceType: "encyclopedia_lead",
            title: "西多会",
            sourceName: "Wikipedia",
            url: "https://zh.wikipedia.org/wiki/%E8%A5%BF%E5%A4%9A%E4%BC%9A",
            authors: [],
            abstractOrSnippet: "西多会是天主教修会，可作为背景线索解释术语来源。",
            year: null,
            keywords: ["西多会"],
            language: "zh",
            confidence: "medium",
            canUseAsAcademicEvidence: false,
            canUseAsBackgroundLead: true,
            canUseAsBibliography: false,
            externalId: "wiki-cistercian"
          }
        ];
      }
    }
  );

  assert.equal(backgroundLeadResult.shouldDisplay, false);
  assert.equal(backgroundLeadResult.recommendations.length, 0);
  assert.equal(backgroundLeadResult.sourceLeads.length, 1);
  assert.equal(backgroundLeadResult.sourceLeads[0].displayClass, "background_lead");
  assert.equal(backgroundLeadResult.sourceLeads[0].label, "背景线索");

  const bibliographyLeadResult = await workflowModule.runAcademicRecommendationWorkflow(baseRequest, {
    async search() {
      return [
        {
          provider: "worldcat",
          evidenceType: "bibliography_record",
          title: "A Room of One's Own",
          sourceName: "WorldCat",
          url: "https://search.worldcat.org/title/1",
          authors: ["Virginia Woolf"],
          abstractOrSnippet: "WorldCat bibliography metadata for a book edition.",
          year: 1929,
          keywords: ["bibliography"],
          language: "en",
          confidence: "medium",
          canUseAsAcademicEvidence: false,
          canUseAsBackgroundLead: true,
          canUseAsBibliography: true,
          externalId: "worldcat-room"
        }
      ];
    }
  });

  assert.equal(bibliographyLeadResult.recommendations.length, 0);
  assert.equal(bibliographyLeadResult.sourceLeads.length, 1);
  assert.equal(bibliographyLeadResult.sourceLeads[0].displayClass, "bibliography_information");
}

{
  const backgroundRequest = {
    ...baseRequest,
    paragraphText: "她提到西多会，像是在召唤一个中世纪修会的背景。",
    selectedText: "西多会",
    question: "西多会是啥？"
  };
  let requestedUrl = "";
  const leads = await backgroundLeadsModule.loadFastBackgroundSourceLeads(backgroundRequest, {
    timeoutMs: 1000,
    fetchFn: async (url) => {
      requestedUrl = String(url);
      return {
        ok: true,
        async json() {
          return {
            query: {
              search: [
                {
                  title: "西多会",
                  pageid: 287162,
                  snippet: "西多会是一个天主教修会，可作为背景线索解释术语。"
                }
              ]
            }
          };
        }
      };
    }
  });

  assert.equal(backgroundLeadsModule.shouldAttemptFastBackgroundLeads(backgroundRequest), true);
  assert.equal(backgroundLeadsModule.shouldUseFastBackgroundOnly(backgroundRequest), true);
  assert.equal(backgroundLeadsModule.shouldUseFastBackgroundOnly({ ...backgroundRequest, question: "西多会有什么学者观点？" }), false);
  assert.match(requestedUrl, /zh\.wikipedia\.org/);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].displayClass, "background_lead");
  assert.equal(leads[0].label, "背景线索");
}

{
  const backgroundRequest = {
    ...baseRequest,
    paragraphText: "这里提到西多会。",
    selectedText: "西多会",
    question: "西多会是什么？"
  };
  let rewriteCalled = false;
  const leads = await backgroundLeadsModule.loadFastBackgroundSourceLeads(backgroundRequest, {
    timeoutMs: 1000,
    rewriteGenerator: async () => {
      rewriteCalled = true;
      throw new Error("rewrite should not run after first-pass success");
    },
    fetchFn: async () => ({
      ok: true,
      async json() {
        return {
          query: {
            search: [
              {
                title: "西多会",
                pageid: 287162,
                snippet: "西多会是一个天主教修会，可作为背景线索解释术语。"
              }
            ]
          }
        };
      }
    })
  });

  assert.equal(leads.length, 1);
  assert.equal(rewriteCalled, false);
}

{
  const backgroundRequest = {
    ...baseRequest,
    paragraphText: "这一段很长，谈到战争、财产、继承、大学和女性生活处境，并不适合作为搜索词。",
    selectedText: "这一段很长，谈到战争、财产、继承、大学和女性生活处境，并不适合作为搜索词。",
    question: "百年大战是什么？"
  };
  let firstRequestedUrl = "";
  const leads = await backgroundLeadsModule.loadFastBackgroundSourceLeads(backgroundRequest, {
    timeoutMs: 1000,
    preferredSearchEntity: "百年大战",
    fetchFn: async (url) => {
      firstRequestedUrl ||= String(url);
      return {
        ok: true,
        async json() {
          return {
            query: {
              search: [
                {
                  title: "百年战争",
                  pageid: 12345,
                  snippet: "百年战争，又称百年大战，是英法之间的一系列冲突。"
                }
              ]
            }
          };
        }
      };
    }
  });

  assert.match(decodeURIComponent(firstRequestedUrl), /srsearch=百年大战/);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].displayClass, "background_lead");
}

{
  const backgroundRequest = {
    ...baseRequest,
    paragraphText: "这一段提到百年大战。",
    selectedText: "百年大战",
    question: "百年大战是什么？"
  };
  const leads = await backgroundLeadsModule.loadFastBackgroundSourceLeads(backgroundRequest, {
    timeoutMs: 1000,
    fetchFn: async () => ({
      ok: true,
      async json() {
        return {
          query: {
            search: [
              {
                title: "百年战争",
                pageid: 1,
                snippet: "百年战争背景线索一。"
              },
              {
                title: "英法百年战争",
                pageid: 2,
                snippet: "百年战争背景线索二。"
              },
              {
                title: "第三条不应进入快速背景结果",
                pageid: 3,
                snippet: "这条结果应被默认上限过滤。"
              }
            ]
          }
        };
      }
    })
  });

  assert.equal(leads.length, 2);
  assert.equal(leads.every((lead) => lead.displayClass === "background_lead"), true);
}

{
  const request = {
    ...baseRequest,
    paragraphText: "莎士比亚笔下的苔丝狄蒙娜在这一段被作为戏剧人物的例子。",
    selectedText: "苔丝狄蒙娜",
    question: "苔丝狄蒙娜是谁？"
  };
  const requestedUrls = [];
  const leads = await backgroundLeadsModule.loadFastBackgroundSourceLeads(request, {
    timeoutMs: 1000,
    rewriteTimeoutMs: 100,
    rewriteGenerator: async () =>
      JSON.stringify({
        searchTerms: ["苔丝狄蒙娜", "黛丝德蒙娜", "Desdemona", "奥赛罗 Desdemona"],
        entityType: "literary_character"
      }),
    fetchFn: async (url) => {
      const urlText = String(url);
      requestedUrls.push(urlText);
      const decoded = decodeURIComponent(urlText);

      return {
        ok: true,
        async json() {
          if (/Desdemona|奥赛罗 Desdemona/.test(decoded)) {
            return {
              query: {
                search: [
                  {
                    title: "苔丝狄蒙娜",
                    pageid: 1,
                    snippet: "苔丝狄蒙娜是莎士比亚戏剧《奥赛罗》中的人物。"
                  }
                ]
              }
            };
          }

          return { query: { search: [] } };
        }
      };
    }
  });

  assert.equal(
    requestedUrls.some((url) => /srsearch=Desdemona|奥赛罗 Desdemona/.test(decodeURIComponent(url.replace(/\+/g, " ")))),
    true
  );
  assert.equal(leads.length, 1);
  assert.equal(leads[0].displayClass, "background_lead");
  assert.equal(leads[0].label, "背景线索");
}

{
  const request = {
    ...baseRequest,
    paragraphText: "戏剧中有克吕泰涅斯特拉。",
    selectedText: "克吕泰涅斯特拉",
    question: "克吕泰涅斯特拉是谁？"
  };
  const rewrite = await backgroundRewriteModule.rewriteBackgroundSearchTerms(request, {
    timeoutMs: 100,
    generator: async () =>
      JSON.stringify({
        searchTerms: ["克吕泰涅斯特拉", "Clytemnestra"],
        entityType: "literary_character"
      })
  });

  assert.equal(rewrite.fallbackUsed, false);
  assert.equal(rewrite.searchTerms.includes("Clytemnestra"), true);
}

{
  const request = {
    ...baseRequest,
    selectedText: "苔丝狄蒙娜",
    question: "苔丝狄蒙娜是谁？"
  };
  const rewrite = await backgroundRewriteModule.rewriteBackgroundSearchTerms(request, {
    timeoutMs: 100,
    generator: async () =>
      JSON.stringify({
        searchTerms: [
          "苔丝狄蒙娜",
          "https://example.com/source",
          "某学者认为苔丝狄蒙娜象征服从",
          "Desdemona",
          "Wikipedia Desdemona"
        ],
        scholar: "Invented Scholar",
        paperTitle: "Invented Paper",
        sourceName: "Invented Journal",
        finalAnswer: "This must not become answer content."
      })
  });

  assert.equal(rewrite.searchTerms.includes("苔丝狄蒙娜"), true);
  assert.equal(rewrite.searchTerms.includes("Desdemona"), true);
  assert.equal(rewrite.searchTerms.some((term) => /https?:|学者|认为|Wikipedia|Invented/i.test(term)), false);
}

{
  const ordinaryRequest = {
    ...baseRequest,
    paragraphText: "She opened the door.",
    selectedText: "opened the door",
    question: "这句话是什么意思？"
  };
  let rewriteCalled = false;
  const leads = await backgroundLeadsModule.loadFastBackgroundSourceLeads(ordinaryRequest, {
    rewriteGenerator: async () => {
      rewriteCalled = true;
      return "{\"searchTerms\":[\"should not happen\"]}";
    },
    fetchFn: async () => {
      throw new Error("provider should not run for non-background candidate");
    }
  });

  assert.equal(searchIntentModule.classifySelectionSearchIntent({ ...baseSelectionRequest, ...ordinaryRequest }).mode, "none");
  assert.equal(leads.length, 0);
  assert.equal(rewriteCalled, false);
}

{
  const request = {
    ...baseRequest,
    paragraphText: "莎士比亚笔下的苔丝狄蒙娜在这一段被作为戏剧人物的例子。",
    selectedText: "苔丝狄蒙娜",
    question: "苔丝狄蒙娜是谁？"
  };
  const malformedRewrite = await backgroundRewriteModule.rewriteBackgroundSearchTerms(request, {
    timeoutMs: 100,
    generator: async () => "not json"
  });
  const timedOutRewrite = await backgroundRewriteModule.rewriteBackgroundSearchTerms(request, {
    timeoutMs: 5,
    generator: async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return JSON.stringify({ searchTerms: ["late"] });
    }
  });

  assert.equal(malformedRewrite.fallbackUsed, true);
  assert.equal(malformedRewrite.searchTerms.includes("Desdemona"), true);
  assert.equal(timedOutRewrite.fallbackUsed, true);
  assert.equal(timedOutRewrite.searchTerms.includes("Desdemona"), true);
}

{
  const bibliographyRequest = {
    ...baseRequest,
    bookTitle: "某本中文书",
    paragraphText: "这里提到某本中文书。",
    selectedText: "某本中文书",
    question: "这本书的ISBN和馆藏记录是什么？"
  };
  const previousToken = process.env.WORLDCAT_ACCESS_TOKEN;
  process.env.WORLDCAT_ACCESS_TOKEN = "test-token";
  let requestedUrl = "";
  const leads = await backgroundLeadsModule.loadBibliographySourceLeads(bibliographyRequest, {
    timeoutMs: 1000,
    allowedProviders: ["worldcat"],
    fetchFn: async (url) => {
      requestedUrl = String(url);
      return {
        ok: true,
        async json() {
          return {
            bibs: [
              {
                id: "oclc-1",
                title: "某本中文书",
                authors: [{ name: "作者甲" }],
                date: "2020",
                url: "https://search.worldcat.org/title/1",
                description: "WorldCat bibliography and holdings metadata."
              }
            ]
          };
        }
      };
    }
  });

  if (previousToken === undefined) {
    delete process.env.WORLDCAT_ACCESS_TOKEN;
  } else {
    process.env.WORLDCAT_ACCESS_TOKEN = previousToken;
  }

  assert.match(requestedUrl, /worldcat/);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].displayClass, "bibliography_information");
  assert.equal(leads[0].label, "书目信息");
}

{
  const routeSource = readFileSync(new URL("../app/api/academic-recommendations/route.ts", import.meta.url), "utf8");
  const selectionSource = readFileSync(new URL("../lib/ai/selection-workflow.ts", import.meta.url), "utf8");
  const readerSource = readFileSync(new URL("../components/reader/reader-shell.tsx", import.meta.url), "utf8");

  assert.match(routeSource, /getCurrentUser/);
  assert.match(routeSource, /getAccessibleReaderBook/);
  assert.match(selectionSource, /const RETRIEVAL_TOP_K = 3/);
  assert.match(selectionSource, /const MAX_PROMPT_CHUNK_CHARS = 420/);
  assert.match(selectionSource, /answerLengthMode === "default" \? 300 : 800/);
  assert.match(readFileSync(new URL("../lib/academic-recommendations/background-leads.ts", import.meta.url), "utf8"), /FAST_BACKGROUND_LEAD_TIMEOUT_MS[^]*1500/);
  assert.match(selectionSource, /classifySearchIntent/);
  assert.match(selectionSource, /classifySelectionSearchIntent/);
  assert.match(selectionSource, /academicToolAttempted: shouldAttemptAcademicEvidence\(state\.searchIntent\)/);
  assert.match(selectionSource, /我已尝试检索当前受信的学术来源/);
  assert.doesNotMatch(selectionSource, /runAcademicRecommendationsWithTimeout/);
  assert.doesNotMatch(selectionSource, /runAcademicRecommendationWorkflow/);
  assert.doesNotMatch(selectionSource, /No markdown fences\. No prose outside the JSON object/);
  assert.match(selectionSource, /loadFastBackgroundSourceLeads/);
  assert.match(selectionSource, /loadBibliographySourceLeads/);
  assert.match(selectionSource, /state\.searchIntent\.mode === "background_lead"/);
  assert.match(selectionSource, /state\.searchIntent\.mode === "bibliography"/);
  assert.match(selectionSource, /state\.searchIntent\.mode === "none"/);
  assert.match(selectionSource, /const MAX_PROMPT_SOURCE_LEADS = 2/);
  assert.match(selectionSource, /sourceLeads\.slice\(0, MAX_PROMPT_SOURCE_LEADS\)/);
  assert.match(selectionSource, /maxResults: 2/);
  assert.match(selectionSource, /maxResults: 1/);
  assert.match(selectionSource, /academic_workflow_paused_for_fast_path/);
  assert.match(selectionSource, /Verified external non-academic source leads are available/);
  assert.match(selectionSource, /Do not convert these leads into 学者认为, 学界认为, 论文指出/);
  assert.match(selectionSource, /do not define it from general model knowledge/);
  assert.match(selectionSource, /no verified external background lead is available/);
  assert.match(readFileSync(new URL("../app/api/ai/selection/route.ts", import.meta.url), "utf8"), /academicSourceLeadCount/);
  assert.match(readFileSync(new URL("../lib/academic-recommendations/keywords.ts", import.meta.url), "utf8"), /ACADEMIC_KEYWORD_MODEL_ENABLED/);
  const academicLoaderStart = selectionSource.indexOf('.addNode("loadAcademicRecommendations"');
  const generateAnswerStart = selectionSource.indexOf('.addNode("generateAnswer"');
  const academicLoaderSource = selectionSource.slice(academicLoaderStart, generateAnswerStart);
  assert.ok(
    academicLoaderStart >= 0 &&
      generateAnswerStart > academicLoaderStart &&
      !academicLoaderSource.includes("state.answer") &&
      !academicLoaderSource.includes("state.insufficientEvidence"),
    "academic recommendations should run before answer generation and should not depend on an existing book-grounded answer"
  );
  assert.ok(
    selectionSource.indexOf('.addEdge("classifyIntent", "classifySearchIntent")') <
      selectionSource.indexOf('.addEdge("classifySearchIntent", "loadAcademicRecommendations")') &&
      selectionSource.indexOf('.addEdge("classifySearchIntent", "loadAcademicRecommendations")') <
        selectionSource.indexOf('.addEdge("loadAcademicRecommendations", "generateAnswer")'),
    "selection workflow should expose search intent as a pre-answer routing node"
  );
  assert.match(readerSource, /AcademicRecommendationList/);
  assert.match(readerSource, /academicRecommendations/);
  assert.match(readerSource, /academicSourceLeads/);
  assert.match(readerSource, /getSourceLeadGroups/);
  assert.match(readerSource, /<details className="reader-ai-citations">/);
  assert.match(readerSource, /embedded/);
  assert.ok(
    readerSource.indexOf("<p className=\"reader-ai-academic-section-title\">学术关联</p>") <
      readerSource.indexOf("getSourceLeadGroups(turn).map") &&
      readerSource.indexOf("getSourceLeadGroups(turn).map") <
        readerSource.indexOf("<p className=\"reader-ai-citation-section-title\">文章来源</p>"),
    "academic sources, source leads, and current-book paragraph citations should render in the required order inside Sources"
  );
}

console.log("academic recommendation tests passed");
