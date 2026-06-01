import { NextResponse } from "next/server";
import { deleteUserMemory } from "@/lib/memory/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { DeleteMemoryApiResponse } from "@/types/memory";

export const runtime = "nodejs";

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function errorResponse(message: string, status: number) {
  return NextResponse.json<DeleteMemoryApiResponse>({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before deleting memories.", 401);
    }

    const payload = (await request.json()) as { memoryId?: unknown };
    const memoryId = normalizeText(payload.memoryId, 80);

    if (!memoryId) {
      return errorResponse("Missing memoryId.", 400);
    }

    const deleted = await deleteUserMemory({
      userId: user.id,
      memoryId
    });

    if (!deleted) {
      return errorResponse("This memory is not available for the current user.", 404);
    }

    return NextResponse.json<DeleteMemoryApiResponse>({
      ok: true,
      memoryId
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to delete memory right now.", 500);
  }
}
