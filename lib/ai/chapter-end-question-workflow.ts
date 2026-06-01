import "server-only";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { generateDeepSeekChatCompletion } from "@/lib/ai/deepseek";
import { loadWoolfPersonaPrompt } from "@/lib/ai/prompts";
import { getQuestionMark, getResponseLanguageInstruction, inferResponseLanguage } from "@/lib/ai/response-language";
import type { ChapterEndAiQuestionRequest, ChapterEndAiQuestionWorkflowState } from "@/types/ai";

const ChapterEndQuestionState = Annotation.Root({
  request: Annotation<ChapterEndAiQuestionRequest>(),
  readingContext: Annotation<string>(),
  personaPrompt: Annotation<string>(),
  responseLanguage: Annotation<ChapterEndAiQuestionWorkflowState["responseLanguage"]>(),
  question: Annotation<string>()
});

function buildReadingContext(request: ChapterEndAiQuestionRequest) {
  return [
    `Book: ${request.bookTitle}`,
    `Chapter ${request.chapterOrder}: ${request.chapterTitle || "Untitled chapter"}`,
    "Reader status: has reached the end of the current chapter.",
    `Chapter context: ${request.chapterContext}`
  ].join("\n\n");
}

function buildSystemPrompt(personaPrompt: string, responseLanguage: ChapterEndAiQuestionWorkflowState["responseLanguage"]) {
  return [
    personaPrompt,
    "You are assisting a reader inside the product 'A Room of One's Own'.",
    "The reader has just finished a chapter and paused at its end.",
    getResponseLanguageInstruction(responseLanguage),
    "Generate exactly one short, specific, literary question for the reader about the current completed chapter.",
    "The question must feel like companionship rather than a reading-comprehension exam.",
    responseLanguage === "en" ? "Return the final question in natural English." : "Return the final question in natural Chinese.",
    "Do not output multiple questions, bullet lists, explanations, or follow-up commentary.",
    "Return only the question itself."
  ].join("\n\n");
}

function buildUserPrompt(readingContext: string) {
  return [
    "Generate one lightweight chapter-end question for the reader.",
    "Reading context:",
    readingContext
  ].join("\n\n");
}

function sanitizeChapterEndQuestion(question: string, responseLanguage: ChapterEndAiQuestionWorkflowState["responseLanguage"]) {
  const normalized = question.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  const firstLine = normalized.split(/\n+/)[0]?.trim() ?? "";
  const firstQuestionEnd = firstLine.search(/[?？]/);
  const bounded = firstQuestionEnd >= 0 ? firstLine.slice(0, firstQuestionEnd + 1) : firstLine;
  const noLeadingPreamble = bounded
    .replace(/^(问题[:：]\s*|你可以想想[:：]\s*|也许可以问[:：]\s*)/i, "")
    .trim();
  const questionMark = getQuestionMark(responseLanguage);
  const withQuestionMark = new RegExp(`[?？]$`).test(noLeadingPreamble) ? noLeadingPreamble : `${noLeadingPreamble}${questionMark}`;

  return withQuestionMark.length > 120 ? `${withQuestionMark.slice(0, 117).trimEnd()}...` : withQuestionMark;
}

const chapterEndQuestionWorkflow = new StateGraph(ChapterEndQuestionState)
  .addNode("buildReadingContext", async (state) => ({
    readingContext: buildReadingContext(state.request),
    responseLanguage: inferResponseLanguage([state.request.bookTitle, state.request.chapterTitle, state.request.chapterContext], "zh")
  }))
  .addNode("loadPersonaPrompt", async () => ({
    personaPrompt: await loadWoolfPersonaPrompt()
  }))
  .addNode("generateQuestion", async (state) => {
    const result = await generateDeepSeekChatCompletion({
      systemPrompt: buildSystemPrompt(state.personaPrompt, state.responseLanguage),
      userPrompt: buildUserPrompt(state.readingContext),
      maxTokens: 700
    });

    return {
      question: sanitizeChapterEndQuestion(result.answer, state.responseLanguage)
    };
  })
  .addEdge(START, "buildReadingContext")
  .addEdge("buildReadingContext", "loadPersonaPrompt")
  .addEdge("loadPersonaPrompt", "generateQuestion")
  .addEdge("generateQuestion", END)
  .compile();

export async function runChapterEndAiQuestionWorkflow(request: ChapterEndAiQuestionRequest) {
  const result = await chapterEndQuestionWorkflow.invoke({
    request,
    readingContext: "",
    personaPrompt: "",
    responseLanguage: "zh",
    question: ""
  });

  if (!result.question) {
    throw new Error("Unable to generate a chapter-end question right now.");
  }

  return {
    question: result.question
  };
}
