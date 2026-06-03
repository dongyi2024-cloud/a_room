import { NextResponse } from "next/server";
import { getAuthorStatusForUser } from "@/lib/author-status/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { AuthorStatusApiResponse } from "@/types/author-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeHour(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : null;
}

function normalizeTimezone(value: string | null) {
  if (!value) {
    return null;
  }

  return value.trim().slice(0, 80) || null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before loading the author status card.", 401);
    }

    const url = new URL(request.url);
    const result = await getAuthorStatusForUser(user.id, {
      hour: normalizeHour(url.searchParams.get("hour")),
      timezone: normalizeTimezone(url.searchParams.get("timezone"))
    });

    return NextResponse.json<AuthorStatusApiResponse>({
      period: result.period,
      book_id: result.book_id,
      chapter_id: result.chapter_id,
      woolf_status: result.woolf_status,
      thought_title: result.thought_title,
      thought_body: result.thought_body,
      cta_hint: result.cta_hint,
      from_cache: result.from_cache
    });
  } catch (error) {
    console.error("Unable to load author status card", error);

    return errorResponse("Unable to load the author status card.", 500);
  }
}
