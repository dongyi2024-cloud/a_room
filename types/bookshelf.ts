import type { ReaderBookDetail, ReaderBookSummary } from "@/types/reader";

export type BookImportStatus = "processing" | "ready" | "failed";
export type BookRagStatus = "processing" | "ready" | "failed";

export type BookshelfItem = ReaderBookSummary & {
  bookshelfId: string;
  createdAt: string;
  importError: string | null;
  importStatus: BookImportStatus;
  ragError: string | null;
  ragStatus: BookRagStatus;
};

export type AccessibleReaderBook = ReaderBookDetail & {
  importStatus: BookImportStatus;
};
