import "server-only";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { buildSelectionAiCitations } from "@/lib/ai/selection-citations";
import { buildAnswerLengthPolicy, enforceAnswerLengthPolicy } from "@/lib/ai/answer-length";
import {
  loadBibliographySourceLeads,
  loadFastBackgroundSourceLeads
} from "@/lib/academic-recommendations/background-leads";
import {
  classifySelectionSearchIntent,
  shouldAttemptAcademicEvidence,
  type SearchIntentDecision
} from "@/lib/academic-recommendations/search-intent";
import { generateDeepSeekChatCompletion } from "@/lib/ai/deepseek";
import { enforceWoolfFirstPersonVoice, getWoolfVoiceInstruction, loadWoolfPersonaPrompt } from "@/lib/ai/prompts";
import { getResponseLanguageInstruction, inferResponseLanguage } from "@/lib/ai/response-language";
import { loadAiMemoryContext, recordAiMemoryCandidates } from "@/lib/memory/data";
import {
  BookRetrievalAccessError,
  BookRetrievalNotFoundError,
  BookRetrievalSourceUnavailableError,
  retrieveBookChunksForUser
} from "@/lib/rag/retrieval";
import type {
  SelectionAiCitation,
  SelectionAiIntent,
  SelectionAiRequest,
  SelectionAiTurn,
  SelectionAiWorkflowState
} from "@/types/ai";
import type { AcademicRecommendation, AcademicSourceLead } from "@/types/academic-recommendations";
import type { RetrievedBookChunk } from "@/types/rag";

const SelectionState = Annotation.Root({
  request: Annotation<SelectionAiRequest>(),
  readingContext: Annotation<string>(),
  conversationHistory: Annotation<string>(),
  recentTurns: Annotation<SelectionAiTurn[]>(),
  personaPrompt: Annotation<string>(),
  intent: Annotation<SelectionAiIntent>(),
  responseLanguage: Annotation<SelectionAiWorkflowState["responseLanguage"]>(),
  answerLengthMode: Annotation<SelectionAiWorkflowState["answerLengthMode"]>(),
  answerLengthPolicy: Annotation<SelectionAiWorkflowState["answerLengthPolicy"]>(),
  memoryContext: Annotation<string>(),
  retrievedChunks: Annotation<RetrievedBookChunk[]>(),
  retrievedChunkCount: Annotation<number>(),
  selectedCitationChunkIds: Annotation<string[]>(),
  citations: Annotation<SelectionAiCitation[]>(),
  academicRecommendations: Annotation<SelectionAiWorkflowState["academicRecommendations"]>(),
  academicSourceLeads: Annotation<SelectionAiWorkflowState["academicSourceLeads"]>(),
  searchIntent: Annotation<SearchIntentDecision>(),
  insufficientEvidence: Annotation<boolean>(),
  answer: Annotation<string>(),
  answerWasTruncated: Annotation<boolean>()
});

const MAX_HISTORY_TURNS = 2;
const MAX_HISTORY_QUESTION_CHARS = 180;
const MAX_HISTORY_ANSWER_CHARS = 220;
const MAX_PROMPT_CHUNK_CHARS = 420;
const RETRIEVAL_TOP_K = 3;
const CHAPTER_SCOPED_RETRIEVAL_TOP_K = 8;
const CLASSIFIER_MAX_TOKENS = 40;
const MAX_PROMPT_SOURCE_LEADS = 2;

type ParsedIntentPayload = {
  intent: SelectionAiIntent;
};

type ParsedGroundedAnswer = {
  answer: string;
  citationChunkIds: string[];
};

type StructuredGroundedAnswerResult = {
  parsed: ParsedGroundedAnswer;
  finishReason: string | null;
  fallbackUsed: boolean;
};

type ParagraphDirection = "next" | "previous" | null;

function compactHistoryText(text: string, maxChars: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars).trimEnd()}...`;
}

function getRecentTurns(turns: SelectionAiTurn[], maxTurns = MAX_HISTORY_TURNS) {
  return turns.slice(-maxTurns).map((turn) => ({
    question: compactHistoryText(turn.question, MAX_HISTORY_QUESTION_CHARS),
    answer: compactHistoryText(turn.answer, MAX_HISTORY_ANSWER_CHARS),
    truncated: turn.truncated
  }));
}

function buildReadingContext(request: SelectionAiRequest) {
  const context = [
    `Book: ${request.bookTitle}`,
    `Chapter ${request.chapterOrder}: ${request.chapterTitle || "Untitled chapter"}`,
    request.paragraphOrder ? `Paragraph ${request.paragraphOrder}: ${request.paragraphText}` : `Paragraph: ${request.paragraphText}`,
    `Selected text: ${request.selectedText}`,
    `User question: ${request.question}`
  ];

  if (request.explanationContext) {
    context.push(
      `Lightweight explanation target: ${request.explanationContext.targetText}`,
      `Lightweight explanation: ${request.explanationContext.explanation}`
    );
  }

  return context.join("\n\n");
}

function buildConversationHistory(turns: SelectionAiTurn[]) {
  if (turns.length === 0) {
    return "No prior turns for this selected passage.";
  }

  return turns
    .map((turn, index) =>
      [
        `Turn ${index + 1} user question: ${turn.question}`,
        `Turn ${index + 1} AI answer: ${turn.answer}`,
        turn.truncated ? `Turn ${index + 1} note: the previous answer was cut off by the model length limit.` : null
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function buildRetrievalQuery(request: SelectionAiRequest, recentTurns: SelectionAiTurn[]) {
  const direction = detectParagraphDirection(request.question);
  const parts = [
    `Current question: ${request.question}`,
    `Selected text: ${request.selectedText}`,
    `Current paragraph: ${compactHistoryText(request.paragraphText, 500)}`
  ];

  if (direction === "next") {
    parts.push("Navigation hint: the user is explicitly asking about the following paragraph or what happens next.");
  } else if (direction === "previous") {
    parts.push("Navigation hint: the user is explicitly asking about the previous paragraph or what happened just before.");
  }

  if (request.explanationContext) {
    parts.push(`Existing lightweight explanation: ${compactHistoryText(request.explanationContext.explanation, 300)}`);
  }

  if (recentTurns.length > 0) {
    const latestTurn = recentTurns[recentTurns.length - 1];
    parts.push(`Previous question: ${compactHistoryText(latestTurn.question, 220)}`);
    parts.push(`Previous answer: ${compactHistoryText(latestTurn.answer, 260)}`);
  }

  return parts.join("\n");
}

function detectParagraphDirection(question: string): ParagraphDirection {
  const normalized = question.replace(/\s+/g, "").toLowerCase();
  const nextPatterns = ["下一段", "下一句", "接下来", "后面", "之后", "下一节", "nextparagraph", "nextpart", "nextsection", "followingparagraph", "whatnext"];
  const previousPatterns = ["上一段", "前一段", "上一句", "前面", "之前", "上一节", "previousparagraph", "priorparagraph", "earlierparagraph", "beforethis"];

  if (nextPatterns.some((pattern) => normalized.includes(pattern))) {
    return "next";
  }

  if (previousPatterns.some((pattern) => normalized.includes(pattern))) {
    return "previous";
  }

  return null;
}

function mergeRetrievedChunks(primary: RetrievedBookChunk[], secondary: RetrievedBookChunk[]) {
  const merged = new Map<string, RetrievedBookChunk>();

  for (const chunk of [...primary, ...secondary]) {
    if (!merged.has(chunk.chunkId)) {
      merged.set(chunk.chunkId, chunk);
    }
  }

  return [...merged.values()];
}

function rankDirectionalChunks(
  chunks: RetrievedBookChunk[],
  request: SelectionAiRequest,
  direction: ParagraphDirection,
  topK: number
) {
  if (!direction || request.paragraphOrder === null) {
    return chunks.slice(0, topK);
  }

  const currentParagraphOrder = request.paragraphOrder;
  const ranked = [...chunks].sort((left, right) => {
    const leftRank = directionalChunkRank(left, request.chapterId, currentParagraphOrder, direction);
    const rightRank = directionalChunkRank(right, request.chapterId, currentParagraphOrder, direction);

    if (leftRank.priority !== rightRank.priority) {
      return leftRank.priority - rightRank.priority;
    }

    if (leftRank.distance !== rightRank.distance) {
      return leftRank.distance - rightRank.distance;
    }

    if (left.similarity !== right.similarity) {
      return right.similarity - left.similarity;
    }

    return left.startParagraphOrder - right.startParagraphOrder;
  });

  return ranked.slice(0, topK);
}

function directionalChunkRank(
  chunk: RetrievedBookChunk,
  chapterId: string,
  currentParagraphOrder: number,
  direction: ParagraphDirection
) {
  const sameChapter = chunk.chapterId === chapterId;
  const containsCurrent =
    chunk.startParagraphOrder <= currentParagraphOrder && chunk.endParagraphOrder >= currentParagraphOrder;

  if (!sameChapter) {
    return {
      priority: 5,
      distance: Number.MAX_SAFE_INTEGER
    };
  }

  if (direction === "next") {
    if (chunk.startParagraphOrder > currentParagraphOrder) {
      return {
        priority: 0,
        distance: chunk.startParagraphOrder - currentParagraphOrder
      };
    }

    if (containsCurrent && chunk.endParagraphOrder > currentParagraphOrder) {
      return {
        priority: 1,
        distance: chunk.endParagraphOrder - currentParagraphOrder
      };
    }

    if (chunk.endParagraphOrder > currentParagraphOrder) {
      return {
        priority: 2,
        distance: chunk.endParagraphOrder - currentParagraphOrder
      };
    }
  }

  if (direction === "previous") {
    if (chunk.endParagraphOrder < currentParagraphOrder) {
      return {
        priority: 0,
        distance: currentParagraphOrder - chunk.endParagraphOrder
      };
    }

    if (containsCurrent && chunk.startParagraphOrder < currentParagraphOrder) {
      return {
        priority: 1,
        distance: currentParagraphOrder - chunk.startParagraphOrder
      };
    }

    if (chunk.startParagraphOrder < currentParagraphOrder) {
      return {
        priority: 2,
        distance: currentParagraphOrder - chunk.startParagraphOrder
      };
    }
  }

  return {
    priority: 3,
    distance: Math.abs(chunk.startParagraphOrder - currentParagraphOrder)
  };
}

function getExplanationModeInstruction(mode: SelectionAiRequest["explanationMode"]) {
  return mode === "close_reading"
    ? "Explanation mode: close_reading. Stay close to the book's original concepts, tonal tension, and sentence logic. Do not over-modernize the phrasing."
    : "Explanation mode: plain. Explain in more accessible contemporary language while staying faithful to the book's meaning.";
}

function buildEvidenceContext(chunks: RetrievedBookChunk[]) {
  if (chunks.length === 0) {
    return "No retrieved book chunks were found for this turn.";
  }

  return chunks
    .map((chunk, index) => {
      const content = chunk.content.replace(/\s+/g, " ").trim();
      const snippet =
        content.length <= MAX_PROMPT_CHUNK_CHARS ? content : `${content.slice(0, MAX_PROMPT_CHUNK_CHARS).trimEnd()}...`;

      return [
        `Chunk ${index + 1} ID: ${chunk.chunkId}`,
        `Chapter: ${chunk.chapterTitle || "Untitled chapter"}`,
        `Paragraph range: ${chunk.startParagraphId} -> ${chunk.endParagraphId}`,
        `Chunk text: ${snippet}`
      ].join("\n");
    })
    .join("\n\n");
}

function buildAcademicContext(recommendations: AcademicRecommendation[]) {
  if (recommendations.length === 0) {
    return "No verified external academic sources were retrieved for this turn.";
  }

  return recommendations
    .map((recommendation, index) =>
      [
        `Academic source ${index + 1}: ${recommendation.title}`,
        `Scholar or source: ${recommendation.scholarOrSource}`,
        `Publication/source: ${recommendation.sourceName}${recommendation.year ? ` (${recommendation.year})` : ""}`,
        `Summary: ${recommendation.summary}`,
        `Relation: ${recommendation.relation}`
      ].join("\n")
    )
    .join("\n\n");
}

function buildAcademicSourceLeadContext(sourceLeads: AcademicSourceLead[]) {
  const promptSourceLeads = sourceLeads.slice(0, MAX_PROMPT_SOURCE_LEADS);

  if (promptSourceLeads.length === 0) {
    return "No verified external background, bibliography, publication, or archive leads were retrieved for this turn.";
  }

  return promptSourceLeads
    .map((lead, index) =>
      [
        `Source lead ${index + 1} type: ${lead.label}`,
        `Title: ${lead.title}`,
        `Source: ${lead.sourceName}${lead.year ? ` (${lead.year})` : ""}`,
        `Summary: ${lead.summary}`,
        lead.url ? `URL: ${lead.url}` : null,
        "Use rule: this is not academic evidence and must not be phrased as a scholar viewpoint, paper recommendation, or research conclusion."
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function buildAnswerJsonContract(intent: SelectionAiIntent) {
  return intent === "strict_grounded"
    ? "Return strict JSON only with this shape: {\"answer\":\"...\",\"citationChunkIds\":[\"chunk-id-1\",\"chunk-id-2\"]}. Do not wrap the JSON in markdown fences."
    : "Return strict JSON only with this shape: {\"answer\":\"...\",\"citationChunkIds\":[\"chunk-id-1\"]}. The citationChunkIds field is optional for interpretive turns and may be an empty array. Do not wrap the JSON in markdown fences.";
}

function buildSystemPrompt(
  personaPrompt: string,
  memoryContext: string,
  request: SelectionAiRequest,
  intent: SelectionAiIntent,
  answerLengthMode: SelectionAiWorkflowState["answerLengthMode"],
  responseLanguage: SelectionAiWorkflowState["responseLanguage"],
  academicRecommendations: AcademicRecommendation[],
  academicSourceLeads: AcademicSourceLead[]
) {
  return [
    personaPrompt,
    "You are assisting a reader inside the product 'A Room of One's Own'.",
    getWoolfVoiceInstruction(),
    memoryContext || "Long-term reader memory: none available or memory is disabled for this user.",
    "Answer from the selected text and retrieved book evidence first.",
    "Do not invent quotations, paragraph references, chapter titles, or citations.",
    "Only cite chunk IDs that appear in the retrieved evidence list for this turn.",
    academicRecommendations.length > 0
      ? "Verified external academic sources are available for this turn. When the user asks for authoritative, scholarly, source-backed, or data-supported information, you may use those listed academic sources as external support. Do not invent any source beyond the listed academic sources."
      : "No verified external academic sources are available for this turn.",
    academicSourceLeads.length > 0
      ? "Verified external non-academic source leads are available. They may support background explanation, book identity, publication information, or archive context only. Do not convert these leads into 学者认为, 学界认为, 论文指出, paper recommendations, or academic conclusions."
      : "No verified external non-academic source leads are available for this turn.",
    academicSourceLeads.length === 0
      ? "If the user asks what a named entity, historical term, institution, book, or background concept is, do not define it from general model knowledge unless that definition is directly present in the retrieved book evidence. If the retrieved book evidence only shows how the term functions in the passage, explain only that passage-level role and say no verified external background lead is available."
      : "When explaining a named entity, historical term, institution, book, or background concept from source leads, name the lead category rather than presenting it as academic evidence.",
    intent === "strict_grounded"
      ? "This turn is strict_grounded. Stay close to the current book evidence. If book evidence is not enough but verified academic sources are listed, answer from those sources and explain that the support is external. If neither book evidence nor verified academic sources are enough, say the basis is insufficient in a brief way and return an empty citationChunkIds array."
      : "This turn is interpretive. You may explain more naturally, but you must still stay grounded in the current book evidence and must not fabricate source support.",
    getExplanationModeInstruction(request.explanationMode),
    getResponseLanguageInstruction(responseLanguage),
    answerLengthMode === "default"
      ? "For ordinary questions, keep the answer concise enough to fit within three sentences after server-side enforcement."
      : "The user explicitly asked for more detail. You may answer in more than three sentences, but stay focused and readable.",
    buildAnswerJsonContract(intent)
  ].join("\n\n");
}

function buildUserPrompt(
  readingContext: string,
  conversationHistory: string,
  retrievedChunks: RetrievedBookChunk[],
  academicRecommendations: AcademicRecommendation[],
  academicSourceLeads: AcademicSourceLead[]
) {
  return [
    "Please answer the user's question about this selected passage.",
    "Reading context:",
    readingContext,
    "Prior turns for this same selected passage:",
    conversationHistory,
    "Retrieved evidence from the current book:",
    buildEvidenceContext(retrievedChunks),
    "Verified external academic sources:",
    buildAcademicContext(academicRecommendations),
    "Verified external non-academic source leads:",
    buildAcademicSourceLeadContext(academicSourceLeads),
    "Continue the current line of reading without repeating the entire background unless the user truly needs it."
  ].join("\n\n");
}

function getCompletionMaxTokens(answerLengthMode: SelectionAiWorkflowState["answerLengthMode"]) {
  return answerLengthMode === "default" ? 300 : 800;
}

function buildIntentClassifierPrompt(request: SelectionAiRequest) {
  return [
    "Classify the selected-text reader question into exactly one intent.",
    "Return strict JSON only with this shape: {\"intent\":\"strict_grounded\"} or {\"intent\":\"interpretive\"}.",
    "Choose strict_grounded when the user is asking for factual support, textual basis, precise explanation tied to the book, explicit why/how judgments, or anything that should be attributable to the text.",
    "Choose interpretive when the user is asking for reflective, companion-like, contemporary, emotional, or open-ended explanation that may remain grounded without requiring explicit citations.",
    `Book: ${request.bookTitle}`,
    `Chapter ${request.chapterOrder}: ${request.chapterTitle || "Untitled chapter"}`,
    `Selected text: ${request.selectedText}`,
    request.explanationContext
      ? `Lightweight explanation context: ${request.explanationContext.explanation}`
      : "Lightweight explanation context: none",
    `User question: ${request.question}`
  ].join("\n\n");
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

export function parseGroundedAnswerPayload(payload: string): ParsedGroundedAnswer {
  const trimmed = stripMarkdownCodeFence(payload);
  const parseCandidates = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    parseCandidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of parseCandidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        answer?: unknown;
        citationChunkIds?: unknown;
      };

      const answer = typeof parsed.answer === "string" ? parsed.answer.replace(/\s+/g, " ").trim() : "";
      const citationChunkIds = Array.isArray(parsed.citationChunkIds)
        ? parsed.citationChunkIds.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [];

      if (!answer) {
        continue;
      }

      return {
        answer,
        citationChunkIds: Array.from(new Set(citationChunkIds))
      };
    } catch {
      continue;
    }
  }

  throw new Error("DeepSeek did not return valid grounded-answer JSON.");
}

function stripLikelyJsonFragments(text: string) {
  const trimmed = stripMarkdownCodeFence(text);
  const parsed = (() => {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  })();

  if (parsed && typeof parsed === "object") {
    const answer = (parsed as { answer?: unknown }).answer;

    if (typeof answer === "string") {
      return answer;
    }
  }

  return trimmed
    .replace(/^\s*\{?\s*"answer"\s*:\s*"?/i, "")
    .replace(/"?\s*,?\s*"citationChunkIds"\s*:\s*\[[\s\S]*$/i, "")
    .replace(/^\s*["'`]+|["'`]+\s*$/g, "")
    .trim();
}

export function extractMalformedGroundedAnswerFallback(payloads: string[]) {
  for (const payload of payloads) {
    const fallback = stripLikelyJsonFragments(payload)
      .replace(/\s+/g, " ")
      .trim();

    if (fallback.length >= 2 && !/^\{[\s\S]*\}$/.test(fallback)) {
      return fallback.slice(0, 1200);
    }
  }

  return "";
}

function parseIntentPayload(payload: string): ParsedIntentPayload {
  const trimmed = stripMarkdownCodeFence(payload);
  const parseCandidates = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    parseCandidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of parseCandidates) {
    try {
      const parsed = JSON.parse(candidate) as { intent?: unknown };

      if (parsed.intent === "strict_grounded" || parsed.intent === "interpretive") {
        return { intent: parsed.intent };
      }
    } catch {
      continue;
    }
  }

  throw new Error("DeepSeek did not return a valid selection intent.");
}

async function classifySelectionIntent(request: SelectionAiRequest) {
  try {
    const result = await generateDeepSeekChatCompletion({
      systemPrompt:
        "You classify reader questions for a grounded AI workflow. Output JSON only. Never add explanation.",
      userPrompt: buildIntentClassifierPrompt(request),
      maxTokens: CLASSIFIER_MAX_TOKENS,
      temperature: 0
    });

    return parseIntentPayload(result.answer).intent;
  } catch {
    return "strict_grounded";
  }
}

async function generateStructuredGroundedAnswer(params: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
}): Promise<StructuredGroundedAnswerResult> {
  const { systemPrompt, userPrompt, maxTokens } = params;
  const attempts = [
    {
      systemPrompt,
      userPrompt
    }
  ];

  let lastError: Error | null = null;
  let lastFinishReason: string | null = null;
  const rawAnswers: string[] = [];

  for (const attempt of attempts) {
    const result = await generateDeepSeekChatCompletion({
      systemPrompt: attempt.systemPrompt,
      userPrompt: attempt.userPrompt,
      maxTokens
    });
    rawAnswers.push(result.answer);
    lastFinishReason = result.finishReason;

    try {
      return {
        parsed: parseGroundedAnswerPayload(result.answer),
        finishReason: result.finishReason,
        fallbackUsed: false
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unable to parse grounded answer output.");
    }
  }

  const fallbackAnswer = extractMalformedGroundedAnswerFallback(rawAnswers);

  if (fallbackAnswer) {
    console.warn("Selection answer JSON parse failed; using text fallback.", {
      attempts: rawAnswers.length,
      fallbackChars: fallbackAnswer.length,
      lastFinishReason,
      errorName: lastError?.name ?? "Error"
    });

    return {
      parsed: {
        answer: fallbackAnswer,
        citationChunkIds: []
      },
      finishReason: lastFinishReason,
      fallbackUsed: true
    };
  }

  console.warn("Selection answer JSON parse failed with no usable fallback text.", {
    attempts: rawAnswers.length,
    lastFinishReason,
    errorName: lastError?.name ?? "Error"
  });

  return {
    parsed: {
      answer: "",
      citationChunkIds: []
    },
    finishReason: lastFinishReason,
    fallbackUsed: true
  };
}

function buildInsufficientEvidenceAnswer(
  language: SelectionAiWorkflowState["responseLanguage"],
  options: { academicToolAttempted?: boolean } = {}
) {
  if (options.academicToolAttempted) {
    return language === "en"
      ? "I tried the trusted academic-source search, but I did not find a verified source reliable enough to support this answer. I also do not have enough book-local evidence to answer it confidently."
      : "我已尝试检索当前受信的学术来源，但没有找到足够可靠、可验证的权威资料来支撑这个回答；书内依据也不足以让我稳妥回答。";
  }

  return language === "en"
    ? "I do not have enough support from this book's current evidence to answer that confidently. Try narrowing the question or pointing me to a more specific passage."
    : "我现在还没有足够的书内依据把这个问题回答得更稳妥。你可以把问题收窄一点，或指向更具体的一段。";
}

const selectionWorkflow = new StateGraph(SelectionState)
  .addNode("buildReadingContext", async (state) => {
    const answerLengthPolicy = buildAnswerLengthPolicy(state.request.question);
    const recentTurns = getRecentTurns(state.request.priorTurns);
    const responseLanguage = inferResponseLanguage([state.request.question], "zh");

    return {
      readingContext: buildReadingContext(state.request),
      conversationHistory: buildConversationHistory(recentTurns),
      recentTurns,
      responseLanguage,
      answerLengthMode: answerLengthPolicy.mode,
      answerLengthPolicy
    };
  })
  .addNode("loadPersonaPrompt", async () => ({
    personaPrompt: await loadWoolfPersonaPrompt()
  }))
  .addNode("loadMemoryContext", async (state) => ({
    memoryContext: await loadAiMemoryContext(state.request.userId)
  }))
  .addNode("retrieveEvidence", async (state) => {
    if (state.request.isSampleBook) {
      return {
        retrievedChunks: [],
        retrievedChunkCount: 0,
        insufficientEvidence: true
      };
    }

    try {
      const direction = detectParagraphDirection(state.request.question);
      const retrievalQuery = buildRetrievalQuery(state.request, state.recentTurns);
      const result = await retrieveBookChunksForUser({
        bookId: state.request.bookId,
        userId: state.request.userId,
        question: retrievalQuery,
        topK: RETRIEVAL_TOP_K
      });
      const chapterScopedResult =
        direction && state.request.chapterId
          ? await retrieveBookChunksForUser({
              bookId: state.request.bookId,
              userId: state.request.userId,
              question: retrievalQuery,
              chapterId: state.request.chapterId,
              topK: CHAPTER_SCOPED_RETRIEVAL_TOP_K
            })
          : null;
      const mergedChunks = mergeRetrievedChunks(result.chunks, chapterScopedResult?.chunks ?? []);
      const rankedChunks = rankDirectionalChunks(mergedChunks, state.request, direction, RETRIEVAL_TOP_K);

      if (rankedChunks.length === 0) {
        return {
          retrievedChunks: [],
          retrievedChunkCount: 0,
          insufficientEvidence: true
        };
      }

      return {
        retrievedChunks: rankedChunks,
        retrievedChunkCount: rankedChunks.length,
        insufficientEvidence: false
      };
    } catch (error) {
      if (
        error instanceof BookRetrievalSourceUnavailableError ||
        error instanceof BookRetrievalNotFoundError ||
        error instanceof BookRetrievalAccessError
      ) {
        return {
          retrievedChunks: [],
          retrievedChunkCount: 0,
          insufficientEvidence: true
        };
      }

      throw error;
    }
  })
  .addNode("classifyIntent", async (state) => ({
    intent: await classifySelectionIntent(state.request)
  }))
  .addNode("classifySearchIntent", async (state) => {
    const searchIntent = classifySelectionSearchIntent(state.request);

    if (process.env.NODE_ENV !== "production") {
      console.info("[selection-search-intent] decision", {
        mode: searchIntent.mode,
        reason: searchIntent.reason,
        maxWaitMs: searchIntent.maxWaitMs,
        allowedProviders: searchIntent.allowedProviders,
        searchEntity: searchIntent.searchEntity
      });
    }

    return {
      searchIntent
    };
  })
  .addNode("loadAcademicRecommendations", async (state) => {
    if (state.searchIntent.mode === "none") {
      if (process.env.NODE_ENV !== "production") {
        console.info("[selection-search-intent] skip external retrieval", {
          mode: state.searchIntent.mode,
          reason: state.searchIntent.reason
        });
      }

      return {
        academicRecommendations: [],
        academicSourceLeads: []
      };
    }

    if (state.searchIntent.mode === "background_lead") {
      if (process.env.NODE_ENV !== "production") {
        console.info("[selection-search-intent] skip full academic retrieval", {
          mode: state.searchIntent.mode,
          reason: state.searchIntent.reason
        });
      }

      return {
        academicRecommendations: [],
        academicSourceLeads: await loadFastBackgroundSourceLeads(state.request, {
          timeoutMs: state.searchIntent.maxWaitMs,
          allowedProviders: state.searchIntent.allowedProviders,
          preferredSearchEntity: state.searchIntent.searchEntity,
          maxResults: 2
        })
      };
    }

    if (state.searchIntent.mode === "bibliography") {
      if (process.env.NODE_ENV !== "production") {
        console.info("[selection-search-intent] skip full academic retrieval", {
          mode: state.searchIntent.mode,
          reason: state.searchIntent.reason
        });
      }

      return {
        academicRecommendations: [],
        academicSourceLeads: await loadBibliographySourceLeads(state.request, {
          timeoutMs: state.searchIntent.maxWaitMs,
          allowedProviders: state.searchIntent.allowedProviders
        })
      };
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[selection-search-intent] skip full academic retrieval", {
        mode: state.searchIntent.mode,
        reason: "academic_workflow_paused_for_fast_path"
      });
    }

    return {
      academicRecommendations: [],
      academicSourceLeads: await loadFastBackgroundSourceLeads(state.request, {
        timeoutMs: 1500,
        allowedProviders: ["wikipedia", "baidu_baike"],
        preferredSearchEntity: state.searchIntent.searchEntity,
        maxResults: 1
      }).catch(() => [])
    };
  })
  .addNode("generateAnswer", async (state) => {
    if (
      (state.insufficientEvidence || state.retrievedChunks.length === 0) &&
      state.academicRecommendations.length === 0 &&
      state.academicSourceLeads.length === 0
    ) {
      return {
        answer: buildInsufficientEvidenceAnswer(state.responseLanguage, {
          academicToolAttempted: shouldAttemptAcademicEvidence(state.searchIntent)
        }),
        answerWasTruncated: false,
        selectedCitationChunkIds: [],
        citations: [],
        insufficientEvidence: true
      };
    }

    const { parsed, finishReason } = await generateStructuredGroundedAnswer({
      systemPrompt: buildSystemPrompt(
        state.personaPrompt,
        state.memoryContext,
        state.request,
        state.intent,
        state.answerLengthMode,
        state.responseLanguage,
        state.academicRecommendations,
        state.academicSourceLeads
      ),
      userPrompt: buildUserPrompt(
        state.readingContext,
        state.conversationHistory,
        state.retrievedChunks,
        state.academicRecommendations,
        state.academicSourceLeads
      ),
      maxTokens: getCompletionMaxTokens(state.answerLengthMode)
    });

    if (!parsed.answer) {
      return {
        answer: buildInsufficientEvidenceAnswer(state.responseLanguage, {
          academicToolAttempted: shouldAttemptAcademicEvidence(state.searchIntent)
        }),
        answerWasTruncated: false,
        selectedCitationChunkIds: [],
        citations: [],
        insufficientEvidence: true
      };
    }

    if (
      state.intent === "strict_grounded" &&
      parsed.citationChunkIds.length === 0 &&
      state.academicRecommendations.length === 0 &&
      state.academicSourceLeads.length === 0
    ) {
      return {
        answer: buildInsufficientEvidenceAnswer(state.responseLanguage, {
          academicToolAttempted: shouldAttemptAcademicEvidence(state.searchIntent)
        }),
        answerWasTruncated: false,
        selectedCitationChunkIds: [],
        citations: [],
        insufficientEvidence: true
      };
    }

    return {
      answer: enforceWoolfFirstPersonVoice(parsed.answer),
      answerWasTruncated: finishReason === "length",
      selectedCitationChunkIds: parsed.citationChunkIds,
      academicSourceLeads: state.academicSourceLeads,
      insufficientEvidence: false
    };
  })
  .addNode("materializeCitations", async (state) => {
    if (state.selectedCitationChunkIds.length === 0 || state.retrievedChunks.length === 0) {
      return {
        citations: [],
        insufficientEvidence:
          state.intent === "strict_grounded" &&
          state.academicRecommendations.length === 0 &&
          state.academicSourceLeads.length === 0
            ? state.insufficientEvidence
            : false
      };
    }

    const citations = await buildSelectionAiCitations({
      bookId: state.request.bookId,
      bookTitle: state.request.bookTitle,
      retrievedChunks: state.retrievedChunks,
      citedChunkIds: state.selectedCitationChunkIds
    });

    if (
      state.intent === "strict_grounded" &&
      citations.length === 0 &&
      state.academicRecommendations.length === 0 &&
      state.academicSourceLeads.length === 0
    ) {
      return {
        answer: buildInsufficientEvidenceAnswer(state.responseLanguage, {
          academicToolAttempted: shouldAttemptAcademicEvidence(state.searchIntent)
        }),
        answerWasTruncated: false,
        citations: [],
        insufficientEvidence: true
      };
    }

    return {
      citations,
      academicSourceLeads: state.academicSourceLeads,
      insufficientEvidence:
        state.intent === "strict_grounded" && state.academicRecommendations.length === 0 && state.academicSourceLeads.length === 0
          ? citations.length === 0
          : false
    };
  })
  .addNode("enforceAnswerLength", async (state) => ({
    answer: enforceAnswerLengthPolicy(state.answer, state.answerLengthPolicy)
  }))
  .addNode("proposeMemoryCandidate", async (state) => {
    if (!state.answer || state.insufficientEvidence || state.request.isSampleBook) {
      return {};
    }

    try {
      await recordAiMemoryCandidates({
        userId: state.request.userId,
        source: "selection_ai",
        question: state.request.question,
        answer: state.answer,
        explanationMode: state.request.explanationMode,
        answerLengthMode: state.answerLengthMode,
        selectedText: state.request.selectedText,
        bookTitle: state.request.bookTitle,
        chapterTitle: state.request.chapterTitle
      });
    } catch (error) {
      console.warn("Unable to record selection memory candidate", {
        userId: state.request.userId,
        bookId: state.request.bookId,
        error
      });
    }

    return {};
  })
  .addEdge(START, "buildReadingContext")
  .addEdge("buildReadingContext", "loadPersonaPrompt")
  .addEdge("loadPersonaPrompt", "loadMemoryContext")
  .addEdge("loadMemoryContext", "retrieveEvidence")
  .addEdge("retrieveEvidence", "classifyIntent")
  .addEdge("classifyIntent", "classifySearchIntent")
  .addEdge("classifySearchIntent", "loadAcademicRecommendations")
  .addEdge("loadAcademicRecommendations", "generateAnswer")
  .addEdge("generateAnswer", "materializeCitations")
  .addEdge("materializeCitations", "enforceAnswerLength")
  .addEdge("enforceAnswerLength", "proposeMemoryCandidate")
  .addEdge("proposeMemoryCandidate", END)
  .compile();

export async function runSelectionAiWorkflow(request: SelectionAiRequest) {
  const result = await selectionWorkflow.invoke({
    request,
    readingContext: "",
    conversationHistory: "",
    recentTurns: [],
    personaPrompt: "",
    intent: "strict_grounded",
    responseLanguage: "zh",
    answerLengthMode: "default",
    answerLengthPolicy: {
      mode: "default",
      maxSentences: 3
    },
    memoryContext: "",
    retrievedChunks: [],
    retrievedChunkCount: 0,
    selectedCitationChunkIds: [],
    citations: [],
    academicRecommendations: [],
    academicSourceLeads: [],
    searchIntent: {
      mode: "none",
      reason: "not_classified",
      maxWaitMs: 0,
      allowedProviders: []
    },
    insufficientEvidence: false,
    answer: "",
    answerWasTruncated: false
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[selection-workflow] final academic sources", {
      academicRecommendationCount: result.academicRecommendations.length,
      academicSourceLeadCount: result.academicSourceLeads.length
    });
  }

  return {
    answer: result.answer,
    truncated: result.answerWasTruncated,
    citations: result.citations,
    academicRecommendations: result.academicRecommendations,
    academicSourceLeads: result.academicSourceLeads,
    insufficientEvidence: result.insufficientEvidence
  };
}
