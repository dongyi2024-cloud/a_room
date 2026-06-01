import { NextResponse } from "next/server";
import { setUserMemoryEnabled } from "@/lib/memory/data";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { MemorySettingsApiResponse } from "@/types/memory";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json<MemorySettingsApiResponse>({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("Login is required before changing memory settings.", 401);
    }

    const payload = (await request.json()) as { memoryEnabled?: unknown };

    if (typeof payload.memoryEnabled !== "boolean") {
      return errorResponse("Missing memoryEnabled setting.", 400);
    }

    const settings = await setUserMemoryEnabled(user.id, payload.memoryEnabled);

    return NextResponse.json<MemorySettingsApiResponse>({
      ok: true,
      settings
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to update memory settings right now.", 500);
  }
}
