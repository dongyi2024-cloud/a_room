import { NextResponse } from "next/server";
import {
  BookEmbeddingsAccessError,
  BookEmbeddingsNotFoundError,
  BookEmbeddingsSourceUnavailableError,
  generateBookEmbeddingsForUser
} from "@/lib/rag/embeddings";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { GenerateBookEmbeddingsApiResponse } from "@/types/rag";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json<GenerateBookEmbeddingsApiResponse>(
        { error: "Login is required before generating book embeddings." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as { bookId?: string };

    if (!payload.bookId) {
      return NextResponse.json<GenerateBookEmbeddingsApiResponse>({ error: "Missing bookId." }, { status: 400 });
    }

    const result = await generateBookEmbeddingsForUser({
      bookId: payload.bookId,
      userId: user.id
    });

    return NextResponse.json<GenerateBookEmbeddingsApiResponse>({
      ok: true,
      bookId: result.bookId,
      chunkCount: result.chunkCount,
      embeddedCount: result.embeddedCount,
      skippedCount: result.skippedCount,
      failedCount: result.failedCount,
      ragStatus: result.ragStatus
    });
  } catch (error) {
    if (error instanceof BookEmbeddingsNotFoundError) {
      return NextResponse.json<GenerateBookEmbeddingsApiResponse>({ error: error.message }, { status: 404 });
    }

    if (error instanceof BookEmbeddingsAccessError) {
      return NextResponse.json<GenerateBookEmbeddingsApiResponse>({ error: error.message }, { status: 403 });
    }

    if (error instanceof BookEmbeddingsSourceUnavailableError) {
      return NextResponse.json<GenerateBookEmbeddingsApiResponse>({ error: error.message }, { status: 400 });
    }

    return NextResponse.json<GenerateBookEmbeddingsApiResponse>(
      { error: error instanceof Error ? error.message : "Unable to generate embeddings for this book right now." },
      { status: 500 }
    );
  }
}
