import { NextResponse } from "next/server";
import { buildBoundedChapterContext } from "@/lib/ai/chapter-end-context";
import { buildChapterEndFallbackQuestion } from "@/lib/ai/chapter-end-fallback";
import { runChapterEndAiQuestionWorkflow } from "@/lib/ai/chapter-end-question-workflow";
import { getAccessibleReaderBook } from "@/lib/reader/books";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { ChapterEndAiQuestionRequest } from "@/types/ai";

export const runtime = "nodejs";

type ChapterEndQuestionPayload = {
  bookId?: string;
  chapterOrder?: number;
};

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before loading a chapter-end question.", 401);
    }

    const payload = (await request.json()) as ChapterEndQuestionPayload;
    const bookId = normalizeText(payload.bookId, 80);
    const chapterOrder = Number.isFinite(payload.chapterOrder) ? Number(payload.chapterOrder) : 1;

    if (!bookId) {
      return errorResponse("Missing bookId.", 400);
    }

    const book = await getAccessibleReaderBook(user.id, bookId);

    if (!book) {
      return errorResponse("This book is not available in your bookshelf.", 403);
    }

    const chapter = book.chapters.find((entry) => entry.orderIndex === chapterOrder) ?? null;

    if (!chapter) {
      return errorResponse("This chapter is not available for chapter-end questioning.", 400);
    }

    const chapterContext = buildBoundedChapterContext(chapter);

    if (!chapterContext) {
      return errorResponse("This chapter has no readable context for chapter-end questioning.", 400);
    }

    const aiRequest: ChapterEndAiQuestionRequest = {
      bookId: book.id,
      bookTitle: book.title,
      chapterOrder: chapter.orderIndex,
      chapterTitle: chapter.title,
      chapterContext,
      readerReachedChapterEnd: true
    };

    try {
      const result = await runChapterEndAiQuestionWorkflow(aiRequest);

      return NextResponse.json(result);
    } catch {
      return NextResponse.json({
        question: buildChapterEndFallbackQuestion({
          chapterTitle: aiRequest.chapterTitle,
          chapterContext: aiRequest.chapterContext
        })
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load a chapter-end question right now.";
    const isConfigError = message.includes("DeepSeek is not configured");

    return errorResponse(message, isConfigError ? 503 : 500);
  }
}
