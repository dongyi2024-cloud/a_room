import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BOOK_FILES_BUCKET } from "@/lib/bookshelf/constants";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { Database } from "@/types/supabase";

type BookDeletionClient = SupabaseClient<Database>;
type BookDeletionBookRow = Pick<
  Database["public"]["Tables"]["books"]["Row"],
  "id" | "user_id" | "source_storage_path" | "cover_url"
>;

export class BookDeletionNotFoundError extends Error {
  constructor(message = "Book was not found.") {
    super(message);
    this.name = "BookDeletionNotFoundError";
  }
}

export class BookDeletionAccessError extends Error {
  constructor(message = "This book does not belong to the current user's private bookshelf.") {
    super(message);
    this.name = "BookDeletionAccessError";
  }
}

export class BookDeletionStorageError extends Error {
  constructor(message = "Unable to delete this book's stored files.") {
    super(message);
    this.name = "BookDeletionStorageError";
  }
}

export class BookDeletionDatabaseError extends Error {
  constructor(message = "Unable to delete this book record.") {
    super(message);
    this.name = "BookDeletionDatabaseError";
  }
}

function normalizeStoragePath(value: string | null | undefined) {
  return typeof value === "string" ? value.replace(/^\/+/, "").trim() : "";
}

function isSafeBookStoragePath(path: string, userId: string, bookId: string) {
  return path.startsWith(`${userId}/${bookId}/`) && !path.includes("..");
}

function isMissingStorageObjectError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error ? String((error as { message?: unknown }).message) : "";
  return /not found|no such object|does not exist|not_exist/i.test(message);
}

export function getKnownBookStoragePaths(book: BookDeletionBookRow) {
  const paths = new Set<string>();

  for (const candidate of [book.source_storage_path, book.cover_url]) {
    const path = normalizeStoragePath(candidate);

    if (path && isSafeBookStoragePath(path, book.user_id, book.id)) {
      paths.add(path);
    }
  }

  return Array.from(paths);
}

async function listBookDirectoryStoragePaths(client: BookDeletionClient, book: BookDeletionBookRow) {
  const directory = `${book.user_id}/${book.id}`;
  const { data, error } = await client.storage.from(BOOK_FILES_BUCKET).list(directory, {
    limit: 100,
    sortBy: { column: "name", order: "asc" }
  });

  if (error) {
    if (isMissingStorageObjectError(error)) {
      return [];
    }

    throw new BookDeletionStorageError("Unable to inspect this book's stored files.");
  }

  return (data ?? [])
    .filter((item) => item.name && item.name !== ".emptyFolderPlaceholder")
    .map((item) => `${directory}/${item.name}`)
    .filter((path) => isSafeBookStoragePath(path, book.user_id, book.id));
}

async function removeStoragePaths(client: BookDeletionClient, paths: string[]) {
  const uniquePaths = Array.from(new Set(paths));

  if (uniquePaths.length === 0) {
    return;
  }

  const { error } = await client.storage.from(BOOK_FILES_BUCKET).remove(uniquePaths);

  if (error && !isMissingStorageObjectError(error)) {
    throw new BookDeletionStorageError("Unable to delete this book's stored files.");
  }
}

async function getOwnedBookForDeletion(client: BookDeletionClient, bookId: string, userId: string) {
  const { data: book, error } = await client
    .from("books")
    .select("id, user_id, source_storage_path, cover_url")
    .eq("id", bookId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!book) {
    throw new BookDeletionNotFoundError("Book was not found.");
  }

  if (book.user_id !== userId) {
    throw new BookDeletionAccessError("This book does not belong to the current user's private bookshelf.");
  }

  return book as BookDeletionBookRow;
}

async function deleteBookRow(client: BookDeletionClient, bookId: string, userId: string) {
  const { error, count } = await client.from("books").delete({ count: "exact" }).eq("id", bookId).eq("user_id", userId);

  if (error) {
    throw new BookDeletionDatabaseError("Unable to delete this book record.");
  }

  if (count === 0) {
    throw new BookDeletionNotFoundError("Book was not found.");
  }
}

export async function deleteBookForUser(params: {
  bookId: string;
  userId: string;
  client?: BookDeletionClient;
}) {
  const client = params.client ?? getSupabaseServiceRoleClient();
  const book = await getOwnedBookForDeletion(client, params.bookId, params.userId);
  const knownPaths = getKnownBookStoragePaths(book);
  const directoryPaths = await listBookDirectoryStoragePaths(client, book);
  const storagePaths = Array.from(new Set([...knownPaths, ...directoryPaths]));

  await removeStoragePaths(client, storagePaths);
  await deleteBookRow(client, params.bookId, params.userId);

  return {
    bookId: params.bookId,
    deletedStoragePaths: storagePaths
  };
}
