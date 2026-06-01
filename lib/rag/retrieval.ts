import "server-only";

import {
  SILICONFLOW_EMBEDDING_MODEL,
  generateSiliconFlowEmbeddings
} from "@/lib/ai/siliconflow";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { RetrieveBookChunksResult, RetrievedBookChunk } from "@/types/rag";
import type { Database } from "@/types/supabase";

type BookRow = Database["public"]["Tables"]["books"]["Row"];
type MatchBookChunksRow = Database["public"]["Functions"]["match_book_chunks"]["Returns"][number];

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;

export class BookRetrievalNotFoundError extends Error {
  constructor(message = "Book record was not found.") {
    super(message);
    this.name = "BookRetrievalNotFoundError";
  }
}

export class BookRetrievalAccessError extends Error {
  constructor(message = "This book does not belong to the current user's private bookshelf.") {
    super(message);
    this.name = "BookRetrievalAccessError";
  }
}

export class BookRetrievalSourceUnavailableError extends Error {
  constructor(message = "This book is not ready for RAG retrieval.") {
    super(message);
    this.name = "BookRetrievalSourceUnavailableError";
  }
}

function normalizeTopK(topK: number | null | undefined) {
  if (!Number.isFinite(topK)) {
    return DEFAULT_TOP_K;
  }

  return Math.max(1, Math.min(MAX_TOP_K, Math.floor(topK as number)));
}

function toVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

async function getOwnedRetrievableBook(bookId: string, userId: string) {
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
    throw new BookRetrievalNotFoundError("Book record was not found.");
  }

  if (book.user_id !== userId) {
    throw new BookRetrievalAccessError("This book does not belong to the current user's private bookshelf.");
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
    throw new BookRetrievalAccessError("This book is not linked to the current user's private bookshelf.");
  }

  if (book.import_status !== "ready") {
    throw new BookRetrievalSourceUnavailableError("This book is not readable yet, so retrieval cannot run.");
  }

  return book as Pick<BookRow, "id" | "user_id" | "import_status" | "rag_status">;
}

async function assertBookHasReadyEmbeddings(bookId: string) {
  const serviceClient = getSupabaseServiceRoleClient();
  const { count, error } = await serviceClient
    .from("book_chunks")
    .select("id", { count: "exact", head: true })
    .eq("book_id", bookId)
    .eq("embedding_status", "ready")
    .eq("embedding_model", SILICONFLOW_EMBEDDING_MODEL)
    .not("embedding", "is", null);

  if (error) {
    throw error;
  }

  if (!count) {
    throw new BookRetrievalSourceUnavailableError(
      "This book does not have retrieval-ready embeddings yet."
    );
  }
}

function normalizeRetrievalRows(rows: MatchBookChunksRow[]): RetrievedBookChunk[] {
  return rows.map((row) => ({
    chunkId: row.chunk_id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    chapterTitle: row.chapter_title,
    startParagraphId: row.start_paragraph_id,
    endParagraphId: row.end_paragraph_id,
    startParagraphOrder: row.start_paragraph_order,
    endParagraphOrder: row.end_paragraph_order,
    content: row.content,
    similarity: row.similarity
  }));
}

export async function retrieveBookChunksForUser(params: {
  bookId: string;
  userId: string;
  question: string;
  chapterId?: string | null;
  paragraphId?: string | null;
  topK?: number | null;
}): Promise<RetrieveBookChunksResult> {
  const { bookId, userId, question, chapterId = null, paragraphId = null, topK } = params;

  await getOwnedRetrievableBook(bookId, userId);
  await assertBookHasReadyEmbeddings(bookId);

  const [queryEmbedding] = await generateSiliconFlowEmbeddings([question]);

  if (!queryEmbedding) {
    throw new Error("SiliconFlow did not return a query embedding.");
  }

  const serviceClient = getSupabaseServiceRoleClient();
  const normalizedTopK = normalizeTopK(topK);
  const { data, error } = await serviceClient.rpc("match_book_chunks", {
    target_book_id: bookId,
    query_embedding_text: toVectorLiteral(queryEmbedding),
    target_chapter_id: chapterId,
    target_paragraph_id: paragraphId,
    match_count: normalizedTopK
  });

  if (error) {
    throw error;
  }

  return {
    bookId,
    topK: normalizedTopK,
    chunks: normalizeRetrievalRows((data ?? []) as MatchBookChunksRow[])
  };
}
