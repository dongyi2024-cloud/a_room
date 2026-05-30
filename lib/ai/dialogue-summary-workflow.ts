import "server-only";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { generateDeepSeekChatCompletion } from "@/lib/ai/deepseek";
import { getResponseLanguageInstruction, inferResponseLanguage } from "@/lib/ai/response-language";
import type { DialogueSummaryDraft, DialogueSummaryRequest, DialogueSummaryWorkflowState } from "@/types/ai";

const DialogueSummaryState = Annotation.Root({
  request: Annotation<DialogueSummaryRequest>(),
  readingContext: Annotation<string>(),
  conversationContext: Annotation<string>(),
  responseLanguage: Annotation<DialogueSummaryWorkflowState["responseLanguage"]>(),
  draft: Annotation<DialogueSummaryDraft>()
});

const MAX_TURNS = 8;
const MAX_SELECTED_TEXT_CHARS = 1200;
const MAX_PARAGRAPH_TEXT_CHARS = 1800;
const MAX_TURN_QUESTION_CHARS = 500;
const MAX_TURN_ANSWER_CHARS = 1200;

function compactText(value: string, maxChars: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars - 3).trimEnd()}...`;
}

function buildReadingContext(request: DialogueSummaryRequest) {
  return [
    `Book: ${request.bookTitle}`,
    `Chapter ${request.chapterOrder}: ${request.chapterTitle || "Untitled chapter"}`,
    `Paragraph ${request.paragraphOrder}: ${compactText(request.paragraphText, MAX_PARAGRAPH_TEXT_CHARS)}`,
    `Selected text: ${compactText(request.selectedText, MAX_SELECTED_TEXT_CHARS)}`
  ].join("\n\n");
}

function getBoundedTurns(request: DialogueSummaryRequest) {
  return request.turns
    .filter((turn) => turn.question.trim() && turn.answer.trim())
    .slice(-MAX_TURNS)
    .map((turn) => ({
      question: compactText(turn.question, MAX_TURN_QUESTION_CHARS),
      answer: compactText(turn.answer, MAX_TURN_ANSWER_CHARS)
    }));
}

function buildConversationContext(request: DialogueSummaryRequest) {
  const turns = getBoundedTurns(request);

  return turns
    .map((turn, index) =>
      [`Turn ${index + 1} user question: ${turn.question}`, `Turn ${index + 1} AI answer: ${turn.answer}`].join("\n")
    )
    .join("\n\n");
}

function buildSystemPrompt(responseLanguage: DialogueSummaryWorkflowState["responseLanguage"]) {
  return [
    "You summarize a reader's AI dialogue inside a private reading app.",
    "Only use the supplied reading context and dialogue turns. Do not add external facts, citations, sources, or unsupported claims.",
    "Return valid JSON only. Do not wrap it in Markdown.",
    getResponseLanguageInstruction(responseLanguage),
    "The JSON shape must be:",
    '{"coreQuestions":["..."],"answerPoints":["..."],"relatedSourceText":"...","followUpQuestions":["..."],"editableSummary":"..."}',
    "coreQuestions: one to three concise user questions from the dialogue.",
    "answerPoints: two to five concise points actually answered in the dialogue.",
    "relatedSourceText: a short quote or description from the provided selected text or paragraph context.",
    "followUpQuestions: zero to three useful questions the reader may continue thinking about.",
    "editableSummary: a short review note combining the core question and answer points."
  ].join("\n\n");
}

function buildUserPrompt(readingContext: string, conversationContext: string) {
  return [
    "Create a reviewable dialogue summary draft from this material.",
    "Reading context:",
    readingContext,
    "Dialogue turns:",
    conversationContext
  ].join("\n\n");
}

function toStringArray(value: unknown, maxItems: number, maxChars: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? compactText(item, maxChars) : ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseJsonObject(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const jsonText = fenced || trimmed;
  const parsed = JSON.parse(jsonText) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Dialogue summary response was not an object.");
  }

  return parsed as Record<string, unknown>;
}

function buildFallbackDraft(request: DialogueSummaryRequest): DialogueSummaryDraft {
  const boundedTurns = getBoundedTurns(request);
  const coreQuestions = boundedTurns.map((turn) => turn.question).slice(0, 3);
  const answerPoints = boundedTurns.map((turn) => turn.answer).slice(0, 5);
  const relatedSourceText = compactText(request.selectedText || request.paragraphText, 500);
  const editableSummary = [
    coreQuestions.length > 0 ? `核心问题：${coreQuestions.join("；")}` : "",
    answerPoints.length > 0 ? `回答要点：${answerPoints.join("；")}` : "",
    relatedSourceText ? `关联原文：${relatedSourceText}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    coreQuestions,
    answerPoints,
    relatedSourceText,
    followUpQuestions: [],
    editableSummary
  };
}

function normalizeDraft(raw: string, request: DialogueSummaryRequest): DialogueSummaryDraft {
  const boundedTurns = getBoundedTurns(request);
  const fallbackQuestions = boundedTurns.map((turn) => turn.question).slice(0, 3);
  const fallbackPoints = boundedTurns.map((turn) => turn.answer).slice(0, 3);
  let parsed: Record<string, unknown>;

  try {
    parsed = parseJsonObject(raw);
  } catch (error) {
    console.warn("Unable to parse dialogue summary JSON; using fallback draft.", {
      error: error instanceof Error ? error.message : String(error),
      rawLength: raw.length
    });
    return buildFallbackDraft(request);
  }

  const coreQuestions = toStringArray(parsed.coreQuestions, 3, 180);
  const answerPoints = toStringArray(parsed.answerPoints, 5, 240);
  const followUpQuestions = toStringArray(parsed.followUpQuestions, 3, 180);
  const relatedSourceText =
    typeof parsed.relatedSourceText === "string" && parsed.relatedSourceText.trim()
      ? compactText(parsed.relatedSourceText, 500)
      : compactText(request.selectedText || request.paragraphText, 500);
  const editableSummary =
    typeof parsed.editableSummary === "string" && parsed.editableSummary.trim()
      ? compactText(parsed.editableSummary, 1600)
      : [...(coreQuestions.length ? coreQuestions : fallbackQuestions), ...(answerPoints.length ? answerPoints : fallbackPoints)]
          .filter(Boolean)
          .join("\n");

  return {
    coreQuestions: coreQuestions.length ? coreQuestions : fallbackQuestions,
    answerPoints: answerPoints.length ? answerPoints : fallbackPoints,
    relatedSourceText,
    followUpQuestions,
    editableSummary
  };
}

const dialogueSummaryWorkflow = new StateGraph(DialogueSummaryState)
  .addNode("buildContexts", async (state) => ({
    readingContext: buildReadingContext(state.request),
    conversationContext: buildConversationContext(state.request),
    responseLanguage: inferResponseLanguage(
      [
        state.request.bookTitle,
        state.request.chapterTitle,
        state.request.selectedText,
        ...state.request.turns.flatMap((turn) => [turn.question, turn.answer])
      ],
      "zh"
    )
  }))
  .addNode("generateDraft", async (state) => {
    if (!state.conversationContext.trim()) {
      throw new Error("没有可总结的完整对话。");
    }

    const result = await generateDeepSeekChatCompletion({
      systemPrompt: buildSystemPrompt(state.responseLanguage),
      userPrompt: buildUserPrompt(state.readingContext, state.conversationContext),
      temperature: 0.25,
      maxTokens: 1000
    });

    return {
      draft: normalizeDraft(result.answer, state.request)
    };
  })
  .addEdge(START, "buildContexts")
  .addEdge("buildContexts", "generateDraft")
  .addEdge("generateDraft", END)
  .compile();

export async function runDialogueSummaryWorkflow(request: DialogueSummaryRequest) {
  const completedTurns = getBoundedTurns(request);

  if (!request.paragraphId || !request.chapterId || !request.bookId) {
    throw new Error("缺少对话摘要上下文。");
  }

  if (!request.selectedText.trim() || completedTurns.length === 0) {
    throw new Error("这段对话还不能生成摘要。");
  }

  const result = await dialogueSummaryWorkflow.invoke({
    request: {
      ...request,
      turns: completedTurns
    },
    readingContext: "",
    conversationContext: "",
    responseLanguage: "zh",
    draft: {
      coreQuestions: [],
      answerPoints: [],
      relatedSourceText: "",
      followUpQuestions: [],
      editableSummary: ""
    }
  });

  if (!result.draft.editableSummary.trim()) {
    throw new Error("暂时无法生成对话摘要。");
  }

  return result.draft;
}
