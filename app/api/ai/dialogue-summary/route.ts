import { NextResponse } from "next/server";
import { runDialogueSummaryWorkflow } from "@/lib/ai/dialogue-summary-workflow";
import {
  PersonalNoteAccessError,
  PersonalNoteValidationError,
  getOwnedNoteContext
} from "@/lib/notes/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { DialogueSummaryApiResponse, DialogueSummaryTurn } from "@/types/ai";

export const runtime = "nodejs";

type DialogueSummaryPayload = {
  bookId?: unknown;
  bookTitle?: unknown;
  chapterId?: unknown;
  chapterOrder?: unknown;
  chapterTitle?: unknown;
  paragraphId?: unknown;
  paragraphOrder?: unknown;
  paragraphText?: unknown;
  selectedText?: unknown;
  conversationReference?: unknown;
  turns?: unknown;
};

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeTurns(value: unknown): DialogueSummaryTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((turn) => {
      if (!turn || typeof turn !== "object") {
        return null;
      }

      const candidate = turn as { question?: unknown; answer?: unknown };
      const question = normalizeText(candidate.question, 500);
      const answer = normalizeText(candidate.answer, 1200);

      return question && answer ? { question, answer } : null;
    })
    .filter((turn): turn is DialogueSummaryTurn => Boolean(turn))
    .slice(-8);
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message } satisfies DialogueSummaryApiResponse, { status });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("请先登录再生成对话摘要。", 401);
    }

    const payload = (await request.json()) as DialogueSummaryPayload;
    const bookId = normalizeText(payload.bookId, 120);
    const chapterId = normalizeText(payload.chapterId, 120);
    const paragraphId = normalizeText(payload.paragraphId, 120);
    const selectedText = normalizeText(payload.selectedText, 3000);
    const turns = normalizeTurns(payload.turns);

    if (!bookId || !chapterId || !paragraphId || !selectedText || turns.length === 0) {
      return errorResponse("这段对话还不能生成摘要。", 400);
    }

    const context = await getOwnedNoteContext({
      userId: user.id,
      bookId,
      chapterId,
      paragraphId
    });
    const chapterOrder = normalizeNumber(payload.chapterOrder) ?? context.chapterOrder;
    const paragraphOrder = normalizeNumber(payload.paragraphOrder) ?? context.paragraphOrder;
    const bookTitle = normalizeText(payload.bookTitle, 240) || context.bookTitle;
    const chapterTitle = normalizeText(payload.chapterTitle, 240) || context.chapterTitle;
    const paragraphText = normalizeText(payload.paragraphText, 5000) || context.paragraphExcerpt;
    const conversationReference =
      normalizeText(payload.conversationReference, 240) ||
      `selection:${bookId}:${chapterId}:${paragraphId}:${selectedText.slice(0, 40)}`;

    const draft = await runDialogueSummaryWorkflow({
      userId: user.id,
      bookId,
      bookTitle,
      chapterId,
      chapterOrder,
      chapterTitle,
      paragraphId,
      paragraphOrder,
      paragraphText,
      selectedText,
      conversationReference,
      turns
    });

    return NextResponse.json({ draft } satisfies DialogueSummaryApiResponse);
  } catch (error) {
    if (error instanceof PersonalNoteValidationError) {
      return errorResponse(error.message, 400);
    }

    if (error instanceof PersonalNoteAccessError) {
      return errorResponse(error.message, 403);
    }

    console.error("Unable to generate dialogue summary", error);
    return errorResponse(error instanceof Error ? error.message : "暂时无法生成对话摘要。", 500);
  }
}
