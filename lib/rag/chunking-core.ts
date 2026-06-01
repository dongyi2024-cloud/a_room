export type ChunkSourceParagraph = {
  id: string;
  chapterId: string;
  chapterOrder: number;
  paragraphOrder: number;
  content: string;
};

export type BuiltChunk = {
  chapterId: string;
  chunkIndex: number;
  startParagraphId: string;
  endParagraphId: string;
  startParagraphOrder: number;
  endParagraphOrder: number;
  paragraphCount: number;
  content: string;
};

export const MAX_CHUNK_PARAGRAPHS = 4;
export const MAX_CHUNK_CHARS = 1800;

type ChunkAccumulator = {
  chapterId: string;
  chunkIndex: number;
  paragraphs: ChunkSourceParagraph[];
  charCount: number;
};

function normalizeParagraphContent(content: string) {
  return content.replace(/\s+/g, " ").trim();
}

function chunkContentLength(paragraphs: ChunkSourceParagraph[]) {
  return paragraphs.reduce((count, paragraph, index) => {
    const separatorLength = index === 0 ? 0 : 2;
    return count + separatorLength + normalizeParagraphContent(paragraph.content).length;
  }, 0);
}

function finalizeChunk(accumulator: ChunkAccumulator | null) {
  if (!accumulator || accumulator.paragraphs.length === 0) {
    return null;
  }

  const firstParagraph = accumulator.paragraphs[0];
  const lastParagraph = accumulator.paragraphs[accumulator.paragraphs.length - 1];
  const content = accumulator.paragraphs.map((paragraph) => normalizeParagraphContent(paragraph.content)).join("\n\n");

  return {
    chapterId: accumulator.chapterId,
    chunkIndex: accumulator.chunkIndex,
    startParagraphId: firstParagraph.id,
    endParagraphId: lastParagraph.id,
    startParagraphOrder: firstParagraph.paragraphOrder,
    endParagraphOrder: lastParagraph.paragraphOrder,
    paragraphCount: accumulator.paragraphs.length,
    content
  } satisfies BuiltChunk;
}

export function buildChunksFromParagraphs(paragraphs: ChunkSourceParagraph[]) {
  const orderedParagraphs = [...paragraphs]
    .map((paragraph) => ({
      ...paragraph,
      content: normalizeParagraphContent(paragraph.content)
    }))
    .filter((paragraph) => paragraph.content.length > 0)
    .sort((left, right) => {
      if (left.chapterOrder !== right.chapterOrder) {
        return left.chapterOrder - right.chapterOrder;
      }

      return left.paragraphOrder - right.paragraphOrder;
    });

  const chunks: BuiltChunk[] = [];
  let currentChunk: ChunkAccumulator | null = null;
  let nextChunkIndex = 1;

  for (const paragraph of orderedParagraphs) {
    if (!currentChunk || currentChunk.chapterId !== paragraph.chapterId) {
      const finalized = finalizeChunk(currentChunk);

      if (finalized) {
        chunks.push(finalized);
      }

      currentChunk = {
        chapterId: paragraph.chapterId,
        chunkIndex: nextChunkIndex,
        paragraphs: [paragraph],
        charCount: paragraph.content.length
      };
      nextChunkIndex += 1;
      continue;
    }

    const nextParagraphs: ChunkSourceParagraph[] = [...currentChunk.paragraphs, paragraph];
    const nextCharCount = chunkContentLength(nextParagraphs);
    const exceedsParagraphLimit = nextParagraphs.length > MAX_CHUNK_PARAGRAPHS;
    const exceedsCharLimit = nextCharCount > MAX_CHUNK_CHARS;

    if (exceedsParagraphLimit || exceedsCharLimit) {
      const finalized = finalizeChunk(currentChunk);

      if (finalized) {
        chunks.push(finalized);
      }

      currentChunk = {
        chapterId: paragraph.chapterId,
        chunkIndex: nextChunkIndex,
        paragraphs: [paragraph],
        charCount: paragraph.content.length
      };
      nextChunkIndex += 1;
      continue;
    }

    currentChunk = {
      ...currentChunk,
      paragraphs: nextParagraphs,
      charCount: nextCharCount
    };
  }

  const finalized = finalizeChunk(currentChunk);

  if (finalized) {
    chunks.push(finalized);
  }

  return chunks;
}
