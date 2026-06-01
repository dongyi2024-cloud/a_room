export type BookChunk = {
  id: string;
  bookId: string;
  chapterId: string;
  chunkIndex: number;
  startParagraphId: string;
  endParagraphId: string;
  startParagraphOrder: number;
  endParagraphOrder: number;
  paragraphCount: number;
  content: string;
  embedding: number[] | null;
  embeddingModel: string | null;
  embeddingStatus: "pending" | "ready" | "failed";
  embeddingError: string | null;
};

export type RetrieveBookChunksRequest = {
  bookId: string;
  question: string;
  chapterId?: string | null;
  paragraphId?: string | null;
  topK?: number;
};

export type RetrievedBookChunk = {
  chunkId: string;
  bookId: string;
  chapterId: string;
  chapterTitle: string | null;
  startParagraphId: string;
  endParagraphId: string;
  startParagraphOrder: number;
  endParagraphOrder: number;
  content: string;
  similarity: number;
};

export type RetrieveBookChunksApiResponse =
  | {
      ok: true;
      bookId: string;
      topK: number;
      chunks: RetrievedBookChunk[];
    }
  | {
      error: string;
    };

export type RetrieveBookChunksResult = {
  bookId: string;
  topK: number;
  chunks: RetrievedBookChunk[];
};

export type GenerateBookChunksApiResponse =
  | {
      ok: true;
      bookId: string;
      chunkCount: number;
    }
  | {
      error: string;
    };

export type GenerateBookChunksResult = {
  bookId: string;
  chunkCount: number;
};

export type GenerateBookEmbeddingsApiResponse =
  | {
      ok: true;
      bookId: string;
      chunkCount: number;
      embeddedCount: number;
      skippedCount: number;
      failedCount: number;
      ragStatus: "pending" | "processing" | "ready" | "partial" | "failed";
    }
  | {
      error: string;
    };

export type GenerateBookEmbeddingsResult = {
  bookId: string;
  chunkCount: number;
  embeddedCount: number;
  skippedCount: number;
  failedCount: number;
  ragStatus: "pending" | "processing" | "ready" | "partial" | "failed";
};
