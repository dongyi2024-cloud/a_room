import "server-only";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { buildAnswerLengthPolicy, enforceAnswerLengthPolicy } from "@/lib/ai/answer-length";
import { generateDeepSeekChatCompletion } from "@/lib/ai/deepseek";
import { enforceWoolfFirstPersonVoice, getWoolfVoiceInstruction, loadWoolfPersonaPrompt } from "@/lib/ai/prompts";
import { getResponseLanguageInstruction, inferResponseLanguage } from "@/lib/ai/response-language";
import { loadAiMemoryContext, recordAiMemoryCandidates } from "@/lib/memory/data";
import type { ChapterEndAiRequest, ChapterEndAiWorkflowState } from "@/types/ai";

const ChapterEndState = Annotation.Root({
  request: Annotation<ChapterEndAiRequest>(),
  readingContext: Annotation<string>(),
  personaPrompt: Annotation<string>(),
  responseLanguage: Annotation<ChapterEndAiWorkflowState["responseLanguage"]>(),
  answerLengthMode: Annotation<ChapterEndAiWorkflowState["answerLengthMode"]>(),
  answerLengthPolicy: Annotation<ChapterEndAiWorkflowState["answerLengthPolicy"]>(),
  memoryContext: Annotation<string>(),
  answer: Annotation<string>(),
  answerWasTruncated: Annotation<boolean>()
});

function buildReadingContext(request: ChapterEndAiRequest) {
  return [
    `Book: ${request.bookTitle}`,
    `Chapter ${request.chapterOrder}: ${request.chapterTitle || "Untitled chapter"}`,
    "Reader status: has reached the end of the current chapter.",
    `Chapter context: ${request.chapterContext}`,
    `User question: ${request.question}`
  ].join("\n\n");
}

function buildSystemPrompt(
  personaPrompt: string,
  memoryContext: string,
  answerLengthMode: ChapterEndAiWorkflowState["answerLengthMode"],
  responseLanguage: ChapterEndAiWorkflowState["responseLanguage"]
) {
  return [
    personaPrompt,
    "You are assisting a reader inside the product 'A Room of One's Own'.",
    getWoolfVoiceInstruction(),
    memoryContext || "Long-term reader memory: none available or memory is disabled for this user.",
    "The reader has just finished a chapter and opened a gentle end-of-chapter conversation.",
    "Stay grounded in the current chapter context and respond as if pausing with the reader at the end of that chapter.",
    getResponseLanguageInstruction(responseLanguage),
    answerLengthMode === "default"
      ? "For ordinary questions, answer in no more than three sentences. Keep the answer short, reflective, and suitable for a chapter-end pause."
      : "The user explicitly asked for more detail. You may answer in more than three sentences, but stay focused on the current chapter."
  ].join("\n\n");
}

function buildUserPrompt(readingContext: string) {
  return [
    "Please answer the reader's chapter-end question.",
    "Reading context:",
    readingContext,
    "The answer should reflect that the chapter has been completed and the reader is pausing at its end."
  ].join("\n\n");
}

function getCompletionMaxTokens(answerLengthMode: ChapterEndAiWorkflowState["answerLengthMode"]) {
  return answerLengthMode === "default" ? 360 : 900;
}

const chapterEndWorkflow = new StateGraph(ChapterEndState)
  .addNode("buildReadingContext", async (state) => {
    const answerLengthPolicy = buildAnswerLengthPolicy(state.request.question);
    const responseLanguage = inferResponseLanguage([state.request.question], "zh");

    return {
      readingContext: buildReadingContext(state.request),
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
  .addNode("generateAnswer", async (state) => {
    const result = await generateDeepSeekChatCompletion({
      systemPrompt: buildSystemPrompt(state.personaPrompt, state.memoryContext, state.answerLengthMode, state.responseLanguage),
      userPrompt: buildUserPrompt(state.readingContext),
      maxTokens: getCompletionMaxTokens(state.answerLengthMode)
    });

    return {
      answer: enforceWoolfFirstPersonVoice(result.answer),
      answerWasTruncated: result.finishReason === "length"
    };
  })
  .addNode("enforceAnswerLength", async (state) => ({
    answer: enforceAnswerLengthPolicy(state.answer, state.answerLengthPolicy)
  }))
  .addNode("proposeMemoryCandidate", async (state) => {
    if (!state.answer) {
      return {};
    }

    try {
      await recordAiMemoryCandidates({
        userId: state.request.userId,
        source: "chapter_end_ai",
        question: state.request.question,
        answer: state.answer,
        answerLengthMode: state.answerLengthMode,
        bookTitle: state.request.bookTitle,
        chapterTitle: state.request.chapterTitle
      });
    } catch (error) {
      console.warn("Unable to record chapter-end memory candidate", {
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
  .addEdge("loadMemoryContext", "generateAnswer")
  .addEdge("generateAnswer", "enforceAnswerLength")
  .addEdge("enforceAnswerLength", "proposeMemoryCandidate")
  .addEdge("proposeMemoryCandidate", END)
  .compile();

export async function runChapterEndAiWorkflow(request: ChapterEndAiRequest) {
  const result = await chapterEndWorkflow.invoke({
    request,
    readingContext: "",
    personaPrompt: "",
    responseLanguage: "zh",
    answerLengthMode: "default",
    answerLengthPolicy: {
      mode: "default",
      maxSentences: 3
    },
    memoryContext: "",
    answer: "",
    answerWasTruncated: false
  });

  return {
    answer: result.answer,
    truncated: result.answerWasTruncated
  };
}
