import { NextResponse } from "next/server";
import { buildCommunityShareDraft, PersonalNoteAccessError, PersonalNoteSchemaError, PersonalNoteValidationError } from "@/lib/notes/data";
import { normalizeCommunityShareContent } from "@/lib/notes/community-share";
import { createReflectionCard } from "@/lib/reflections/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type {
  CommunityShareApiResponse,
  CommunityShareDraftResponse,
  CommunitySharePublishRequest,
  CommunitySharePublishResponse
} from "@/types/community-share";

export const runtime = "nodejs";

function normalizeId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message } satisfies CommunityShareApiResponse, { status });
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

  return "暂时无法分享这条笔记。";
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("请先登录再分享到社区。", 401);
    }

    const url = new URL(request.url);
    const noteId = normalizeId(url.searchParams.get("noteId"));

    if (!noteId) {
      return errorResponse("缺少要分享的笔记。", 400);
    }

    const draft = await buildCommunityShareDraft({
      userId: user.id,
      noteId
    });

    return NextResponse.json({ draft } satisfies CommunityShareDraftResponse);
  } catch (error) {
    console.error("Unable to build community share draft", error);
    return errorResponse(toFriendlyError(error), 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("请先登录再分享到社区。", 401);
    }

    const payload = (await request.json()) as CommunitySharePublishRequest;
    const noteId = normalizeId(payload.noteId);
    const content = normalizeCommunityShareContent(payload.content, 1200);

    if (!noteId) {
      return errorResponse("缺少要分享的笔记。", 400);
    }

    if (!content) {
      return errorResponse("分享内容不能为空。", 400);
    }

    const draft = await buildCommunityShareDraft({
      userId: user.id,
      noteId
    });

    const created = await createReflectionCard({
      userId: user.id,
      bookId: draft.context.bookId,
      chapterOrder: draft.context.chapterOrder,
      paragraphOrder: draft.context.paragraphOrder,
      content
    });

    return NextResponse.json({
      draft: {
        ...draft,
        content
      },
      card: created.card
    } satisfies CommunitySharePublishResponse);
  } catch (error) {
    console.error("Unable to publish community share from note", error);
    return errorResponse(toFriendlyError(error), 500);
  }
}
