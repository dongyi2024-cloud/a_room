import { NextResponse } from "next/server";
import { runAcademicRecommendationWorkflow } from "@/lib/academic-recommendations/workflow";
import { getAccessibleReaderBook } from "@/lib/reader/books";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { ReaderChapter, ReaderParagraph } from "@/types/reader";

export const runtime = "nodejs";

type AcademicRecommendationPayload = {
  bookId?: string;
  chapterOrder?: number;
  paragraphOrder?: number | null;
  selectedText?: string;
  question?: string;
};

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function findChapter(chapters: ReaderChapter[], chapterOrder: number) {
  return chapters.find((chapter) => chapter.orderIndex === chapterOrder) ?? chapters[0] ?? null;
}

function findParagraph(chapter: ReaderChapter, paragraphOrder: number | null, selectedText: string) {
  if (paragraphOrder !== null) {
    const paragraph = chapter.paragraphs.find((entry) => entry.orderIndex === paragraphOrder);

    if (paragraph) {
      return paragraph;
    }
  }

  return chapter.paragraphs.find((paragraph) => paragraph.content.includes(selectedText)) ?? chapter.paragraphs[0] ?? null;
}

function getParagraphContext(paragraph: ReaderParagraph | null, selectedText: string) {
  if (!paragraph) {
    return selectedText;
  }

  const content = paragraph.content.replace(/\s+/g, " ").trim();
  return content.length > 900 ? `${content.slice(0, 900)}...` : content;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before requesting academic recommendations.", 401);
    }

    const payload = (await request.json()) as AcademicRecommendationPayload;
    const bookId = normalizeText(payload.bookId, 80);
    const selectedText = normalizeText(payload.selectedText, 1800);
    const question = normalizeText(payload.question, 600);
    const chapterOrder = Number.isFinite(payload.chapterOrder) ? Number(payload.chapterOrder) : 1;
    const paragraphOrder =
      payload.paragraphOrder === null || payload.paragraphOrder === undefined || !Number.isFinite(payload.paragraphOrder)
        ? null
        : Number(payload.paragraphOrder);

    if (!bookId) {
      return errorResponse("Missing bookId.", 400);
    }

    if (!selectedText) {
      return errorResponse("Select text in the reader before requesting academic recommendations.", 400);
    }

    const book = await getAccessibleReaderBook(user.id, bookId);

    if (!book) {
      return errorResponse("This book is not available in your bookshelf.", 403);
    }

    const chapter = findChapter(book.chapters, chapterOrder);

    if (!chapter) {
      return errorResponse("This book has no readable chapter context.", 400);
    }

    const paragraph = findParagraph(chapter, paragraphOrder, selectedText);
    const result = await runAcademicRecommendationWorkflow({
      userId: user.id,
      bookId: book.id,
      bookTitle: book.title,
      chapterId: chapter.id,
      chapterOrder: chapter.orderIndex,
      chapterTitle: chapter.title,
      paragraphId: paragraph?.id ?? null,
      paragraphOrder: paragraph?.orderIndex ?? null,
      paragraphText: getParagraphContext(paragraph, selectedText),
      selectedText,
      question
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Academic recommendations route failed", { error });
    return errorResponse("Unable to load academic recommendations right now.", 500);
  }
}
