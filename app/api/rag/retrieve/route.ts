import { NextResponse } from "next/server";
import {
  BookRetrievalAccessError,
  BookRetrievalNotFoundError,
  BookRetrievalSourceUnavailableError,
  retrieveBookChunksForUser
} from "@/lib/rag/retrieval";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { RetrieveBookChunksApiResponse, RetrieveBookChunksRequest } from "@/types/rag";

export const runtime = "nodejs";

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeOptionalId(value: unknown, maxLength: number) {
  const normalized = normalizeText(value, maxLength);
  return normalized || null;
}

function normalizeTopK(value: unknown) {
  return Number.isFinite(value) ? Number(value) : undefined;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json<RetrieveBookChunksApiResponse>(
        { error: "Login is required before retrieving RAG chunks." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as RetrieveBookChunksRequest;
    const bookId = normalizeText(payload.bookId, 80);
    const question = normalizeText(payload.question, 2000);
    const chapterId = normalizeOptionalId(payload.chapterId, 80);
    const paragraphId = normalizeOptionalId(payload.paragraphId, 80);
    const topK = normalizeTopK(payload.topK);

    if (!bookId) {
      return NextResponse.json<RetrieveBookChunksApiResponse>({ error: "Missing bookId." }, { status: 400 });
    }

    if (!question) {
      return NextResponse.json<RetrieveBookChunksApiResponse>({ error: "Missing question." }, { status: 400 });
    }

    const result = await retrieveBookChunksForUser({
      bookId,
      userId: user.id,
      question,
      chapterId,
      paragraphId,
      topK
    });

    return NextResponse.json<RetrieveBookChunksApiResponse>({
      ok: true,
      bookId: result.bookId,
      topK: result.topK,
      chunks: result.chunks
    });
  } catch (error) {
    if (error instanceof BookRetrievalNotFoundError) {
      return NextResponse.json<RetrieveBookChunksApiResponse>({ error: error.message }, { status: 404 });
    }

    if (error instanceof BookRetrievalAccessError) {
      return NextResponse.json<RetrieveBookChunksApiResponse>({ error: error.message }, { status: 403 });
    }

    if (error instanceof BookRetrievalSourceUnavailableError) {
      return NextResponse.json<RetrieveBookChunksApiResponse>({ error: error.message }, { status: 400 });
    }

    return NextResponse.json<RetrieveBookChunksApiResponse>(
      { error: error instanceof Error ? error.message : "Unable to retrieve RAG chunks for this book right now." },
      { status: 500 }
    );
  }
}
