import { NextResponse } from "next/server";
import {
  getUserReadingPreferences,
  ReadingPreferencesValidationError,
  updateUserReadingPreferences
} from "@/lib/settings/reading-preferences";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { ReadingPreferencesApiResponse } from "@/types/reading-preferences";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json<ReadingPreferencesApiResponse>({ error: message }, { status });
}

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "暂时无法处理阅读设置。";
}

function toFriendlyPreferencesError(error: unknown) {
  const message = getUnknownErrorMessage(error);

  if (
    message.includes("user_app_settings") &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("Could not find the table"))
  ) {
    return "阅读设置数据表还没有准备好。请先在 Supabase SQL Editor 重新执行 supabase/schema.sql。";
  }

  if (message.toLowerCase().includes("row-level security")) {
    return "阅读设置权限策略还没有准备好。请先在 Supabase SQL Editor 重新执行 supabase/schema.sql。";
  }

  return message;
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("登录后才能读取阅读设置。", 401);
    }

    const preferences = await getUserReadingPreferences(user.id);

    return NextResponse.json<ReadingPreferencesApiResponse>({ ok: true, preferences });
  } catch (error) {
    return errorResponse(toFriendlyPreferencesError(error), 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("登录后才能修改阅读设置。", 401);
    }

    const payload = await request.json();
    const preferences = await updateUserReadingPreferences(user.id, {
      themeMode: payload?.themeMode,
      readingSlumpDetectionEnabled: payload?.readingSlumpDetectionEnabled
    });
    const response = NextResponse.json<ReadingPreferencesApiResponse>({ ok: true, preferences });

    response.cookies.set("woolf-room-theme-mode", preferences.themeMode, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365
    });

    return response;
  } catch (error) {
    if (error instanceof ReadingPreferencesValidationError) {
      return errorResponse(error.message, 400);
    }

    return errorResponse(toFriendlyPreferencesError(error), 500);
  }
}
