import { NextResponse } from "next/server";
import { buildBoundedChapterContext } from "@/lib/ai/chapter-end-context";
import { runChapterEndAiWorkflow } from "@/lib/ai/chapter-end-workflow";
import { getAccessibleReaderBook } from "@/lib/reader/books";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { ChapterEndAiRequest } from "@/types/ai";
import type { ReaderChapter } from "@/types/reader";

export const runtime = "nodejs";

type ChapterEndPayload = {
  bookId?: string;
  chapterOrder?: number;
  question?: string;
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

function findChapter(chapters: ReaderChapter[], chapterOrder: number) {
  return chapters.find((chapter) => chapter.orderIndex === chapterOrder) ?? null;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before chatting with Woolf at chapter end.", 401);
    }

    const payload = (await request.json()) as ChapterEndPayload;
    const bookId = normalizeText(payload.bookId, 80);
    const question = normalizeText(payload.question, 600);
    const chapterOrder = Number.isFinite(payload.chapterOrder) ? Number(payload.chapterOrder) : 1;

    if (!bookId) {
      return errorResponse("Missing bookId.", 400);
    }

    if (!question) {
      return errorResponse("Enter a question before chatting with Woolf.", 400);
    }

    const book = await getAccessibleReaderBook(user.id, bookId);

    if (!book) {
      return errorResponse("This book is not available in your bookshelf.", 403);
    }

    const chapter = findChapter(book.chapters, chapterOrder);

    if (!chapter) {
      return errorResponse("This chapter is not available for chapter-end interaction.", 400);
    }

    const chapterContext = buildBoundedChapterContext(chapter);

    if (!chapterContext) {
      return errorResponse("This chapter has no readable context for chapter-end interaction.", 400);
    }

    const aiRequest: ChapterEndAiRequest = {
      userId: user.id,
      bookId: book.id,
      bookTitle: book.title,
      chapterOrder: chapter.orderIndex,
      chapterTitle: chapter.title,
      chapterContext,
      question,
      readerReachedChapterEnd: true
    };

    const result = await runChapterEndAiWorkflow(aiRequest);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start a chapter-end Woolf chat right now.";
    const isConfigError = message.includes("DeepSeek is not configured");

    return errorResponse(message, isConfigError ? 503 : 500);
  }
}
