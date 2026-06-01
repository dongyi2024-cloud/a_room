import "server-only";

import { cache } from "react";
import { getReaderSmartMarkMapFromRows } from "@/lib/reader/smart-mark-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AccessibleReaderBook, BookshelfItem } from "@/types/bookshelf";
import type { ReaderChapter, ReaderParagraph } from "@/types/reader";
import type { Database } from "@/types/supabase";

type BookRow = Database["public"]["Tables"]["books"]["Row"];
type BookshelfRow = Database["public"]["Tables"]["user_bookshelves"]["Row"];
type ChapterRow = Database["public"]["Tables"]["chapters"]["Row"];
type ParagraphRow = Database["public"]["Tables"]["paragraphs"]["Row"];
type SmartMarkRow = Database["public"]["Tables"]["smart_marks"]["Row"];

function paragraphCountForBook(bookId: string, paragraphs: ParagraphRow[]) {
  return paragraphs.reduce((count, paragraph) => (paragraph.book_id === bookId ? count + 1 : count), 0);
}

function chapterMap(chapters: ChapterRow[], paragraphs: ParagraphRow[]) {
  const paragraphByChapter = new Map<string, ReaderParagraph[]>();

  paragraphs.forEach((paragraph) => {
    const group = paragraphByChapter.get(paragraph.chapter_id) ?? [];

    group.push({
      id: paragraph.id,
      orderIndex: paragraph.order_index,
      content: paragraph.content,
      smartMarks: []
    });
    paragraphByChapter.set(paragraph.chapter_id, group);
  });

  const map = new Map<string, ReaderChapter>();

  chapters.forEach((chapter) => {
    map.set(chapter.id, {
      id: chapter.id,
      orderIndex: chapter.order_index,
      title: chapter.title || "",
      paragraphs:
        paragraphByChapter
          .get(chapter.id)
          ?.sort((left, right) => left.orderIndex - right.orderIndex) ?? []
    });
  });

  return map;
}

export const getUserBookshelfItems = cache(async (userId: string): Promise<BookshelfItem[]> => {
  const supabase = getSupabaseServerClient();
  const { data: shelfRows, error: shelfError } = await supabase
    .from("user_bookshelves")
    .select("id, user_id, book_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (shelfError) {
    throw shelfError;
  }

  if (!shelfRows || shelfRows.length === 0) {
    return [];
  }

  const bookIds = shelfRows.map((row) => row.book_id);
  const [{ data: books, error: booksError }, { data: chapters, error: chaptersError }, { data: paragraphs, error: paragraphsError }] =
    await Promise.all([
      supabase
        .from("books")
        .select(
          "id, user_id, title, author, language, description, cover_url, source_file_name, import_status, import_error, rag_status, rag_error, created_at, updated_at"
        )
        .in("id", bookIds),
      supabase.from("chapters").select("id, book_id, order_index").in("book_id", bookIds),
      supabase.from("paragraphs").select("book_id").in("book_id", bookIds)
    ]);

  if (booksError) {
    throw booksError;
  }

  if (chaptersError) {
    throw chaptersError;
  }

  if (paragraphsError) {
    throw paragraphsError;
  }

  const bookMap = new Map((books ?? []).map((book) => [book.id, book]));
  const chaptersByBook = new Map<string, number>();

  (chapters ?? []).forEach((chapter) => {
    chaptersByBook.set(chapter.book_id, (chaptersByBook.get(chapter.book_id) ?? 0) + 1);
  });

  return (shelfRows as BookshelfRow[])
    .map((shelfRow) => {
      const book = bookMap.get(shelfRow.book_id);

      if (!book) {
        return null;
      }

      const pipelineStatus =
        book.import_status === "failed"
          ? "failed"
          : book.import_status === "processing"
            ? "processing"
            : book.rag_status === "ready"
              ? "ready"
              : book.rag_status === "failed" || book.rag_status === "partial"
                ? "failed"
                : "processing";

      return {
        id: book.id,
        bookshelfId: shelfRow.id,
        title: book.title,
        author: book.author || "Unknown author",
        language: book.language || "unknown",
        description: book.description || "",
        coverPath: book.cover_url,
        chapterCount: chaptersByBook.get(book.id) ?? 0,
        paragraphCount: paragraphCountForBook(book.id, (paragraphs ?? []) as ParagraphRow[]),
        importStatus: book.import_status,
        importError: book.import_error,
        ragStatus: pipelineStatus,
        ragError: book.rag_error,
        createdAt: shelfRow.created_at
      } satisfies BookshelfItem;
    })
    .filter((item): item is BookshelfItem => item !== null);
});

export const getAccessibleReaderBook = cache(async (
  userId: string,
  bookId: string
): Promise<AccessibleReaderBook | null> => {
  const supabase = getSupabaseServerClient();
  const { data: shelfRecord, error: shelfError } = await supabase
    .from("user_bookshelves")
    .select("id, book_id")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();

  if (shelfError) {
    throw shelfError;
  }

  if (!shelfRecord) {
    return null;
  }

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select(
      "id, title, author, language, description, cover_url, import_status, import_error, source_file_name, created_at, updated_at"
    )
    .eq("id", bookId)
    .eq("import_status", "ready")
    .maybeSingle();

  if (bookError) {
    throw bookError;
  }

  if (!book) {
    return null;
  }

  const { data: chapters, error: chaptersError } = await supabase
    .from("chapters")
    .select("id, book_id, title, order_index, created_at, updated_at")
    .eq("book_id", bookId)
    .order("order_index", { ascending: true });

  if (chaptersError) {
    throw chaptersError;
  }

  const { data: paragraphs, error: paragraphsError } = await supabase
    .from("paragraphs")
    .select("id, book_id, chapter_id, order_index, content, created_at, updated_at")
    .eq("book_id", bookId)
    .order("order_index", { ascending: true });

  if (paragraphsError) {
    throw paragraphsError;
  }

  const { data: smartMarks, error: smartMarksError } = await supabase
    .from("smart_marks")
    .select(
      "id, book_id, chapter_id, paragraph_id, target_text, mark_type, explanation, start_offset, end_offset, confidence, source, created_at, updated_at"
    )
    .eq("book_id", bookId)
    .order("paragraph_id", { ascending: true })
    .order("start_offset", { ascending: true });

  if (smartMarksError) {
    throw smartMarksError;
  }

  const chaptersWithParagraphs = chapterMap((chapters ?? []) as ChapterRow[], (paragraphs ?? []) as ParagraphRow[]);
  const chapterList = ((chapters ?? []) as ChapterRow[]).map((chapter) => chaptersWithParagraphs.get(chapter.id)!);
  const smartMarkMap = getReaderSmartMarkMapFromRows(chapterList, (smartMarks ?? []) as SmartMarkRow[]);

  return {
    id: book.id,
    title: book.title,
    author: book.author || "Unknown author",
    language: book.language || "unknown",
    description: book.description || "",
    coverPath: book.cover_url,
    chapterCount: (chapters ?? []).length,
    paragraphCount: (paragraphs ?? []).length,
    importStatus: book.import_status,
    chapters: chapterList.map((chapter) => ({
      ...chapter,
      paragraphs: chapter.paragraphs.map((paragraph) => ({
        ...paragraph,
        smartMarks: smartMarkMap.get(`${chapter.orderIndex}:${paragraph.orderIndex}`) ?? []
      }))
    }))
  };
});
