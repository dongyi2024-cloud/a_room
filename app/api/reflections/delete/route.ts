import { NextResponse } from "next/server";
import { deleteReflectionCard } from "@/lib/reflections/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { ReflectionDeleteApiResponse } from "@/types/reflections";

export const runtime = "nodejs";

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message } satisfies ReflectionDeleteApiResponse, { status });
}

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Unable to delete this reflection right now.";
}

function toFriendlyDeleteError(error: unknown) {
  const message = getUnknownErrorMessage(error);

  if (
    message.includes("reflection_cards") &&
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

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before deleting a reflection.", 401);
    }

    const payload = (await request.json()) as {
      cardId?: string;
    };

    const cardId = normalizeText(payload.cardId, 80);

    if (!cardId) {
      return errorResponse("Missing reflection card context.", 400);
    }

    const result = await deleteReflectionCard({
      cardId,
      userId: user.id
    });

    return NextResponse.json(result satisfies ReflectionDeleteApiResponse);
  } catch (error) {
    const message = toFriendlyDeleteError(error);
    const status = message === "你只能删除自己发布的感悟。" ? 403 : 500;

    return errorResponse(message, status);
  }
}
