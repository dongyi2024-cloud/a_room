import { NextResponse } from "next/server";
import {
  createFeedbackReport,
  FeedbackTargetNotFoundError,
  FeedbackValidationError
} from "@/lib/feedback/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { FeedbackReportApiResponse } from "@/types/feedback";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message } satisfies FeedbackReportApiResponse, { status });
}

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "暂时无法提交反馈，请稍后重试。";
}

function toFriendlyFeedbackError(error: unknown) {
  const message = getUnknownErrorMessage(error);

  if (
    (message.includes("feedback_reports") || message.includes("reflection_cards")) &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("Could not find the table") ||
      message.includes("Could not find the"))
  ) {
    return "反馈数据表还没有准备好。请先在 Supabase SQL Editor 重新执行 supabase/schema.sql。";
  }

  if (message.toLowerCase().includes("row-level security")) {
    return "反馈权限策略还没有准备好。请先在 Supabase SQL Editor 重新执行 supabase/schema.sql。";
  }

  return message;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("登录后才能提交反馈。", 401);
    }

    const payload = await request.json();
    const report = await createFeedbackReport(user.id, payload);

    return NextResponse.json({ report } satisfies FeedbackReportApiResponse, { status: 201 });
  } catch (error) {
    if (error instanceof FeedbackValidationError) {
      return errorResponse(error.message, 400);
    }

    if (error instanceof FeedbackTargetNotFoundError) {
      return errorResponse(error.message, 404);
    }

    return errorResponse(toFriendlyFeedbackError(error), 500);
  }
}
