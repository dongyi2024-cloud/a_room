import { NextResponse } from "next/server";
import { runSelectionAiWorkflow } from "@/lib/ai/selection-workflow";
import { inferQuestionIntent, recordReadingBehaviorEvent } from "@/lib/reading-slump/data";
import { getAccessibleReaderBook } from "@/lib/reader/books";
import { getCurrentUser } from "@/lib/supabase/auth";
import type {
  SelectionAiExplanationContext,
  SelectionAiExplanationMode,
  SelectionAiRequest,
  SelectionAiTurn
} from "@/types/ai";
import type { ReaderChapter, ReaderParagraph } from "@/types/reader";

export const runtime = "nodejs";
const SELECTION_AI_ROUTE_TIMEOUT_MS = Number.parseInt(process.env.SELECTION_AI_TIMEOUT_MS?.trim() || "85000", 10);

type SelectionPayload = {
  bookId?: string;
  chapterOrder?: number;
  paragraphOrder?: number | null;
  selectedText?: string;
  explanationMode?: unknown;
  explanationContext?: unknown;
  question?: string;
  priorTurns?: unknown;
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

  return content.length > 800 ? `${content.slice(0, 800)}...` : content;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function runSelectionAiWorkflowWithTimeout(request: SelectionAiRequest) {
  const timeoutMs =
    Number.isFinite(SELECTION_AI_ROUTE_TIMEOUT_MS) && SELECTION_AI_ROUTE_TIMEOUT_MS > 0
      ? SELECTION_AI_ROUTE_TIMEOUT_MS
      : 85000;

  return await Promise.race([
    runSelectionAiWorkflow(request),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Selection AI timed out before the answer could be returned."));
      }, timeoutMs);
    })
  ]);
}

function normalizeExplanationMode(value: unknown): SelectionAiExplanationMode {
  return value === "close_reading" ? "close_reading" : "plain";
}

function normalizeExplanationContext(value: unknown): SelectionAiExplanationContext | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const targetText = normalizeText((value as { targetText?: unknown }).targetText, 300);
  const explanation = normalizeText((value as { explanation?: unknown }).explanation, 1200);

  if (!targetText || !explanation) {
    return null;
  }

  return {
    targetText,
    explanation
  };
}

function normalizePriorTurns(value: unknown): SelectionAiTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-6)
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const question = normalizeText((entry as { question?: unknown }).question, 600);
      const answer = normalizeText((entry as { answer?: unknown }).answer, 2400);
      const truncated = Boolean((entry as { truncated?: unknown }).truncated);

      if (!question || !answer) {
        return null;
      }

      return {
        question,
        answer,
        truncated
      };
    })
    .filter((entry): entry is SelectionAiTurn => entry !== null);
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before asking AI about selected text.", 401);
    }

    const payload = (await request.json()) as SelectionPayload;
    const bookId = normalizeText(payload.bookId, 80);
    const selectedText = normalizeText(payload.selectedText, 1800);
    const explanationMode = normalizeExplanationMode(payload.explanationMode);
    const explanationContext = normalizeExplanationContext(payload.explanationContext);
    const question = normalizeText(payload.question, 600);
    const priorTurns = normalizePriorTurns(payload.priorTurns);
    const chapterOrder = Number.isFinite(payload.chapterOrder) ? Number(payload.chapterOrder) : 1;
    const paragraphOrder =
      payload.paragraphOrder === null || payload.paragraphOrder === undefined || !Number.isFinite(payload.paragraphOrder)
        ? null
        : Number(payload.paragraphOrder);

    if (!bookId) {
      return errorResponse("Missing bookId.", 400);
    }

    if (!selectedText) {
      return errorResponse("Select text in the reader before asking AI.", 400);
    }

    if (!question) {
      return errorResponse("Enter a question before asking AI.", 400);
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
    const aiRequest: SelectionAiRequest = {
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
      explanationMode,
      explanationContext,
      question,
      priorTurns
    };

    try {
      await recordReadingBehaviorEvent({
        userId: user.id,
        bookId: book.id,
        eventType: "selection_ai_question",
        chapterOrder: chapter.orderIndex,
        paragraphOrder: paragraph?.orderIndex ?? null,
        metadata: {
          questionIntent: inferQuestionIntent(question),
          explanationMode,
          hasExplanationContext: Boolean(explanationContext),
          priorTurnCount: priorTurns.length
        }
      });
    } catch (eventError) {
      console.warn("Unable to record selection AI reading event", {
        bookId: book.id,
        chapterId: chapter.id,
        error: eventError
      });
    }

    const result = await runSelectionAiWorkflowWithTimeout(aiRequest);
    console.info("Selection AI completed", {
      bookId: aiRequest.bookId,
      chapterId: aiRequest.chapterId,
      durationMs: Date.now() - startedAt,
      citationCount: result.citations.length,
      academicRecommendationCount: result.academicRecommendations.length,
      academicSourceLeadCount: result.academicSourceLeads.length,
      insufficientEvidence: result.insufficientEvidence
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate an AI answer right now.";
    const isConfigError = message.includes("DeepSeek is not configured");
    const isTimeoutError = message.includes("timed out");
    console.error("Selection AI route failed", {
      durationMs: Date.now() - startedAt,
      error
    });

    return errorResponse(message, isConfigError ? 503 : isTimeoutError ? 504 : 500);
  }
}
