import { NextResponse } from "next/server";
import { dismissReadingSlumpReminder } from "@/lib/reading-slump/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { ReadingSlumpStateApiResponse } from "@/types/reading-slump";

export const runtime = "nodejs";

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function errorResponse(message: string, status: number) {
  return NextResponse.json<ReadingSlumpStateApiResponse>({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before dismissing reading reminders.", 401);
    }

    const payload = (await request.json()) as { bookId?: string };
    const bookId = normalizeText(payload.bookId, 80);

    if (!bookId) {
      return errorResponse("Missing bookId.", 400);
    }

    const state = await dismissReadingSlumpReminder(user.id, bookId);

    return NextResponse.json<ReadingSlumpStateApiResponse>({ ok: true, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to dismiss reading reminder.";
    const status = message.includes("not available") ? 403 : 500;

    return errorResponse(message, status);
  }
}
