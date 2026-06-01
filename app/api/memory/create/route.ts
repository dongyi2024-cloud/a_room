import { NextResponse } from "next/server";
import { createManualUserMemory, getUserMemorySettings } from "@/lib/memory/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { CreateMemoryApiResponse, UserMemoryType } from "@/types/memory";

export const runtime = "nodejs";

const MEMORY_TYPES: UserMemoryType[] = [
  "explanation_style",
  "interpretive_interest",
  "recurring_question",
  "answer_length",
  "reading_assistance"
];

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeMemoryType(value: unknown): UserMemoryType | null {
  return typeof value === "string" && MEMORY_TYPES.includes(value as UserMemoryType) ? (value as UserMemoryType) : null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json<CreateMemoryApiResponse>({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before creating memories.", 401);
    }

    const payload = (await request.json()) as { memoryType?: unknown; content?: unknown };
    const memoryType = normalizeMemoryType(payload.memoryType);
    const content = normalizeText(payload.content, 180);

    if (!memoryType) {
      return errorResponse("Choose a valid memory type.", 400);
    }

    if (content.length < 4) {
      return errorResponse("Memory content is too short.", 400);
    }

    const settings = await getUserMemorySettings(user.id);

    if (!settings.memoryEnabled) {
      return errorResponse("Turn on long-term memory before creating a memory.", 409);
    }

    const memory = await createManualUserMemory({
      userId: user.id,
      memoryType,
      content
    });

    return NextResponse.json<CreateMemoryApiResponse>({
      ok: true,
      memory
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to create memory right now.", 500);
  }
}
