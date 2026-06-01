import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { SelectionAiCitation } from "@/types/ai";
import type { RetrievedBookChunk } from "@/types/rag";

const MAX_CITATION_QUOTE_CHARS = 280;

type ParagraphRow = {
  id: string;
  chapter_id: string;
  order_index: number;
};

function normalizeQuote(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= MAX_CITATION_QUOTE_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_CITATION_QUOTE_CHARS).trimEnd()}...`;
}

function groupParagraphsByChapter(rows: ParagraphRow[]) {
  return rows.reduce<Map<string, ParagraphRow[]>>((grouped, row) => {
    const existing = grouped.get(row.chapter_id);

    if (existing) {
      existing.push(row);
    } else {
      grouped.set(row.chapter_id, [row]);
    }

    return grouped;
  }, new Map<string, ParagraphRow[]>());
}

export async function buildSelectionAiCitations(params: {
  bookId: string;
  bookTitle: string;
  retrievedChunks: RetrievedBookChunk[];
  citedChunkIds: string[];
}): Promise<SelectionAiCitation[]> {
  const { bookId, bookTitle, retrievedChunks, citedChunkIds } = params;
  const uniqueChunkIds = Array.from(new Set(citedChunkIds));

  if (uniqueChunkIds.length === 0 || retrievedChunks.length === 0) {
    return [];
  }

  const chunkById = new Map(retrievedChunks.map((chunk) => [chunk.chunkId, chunk]));
  const validChunks = uniqueChunkIds
    .map((chunkId) => chunkById.get(chunkId) ?? null)
    .filter((chunk): chunk is RetrievedBookChunk => chunk !== null);

  if (validChunks.length === 0) {
    return [];
  }

  const serviceClient = getSupabaseServiceRoleClient();
  const chapterIds = Array.from(new Set(validChunks.map((chunk) => chunk.chapterId)));
  const { data, error } = await serviceClient
    .from("paragraphs")
    .select("id, chapter_id, order_index")
    .eq("book_id", bookId)
    .in("chapter_id", chapterIds)
    .order("chapter_id")
    .order("order_index");

  if (error) {
    throw error;
  }

  const paragraphsByChapter = groupParagraphsByChapter((data ?? []) as ParagraphRow[]);

  return validChunks.map((chunk) => {
    const chapterParagraphs = paragraphsByChapter.get(chunk.chapterId) ?? [];
    const paragraphIds = chapterParagraphs
      .filter(
        (paragraph) =>
          paragraph.order_index >= chunk.startParagraphOrder && paragraph.order_index <= chunk.endParagraphOrder
      )
      .map((paragraph) => paragraph.id);

    return {
      type: "book_chunk",
      bookTitle,
      chapterId: chunk.chapterId,
      chapterTitle: chunk.chapterTitle,
      paragraphIds,
      quote: normalizeQuote(chunk.content),
      chunkId: chunk.chunkId,
      startParagraphId: chunk.startParagraphId,
      endParagraphId: chunk.endParagraphId,
      startParagraphOrder: chunk.startParagraphOrder,
      endParagraphOrder: chunk.endParagraphOrder
    };
  });
}
