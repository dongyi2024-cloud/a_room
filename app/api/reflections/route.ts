import { NextResponse } from "next/server";
import { createReflectionCard, listReflectionCardsForParagraph } from "@/lib/reflections/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { ReflectionFeedApiResponse } from "@/types/reflections";

export const runtime = "nodejs";

function normalizeQueryNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message } satisfies ReflectionFeedApiResponse, { status });
}

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Unable to process reflections right now.";
}

function toFriendlyReflectionError(error: unknown) {
  const message = getUnknownErrorMessage(error);

  if (
    (message.includes("reflection_cards") || message.includes("reflection_card_likes")) &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("Could not find the table"))
  ) {
    return "Reflection schema is not ready yet. Please re-run supabase/schema.sql in Supabase SQL Editor, then refresh and try again.";
  }

  if (message.toLowerCase().includes("row-level security")) {
    return "Reflection policies are not ready yet. Please re-run supabase/schema.sql in Supabase SQL Editor, then refresh and try again.";
  }

  return message;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before loading reflections.", 401);
    }

    const url = new URL(request.url);
    const bookId = normalizeText(url.searchParams.get("book"), 80);
    const chapterOrder = normalizeQueryNumber(url.searchParams.get("chapter"));
    const paragraphOrder = normalizeQueryNumber(url.searchParams.get("paragraph"));

    if (!bookId || chapterOrder === null || paragraphOrder === null) {
      return errorResponse("Missing paragraph reflection context.", 400);
    }

    const feed = await listReflectionCardsForParagraph({ bookId, chapterOrder, paragraphOrder }, user.id);

    if (!feed) {
      return errorResponse("This paragraph reflection feed is not available.", 404);
    }

    return NextResponse.json(feed satisfies ReflectionFeedApiResponse);
  } catch (error) {
    return errorResponse(toFriendlyReflectionError(error), 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before publishing a reflection.", 401);
    }

    const payload = (await request.json()) as {
      bookId?: string;
      chapterOrder?: number;
      paragraphOrder?: number;
      content?: string;
    };

    const bookId = normalizeText(payload.bookId, 80);
    const content = normalizeText(payload.content, 1200);
    const chapterOrder = Number.isFinite(payload.chapterOrder) ? Number(payload.chapterOrder) : null;
    const paragraphOrder = Number.isFinite(payload.paragraphOrder) ? Number(payload.paragraphOrder) : null;

    if (!bookId || chapterOrder === null || paragraphOrder === null) {
      return errorResponse("Missing paragraph reflection context.", 400);
    }

    const created = await createReflectionCard({
      userId: user.id,
      bookId,
      chapterOrder,
      paragraphOrder,
      content
    });
    let refreshed = null;

    try {
      refreshed = await listReflectionCardsForParagraph({ bookId, chapterOrder, paragraphOrder }, user.id);
    } catch (refreshError) {
      const refreshMessage = getUnknownErrorMessage(refreshError);

      if (!refreshMessage.includes("reflection_cards")) {
        throw refreshError;
      }
    }

    return NextResponse.json(
      refreshed ?? {
        context: created.context,
        cards: [created.card]
      }
    );
  } catch (error) {
    return errorResponse(toFriendlyReflectionError(error), 500);
  }
}
