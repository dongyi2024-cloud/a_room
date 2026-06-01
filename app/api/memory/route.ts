import { NextResponse } from "next/server";
import { getUserMemorySettings, listUserMemories } from "@/lib/memory/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { MemoryManagementApiResponse } from "@/types/memory";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json<MemoryManagementApiResponse>({ error: message }, { status });
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before loading memory settings.", 401);
    }

    const [settings, memories] = await Promise.all([
      getUserMemorySettings(user.id),
      listUserMemories(user.id)
    ]);

    return NextResponse.json<MemoryManagementApiResponse>({
      ok: true,
      settings,
      memories
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load memories right now.", 500);
  }
}
