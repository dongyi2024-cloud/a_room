import { NextResponse } from "next/server";
import {
  getLatestReadingSlumpState,
  recordReadingBehaviorEvent
} from "@/lib/reading-slump/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type {
  ReadingBehaviorEventType,
  ReadingEventApiPayload,
  ReadingEventApiResponse,
  ReadingSlumpStateApiResponse
} from "@/types/reading-slump";

export const runtime = "nodejs";

const EVENT_TYPES = new Set<ReadingBehaviorEventType>([
  "reader_opened",
  "chapter_viewed",
  "progress_saved",
  "page_reopened_without_progress",
  "selection_ai_question",
  "reminder_dismissed"
]);

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeOrder(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeOccurredAt(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json<ReadingEventApiResponse | ReadingSlumpStateApiResponse>({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before loading reading slump state.", 401);
    }

    const url = new URL(request.url);
    const bookId = normalizeText(url.searchParams.get("book"), 80);

    if (!bookId) {
      return errorResponse("Missing bookId.", 400);
    }

    const state = await getLatestReadingSlumpState(user.id, bookId);

    if (!state) {
      return errorResponse("This book is not available in your bookshelf.", 403);
    }

    return NextResponse.json<ReadingSlumpStateApiResponse>({ ok: true, state });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load reading slump state.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before recording reading behavior.", 401);
    }

    const payload = (await request.json()) as ReadingEventApiPayload;
    const bookId = normalizeText(payload.bookId, 80);
    const eventType = payload.eventType;

    if (!bookId) {
      return errorResponse("Missing bookId.", 400);
    }

    if (!eventType || !EVENT_TYPES.has(eventType)) {
      return errorResponse("Unsupported reading behavior event type.", 400);
    }

    const state = await recordReadingBehaviorEvent({
      userId: user.id,
      bookId,
      eventType,
      chapterOrder: normalizeOrder(payload.chapterOrder),
      paragraphOrder: normalizeOrder(payload.paragraphOrder),
      occurredAt: normalizeOccurredAt(payload.occurredAt),
      metadata: normalizeMetadata(payload.metadata)
    });

    return NextResponse.json<ReadingEventApiResponse>({ ok: true, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record reading behavior.";
    const status = message.includes("not available") ? 403 : 500;

    return errorResponse(message, status);
  }
}
