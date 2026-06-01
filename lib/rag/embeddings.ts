import "server-only";

import {
  SILICONFLOW_EMBEDDING_MODEL,
  generateSiliconFlowEmbeddings
} from "@/lib/ai/siliconflow";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { GenerateBookEmbeddingsResult } from "@/types/rag";
import type { Database } from "@/types/supabase";

type RagStatus = Database["public"]["Tables"]["books"]["Row"]["rag_status"];
type BookRow = Database["public"]["Tables"]["books"]["Row"];
type ChunkRow = Database["public"]["Tables"]["book_chunks"]["Row"];
type BookChunkUpdate = Database["public"]["Tables"]["book_chunks"]["Update"];

const EMBEDDING_BATCH_SIZE = 20;

type EligibleChunk = Pick<ChunkRow, "id" | "content" | "chunk_index">;

type EmbedBatchResult = {
  successes: Array<{ chunkId: string; embedding: number[] }>;
  failures: Array<{ chunkId: string; error: string }>;
};

export class BookEmbeddingsNotFoundError extends Error {
  constructor(message = "Book record was not found.") {
    super(message);
    this.name = "BookEmbeddingsNotFoundError";
  }
}

export class BookEmbeddingsAccessError extends Error {
  constructor(message = "This book does not belong to the current user's private bookshelf.") {
    super(message);
    this.name = "BookEmbeddingsAccessError";
  }
}

export class BookEmbeddingsSourceUnavailableError extends Error {
  constructor(message = "This book is not ready for embedding generation.") {
    super(message);
    this.name = "BookEmbeddingsSourceUnavailableError";
  }
}

async function getOwnedChunkedBook(bookId: string, userId: string) {
  const serviceClient = getSupabaseServiceRoleClient();
  const { data: book, error: bookError } = await serviceClient
    .from("books")
    .select("id, user_id, import_status, rag_status")
    .eq("id", bookId)
    .maybeSingle();

  if (bookError) {
    throw bookError;
  }

  if (!book) {
    throw new BookEmbeddingsNotFoundError("Book record was not found.");
  }

  if (book.user_id !== userId) {
    throw new BookEmbeddingsAccessError("This book does not belong to the current user's private bookshelf.");
  }

  const { data: shelfRecord, error: shelfError } = await serviceClient
    .from("user_bookshelves")
    .select("id")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();

  if (shelfError) {
    throw shelfError;
  }

  if (!shelfRecord) {
    throw new BookEmbeddingsAccessError("This book is not linked to the current user's private bookshelf.");
  }

  if (book.import_status !== "ready") {
    throw new BookEmbeddingsSourceUnavailableError(
      "This book is not readable yet, so embeddings cannot be generated."
    );
  }

  return book as Pick<BookRow, "id" | "user_id" | "import_status" | "rag_status">;
}

function chunkNeedsEmbedding(chunk: ChunkRow) {
  return chunk.embedding_status !== "ready" || chunk.embedding_model !== SILICONFLOW_EMBEDDING_MODEL || !chunk.embedding;
}

function summarizeRagOutcome(params: {
  totalChunks: number;
  embeddedCount: number;
  skippedCount: number;
  failedCount: number;
}): { ragStatus: RagStatus; ragError: string | null } {
  const { totalChunks, embeddedCount, skippedCount, failedCount } = params;
  const readyCount = embeddedCount + skippedCount;

  if (totalChunks === 0) {
    return {
      ragStatus: "failed",
      ragError: "This book has no generated chunks to embed."
    };
  }

  if (failedCount === 0 && readyCount === totalChunks) {
    return {
      ragStatus: "ready",
      ragError: null
    };
  }

  if (readyCount === 0 && failedCount > 0) {
    return {
      ragStatus: "failed",
      ragError: `${failedCount} chunk embeddings failed during the latest run.`
    };
  }

  return {
    ragStatus: "partial",
    ragError: `${failedCount} chunk embeddings failed during the latest run.`
  };
}

function normalizeEmbeddingError(error: unknown) {
  return error instanceof Error ? error.message : "Embedding generation failed for this chunk.";
}

async function embedBatchWithIsolation(chunks: EligibleChunk[]): Promise<EmbedBatchResult> {
  if (chunks.length === 0) {
    return { successes: [], failures: [] };
  }

  try {
    const vectors = await generateSiliconFlowEmbeddings(chunks.map((chunk) => chunk.content));

      return {
        successes: chunks.map((chunk, index) => ({
          chunkId: chunk.id,
          embedding: vectors[index]!
        })),
        failures: []
      };
  } catch (error) {
    if (chunks.length === 1) {
      return {
        successes: [],
        failures: [
          {
            chunkId: chunks[0].id,
            error: normalizeEmbeddingError(error)
          }
        ]
      };
    }

    const midpoint = Math.floor(chunks.length / 2);
    const leftResult = await embedBatchWithIsolation(chunks.slice(0, midpoint));
    const rightResult = await embedBatchWithIsolation(chunks.slice(midpoint));

    return {
      successes: [...leftResult.successes, ...rightResult.successes],
      failures: [...leftResult.failures, ...rightResult.failures]
    };
  }
}

async function updateBookChunkEmbeddingState(params: {
  chunkId: string;
  values: BookChunkUpdate;
}) {
  const serviceClient = getSupabaseServiceRoleClient();
  const { error } = await serviceClient.from("book_chunks").update(params.values).eq("id", params.chunkId);

  if (error) {
    throw error;
  }
}

async function updateBookRagStatus(params: {
  bookId: string;
  ragStatus: RagStatus;
  ragError: string | null;
}) {
  const serviceClient = getSupabaseServiceRoleClient();
  const { error } = await serviceClient
    .from("books")
    .update({
      rag_status: params.ragStatus,
      rag_error: params.ragError,
      updated_at: new Date().toISOString()
    })
    .eq("id", params.bookId);

  if (error) {
    throw error;
  }
}

export async function generateBookEmbeddingsForUser(params: {
  bookId: string;
  userId: string;
}): Promise<GenerateBookEmbeddingsResult> {
  const { bookId, userId } = params;
  await getOwnedChunkedBook(bookId, userId);
  let processingStarted = false;

  const serviceClient = getSupabaseServiceRoleClient();
  try {
    const { data: chunks, error: chunksError } = await serviceClient
      .from("book_chunks")
      .select(
        "id, book_id, chapter_id, chunk_index, start_paragraph_id, end_paragraph_id, start_paragraph_order, end_paragraph_order, paragraph_count, content, embedding, embedding_model, embedding_status, embedding_error, created_at, updated_at"
      )
      .eq("book_id", bookId)
      .order("chunk_index", { ascending: true });

    if (chunksError) {
      throw chunksError;
    }

    const chunkRows = (chunks ?? []) as ChunkRow[];

    if (chunkRows.length === 0) {
      await updateBookRagStatus({
        bookId,
        ragStatus: "failed",
        ragError: "This book has no generated chunks to embed."
      });
      throw new BookEmbeddingsSourceUnavailableError("This book has no generated chunks for embedding.");
    }

    const eligibleChunks = chunkRows.filter(chunkNeedsEmbedding).map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      chunk_index: chunk.chunk_index
    }));
    const skippedCount = chunkRows.length - eligibleChunks.length;

    await updateBookRagStatus({
      bookId,
      ragStatus: "processing",
      ragError: null
    });
    processingStarted = true;

    if (eligibleChunks.length === 0) {
      await updateBookRagStatus({
        bookId,
        ragStatus: "ready",
        ragError: null
      });

      return {
        bookId,
        chunkCount: chunkRows.length,
        embeddedCount: 0,
        skippedCount,
        failedCount: 0,
        ragStatus: "ready"
      };
    }

    let embeddedCount = 0;
    let failedCount = 0;

    for (let index = 0; index < eligibleChunks.length; index += EMBEDDING_BATCH_SIZE) {
      const batch = eligibleChunks.slice(index, index + EMBEDDING_BATCH_SIZE);
      const result = await embedBatchWithIsolation(batch);

      for (const success of result.successes) {
        await updateBookChunkEmbeddingState({
          chunkId: success.chunkId,
          values: {
            embedding: success.embedding,
            embedding_model: SILICONFLOW_EMBEDDING_MODEL,
            embedding_status: "ready",
            embedding_error: null,
            updated_at: new Date().toISOString()
          }
        });
        embeddedCount += 1;
      }

      for (const failure of result.failures) {
        await updateBookChunkEmbeddingState({
          chunkId: failure.chunkId,
          values: {
            embedding: null,
            embedding_model: SILICONFLOW_EMBEDDING_MODEL,
            embedding_status: "failed",
            embedding_error: failure.error,
            updated_at: new Date().toISOString()
          }
        });
        failedCount += 1;
      }
    }

    const finalOutcome = summarizeRagOutcome({
      totalChunks: chunkRows.length,
      embeddedCount,
      skippedCount,
      failedCount
    });

    await updateBookRagStatus({
      bookId,
      ragStatus: finalOutcome.ragStatus,
      ragError: finalOutcome.ragError
    });

    return {
      bookId,
      chunkCount: chunkRows.length,
      embeddedCount,
      skippedCount,
      failedCount,
      ragStatus: finalOutcome.ragStatus
    };
  } catch (error) {
    if (processingStarted) {
      await updateBookRagStatus({
        bookId,
        ragStatus: "failed",
        ragError: normalizeEmbeddingError(error)
      });
    }

    throw error;
  }
}
