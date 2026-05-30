import { NextResponse } from "next/server";
import {
  PersonalNoteAccessError,
  PersonalNoteSchemaError,
  PersonalNoteValidationError,
  assertPersonalNoteSourceType,
  createPersonalNote,
  listPersonalNotes
} from "@/lib/notes/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { CreatePersonalNoteRequest, PersonalNoteApiResponse } from "@/types/personal-notes";
import type { Json } from "@/types/supabase";

export const runtime = "nodejs";

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function normalizeId(value: unknown) {
  return normalizeText(value, 120);
}

function isJsonObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message } satisfies PersonalNoteApiResponse, { status });
}

function getDatabaseErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const details = typeof candidate.details === "string" ? candidate.details : "";
  const hint = typeof candidate.hint === "string" ? candidate.hint : "";

  if (!message && !details && !hint) {
    return "";
  }

  return [message, details, hint].filter(Boolean).join(" ");
}

function toFriendlyError(error: unknown) {
  if (error instanceof PersonalNoteSchemaError) {
    return "笔记数据库还没有初始化，请先在 Supabase 执行最新 schema。";
  }

  if (error instanceof PersonalNoteValidationError || error instanceof PersonalNoteAccessError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  const databaseMessage = getDatabaseErrorMessage(error);

  if (databaseMessage) {
    return databaseMessage;
  }

  return "暂时无法处理笔记。";
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("请先登录再查看笔记。", 401);
    }

    const notes = await listPersonalNotes(user.id);

    return NextResponse.json({ notes } satisfies PersonalNoteApiResponse);
  } catch (error) {
    console.error("Unable to load personal notes", error);
    return errorResponse(toFriendlyError(error), 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("请先登录再加入笔记。", 401);
    }

    const payload = (await request.json()) as CreatePersonalNoteRequest;
    const bookId = normalizeId(payload.bookId);
    const chapterId = normalizeId(payload.chapterId);
    const paragraphId = normalizeId(payload.paragraphId);
    const sourceType = assertPersonalNoteSourceType(payload.sourceType);

    if (!bookId || !chapterId || !paragraphId) {
      return errorResponse("缺少笔记上下文。", 400);
    }

    const note = await createPersonalNote({
      userId: user.id,
      bookId,
      chapterId,
      paragraphId,
      sourceType,
      sourceText: normalizeText(payload.sourceText, 3000),
      aiContent: normalizeText(payload.aiContent, 5000),
      noteContent: normalizeText(payload.noteContent, 3000),
      metadata: isJsonObject(payload.metadata) ? payload.metadata : {}
    });

    return NextResponse.json({ note } satisfies PersonalNoteApiResponse);
  } catch (error) {
    if (error instanceof PersonalNoteValidationError) {
      return errorResponse(error.message, 400);
    }

    if (error instanceof PersonalNoteAccessError) {
      return errorResponse(error.message, 403);
    }

    console.error("Unable to create personal note", error);
    return errorResponse(toFriendlyError(error), 500);
  }
}
