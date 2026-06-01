import "server-only";

import { buildChunksFromParagraphs } from "@/lib/rag/chunking-core";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { GenerateBookChunksResult } from "@/types/rag";
import type { Database } from "@/types/supabase";

type BookRow = Database["public"]["Tables"]["books"]["Row"];
type ChapterRow = Database["public"]["Tables"]["chapters"]["Row"];
type ParagraphRow = Database["public"]["Tables"]["paragraphs"]["Row"];
type BookChunkInsert = Database["public"]["Tables"]["book_chunks"]["Insert"];

export class BookChunkNotFoundError extends Error {
  constructor(message = "Book record was not found.") {
    super(message);
    this.name = "BookChunkNotFoundError";
  }
}

export class BookChunkAccessError extends Error {
  constructor(message = "This book does not belong to the current user's private bookshelf.") {
    super(message);
    this.name = "BookChunkAccessError";
  }
}

export class BookChunkSourceUnavailableError extends Error {
  constructor(message = "This book is not ready for chunk generation.") {
    super(message);
    this.name = "BookChunkSourceUnavailableError";
  }
}

async function getOwnedReadableBook(bookId: string, userId: string) {
  const serviceClient = getSupabaseServiceRoleClient();
  const { data: book, error: bookError } = await serviceClient
    .from("books")
    .select("id, user_id, import_status")
    .eq("id", bookId)
    .maybeSingle();

  if (bookError) {
    throw bookError;
  }

  if (!book) {
    throw new BookChunkNotFoundError("Book record was not found.");
  }

  if (book.user_id !== userId) {
    throw new BookChunkAccessError("This book does not belong to the current user's private bookshelf.");
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
    throw new BookChunkAccessError("This book is not linked to the current user's private bookshelf.");
  }

  if (book.import_status !== "ready") {
    throw new BookChunkSourceUnavailableError("This book is not readable yet, so chunks cannot be generated.");
  }

  return book as Pick<BookRow, "id" | "user_id" | "import_status">;
}

function buildChunkInsertRows(chapters: ChapterRow[], paragraphs: ParagraphRow[], bookId: string) {
  const paragraphsByChapter = new Map<string, ParagraphRow[]>();

  for (const paragraph of paragraphs) {
    const group = paragraphsByChapter.get(paragraph.chapter_id) ?? [];
    group.push(paragraph);
    paragraphsByChapter.set(paragraph.chapter_id, group);
  }

  const orderedSourceParagraphs = chapters.flatMap((chapter) =>
    (paragraphsByChapter.get(chapter.id) ?? [])
      .sort((left, right) => left.order_index - right.order_index)
      .map((paragraph) => ({
        id: paragraph.id,
        chapterId: chapter.id,
        chapterOrder: chapter.order_index,
        paragraphOrder: paragraph.order_index,
        content: paragraph.content
      }))
  );

  const chunks = buildChunksFromParagraphs(orderedSourceParagraphs);

  return chunks.map(
    (chunk) =>
      ({
        book_id: bookId,
        chapter_id: chunk.chapterId,
        chunk_index: chunk.chunkIndex,
        start_paragraph_id: chunk.startParagraphId,
        end_paragraph_id: chunk.endParagraphId,
        start_paragraph_order: chunk.startParagraphOrder,
        end_paragraph_order: chunk.endParagraphOrder,
        paragraph_count: chunk.paragraphCount,
        content: chunk.content
      }) satisfies BookChunkInsert
  );
}

export async function generateBookChunksForUser(params: { bookId: string; userId: string }): Promise<GenerateBookChunksResult> {
  const { bookId, userId } = params;
  await getOwnedReadableBook(bookId, userId);

  const serviceClient = getSupabaseServiceRoleClient();
  const { data: chapters, error: chaptersError } = await serviceClient
    .from("chapters")
    .select("id, book_id, title, order_index, created_at, updated_at")
    .eq("book_id", bookId)
    .order("order_index", { ascending: true });

  if (chaptersError) {
    throw chaptersError;
  }

  const { data: paragraphs, error: paragraphsError } = await serviceClient
    .from("paragraphs")
    .select("id, book_id, chapter_id, order_index, content, created_at, updated_at")
    .eq("book_id", bookId);

  if (paragraphsError) {
    throw paragraphsError;
  }

  const chunkRows = buildChunkInsertRows((chapters ?? []) as ChapterRow[], (paragraphs ?? []) as ParagraphRow[], bookId);

  if (chunkRows.length === 0) {
    throw new BookChunkSourceUnavailableError("This book has no readable paragraph content for chunk generation.");
  }

  const { error: deleteError } = await serviceClient.from("book_chunks").delete().eq("book_id", bookId);

  if (deleteError) {
    throw deleteError;
  }

  const { error: insertError } = await serviceClient.from("book_chunks").insert(chunkRows);

  if (insertError) {
    throw insertError;
  }

  const { error: bookResetError } = await serviceClient
    .from("books")
    .update({
      rag_status: "processing",
      rag_error: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", bookId);

  if (bookResetError) {
    throw bookResetError;
  }

  return {
    bookId,
    chunkCount: chunkRows.length
  };
}
