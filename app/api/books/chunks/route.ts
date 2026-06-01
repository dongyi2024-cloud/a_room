import { NextResponse } from "next/server";
import {
  BookChunkAccessError,
  BookChunkNotFoundError,
  BookChunkSourceUnavailableError,
  generateBookChunksForUser
} from "@/lib/rag/chunking";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { GenerateBookChunksApiResponse } from "@/types/rag";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json<GenerateBookChunksApiResponse>(
        { error: "Login is required before generating book chunks." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as { bookId?: string };

    if (!payload.bookId) {
      return NextResponse.json<GenerateBookChunksApiResponse>({ error: "Missing bookId." }, { status: 400 });
    }

    const result = await generateBookChunksForUser({
      bookId: payload.bookId,
      userId: user.id
    });

    return NextResponse.json<GenerateBookChunksApiResponse>({
      ok: true,
      bookId: result.bookId,
      chunkCount: result.chunkCount
    });
  } catch (error) {
    if (error instanceof BookChunkNotFoundError) {
      return NextResponse.json<GenerateBookChunksApiResponse>({ error: error.message }, { status: 404 });
    }

    if (error instanceof BookChunkAccessError) {
      return NextResponse.json<GenerateBookChunksApiResponse>({ error: error.message }, { status: 403 });
    }

    if (error instanceof BookChunkSourceUnavailableError) {
      return NextResponse.json<GenerateBookChunksApiResponse>({ error: error.message }, { status: 400 });
    }

    return NextResponse.json<GenerateBookChunksApiResponse>(
      { error: error instanceof Error ? error.message : "Unable to generate chunks for this book right now." },
      { status: 500 }
    );
  }
}
