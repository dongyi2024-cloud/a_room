import "server-only";

import { BOOK_FILES_BUCKET } from "@/lib/bookshelf/constants";
import { parseEpubBuffer, type ParsedEpubCover, type ParsedEpubPayload } from "@/lib/bookshelf/epub-parser";
import { toShortErrorMessage } from "@/lib/bookshelf/helpers";
import { ensureBookFilesBucket } from "@/lib/bookshelf/storage";
import { generateBookChunksForUser } from "@/lib/rag/chunking";
import { generateBookEmbeddingsForUser } from "@/lib/rag/embeddings";
import { generateBookSmartMarksForUser } from "@/lib/smart-marks/generation";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export class BookImportNotFoundError extends Error {
  constructor(message = "Book import record was not found.") {
    super(message);
    this.name = "BookImportNotFoundError";
  }
}

export class BookImportAccessError extends Error {
  constructor(message = "You cannot process a book that does not belong to the current user.") {
    super(message);
    this.name = "BookImportAccessError";
  }
}

async function uploadCoverIfPresent(userId: string, bookId: string, cover?: ParsedEpubCover) {
  if (!cover) {
    return null;
  }

  try {
    const storagePath = `${userId}/${bookId}/cover${cover.extension}`;
    const serviceClient = getSupabaseServiceRoleClient();
    await ensureBookFilesBucket(serviceClient);
    const { error } = await serviceClient.storage.from(BOOK_FILES_BUCKET).upload(storagePath, cover.buffer, {
      upsert: true,
      contentType: cover.contentType
    });

    if (error) {
      throw error;
    }

    return storagePath;
  } catch {
    return null;
  }
}

async function getOwnedBookForProcessing(bookId: string, userId: string) {
  const serviceClient = getSupabaseServiceRoleClient();
  const { data: book, error: bookError } = await serviceClient
    .from("books")
    .select("id, user_id, source_storage_path")
    .eq("id", bookId)
    .maybeSingle();

  if (bookError) {
    throw bookError;
  }

  if (!book) {
    throw new BookImportNotFoundError("Book import record was not found.");
  }

  if (book.user_id !== userId) {
    throw new BookImportAccessError("This book does not belong to the current user's private bookshelf.");
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
    throw new BookImportAccessError("This book is not linked to the current user's private bookshelf.");
  }

  return book;
}

async function markBookProcessing(bookId: string) {
  const serviceClient = getSupabaseServiceRoleClient();
  const { error } = await serviceClient
    .from("books")
    .update({
      import_status: "processing",
      import_error: null,
      rag_status: "processing",
      rag_error: null
    })
    .eq("id", bookId);

  if (error) {
    throw error;
  }
}

async function replaceBookContent(
  bookId: string,
  payload: ParsedEpubPayload,
  coverStoragePath: string | null
) {
  const serviceClient = getSupabaseServiceRoleClient();

  const { error: deleteParagraphsError } = await serviceClient.from("paragraphs").delete().eq("book_id", bookId);

  if (deleteParagraphsError) {
    throw deleteParagraphsError;
  }

  const { error: deleteChaptersError } = await serviceClient.from("chapters").delete().eq("book_id", bookId);

  if (deleteChaptersError) {
    throw deleteChaptersError;
  }

  const { data: insertedChapters, error: chapterInsertError } = await serviceClient
    .from("chapters")
    .insert(
      payload.chapters.map((chapter) => ({
        book_id: bookId,
        title: chapter.title,
        order_index: chapter.order_index
      }))
    )
    .select("id, order_index");

  if (chapterInsertError) {
    throw chapterInsertError;
  }

  const chapterIdByOrder = new Map((insertedChapters ?? []).map((chapter) => [chapter.order_index, chapter.id]));
  const paragraphRows = payload.chapters.flatMap((chapter) =>
    chapter.paragraphs.map((paragraph) => ({
      book_id: bookId,
      chapter_id: chapterIdByOrder.get(chapter.order_index)!,
      order_index: paragraph.order_index,
      content: paragraph.content
    }))
  );

  if (paragraphRows.length > 0) {
    const { error: paragraphInsertError } = await serviceClient.from("paragraphs").insert(paragraphRows);

    if (paragraphInsertError) {
      throw paragraphInsertError;
    }
  }

  const { error: bookUpdateError } = await serviceClient
    .from("books")
    .update({
      title: payload.title || "Untitled book",
      author: payload.author || "Unknown author",
      language: payload.language || "unknown",
      description: payload.description || "",
      cover_url: coverStoragePath,
      import_status: "ready",
      import_error: null,
      rag_status: "processing",
      rag_error: null
    })
    .eq("id", bookId);

  if (bookUpdateError) {
    throw bookUpdateError;
  }
}

async function markBookFailed(bookId: string, error: unknown) {
  const serviceClient = getSupabaseServiceRoleClient();

  await serviceClient
    .from("books")
    .update({
      import_status: "failed",
      import_error: toShortErrorMessage(error),
      rag_status: "failed",
      rag_error: toShortErrorMessage(error)
    })
    .eq("id", bookId);
}

async function markBookRagFailed(bookId: string, error: unknown) {
  const serviceClient = getSupabaseServiceRoleClient();

  await serviceClient
    .from("books")
    .update({
      rag_status: "failed",
      rag_error: toShortErrorMessage(error)
    })
    .eq("id", bookId);
}

export async function processUploadedBookForUser(params: { bookId: string; userId: string }) {
  const { bookId, userId } = params;
  const book = await getOwnedBookForProcessing(bookId, userId);

  try {
    await markBookProcessing(bookId);
    const serviceClient = getSupabaseServiceRoleClient();
    await ensureBookFilesBucket(serviceClient);
    const { data: fileBlob, error: downloadError } = await serviceClient.storage
      .from(BOOK_FILES_BUCKET)
      .download(book.source_storage_path);

    if (downloadError) {
      throw downloadError;
    }

    const epubBuffer = Buffer.from(await fileBlob.arrayBuffer());
    const payload = parseEpubBuffer(epubBuffer);
    const coverStoragePath = await uploadCoverIfPresent(userId, bookId, payload.cover);

    await replaceBookContent(bookId, payload, coverStoragePath);

    let smartMarkStatus: "ready" | "failed" = "ready";

    try {
      await generateBookSmartMarksForUser({ bookId, userId });
    } catch {
      smartMarkStatus = "failed";
    }

    try {
      await generateBookChunksForUser({ bookId, userId });
      const embeddingResult = await generateBookEmbeddingsForUser({ bookId, userId });

      return {
        bookId,
        importStatus: "ready" as const,
        smartMarkStatus,
        ragStatus: embeddingResult.ragStatus
      };
    } catch (ragError) {
      await markBookRagFailed(bookId, ragError);

      return {
        bookId,
        importStatus: "ready" as const,
        smartMarkStatus,
        ragStatus: "failed" as const
      };
    }
  } catch (error) {
    await markBookFailed(bookId, error);
    throw error;
  }
}
