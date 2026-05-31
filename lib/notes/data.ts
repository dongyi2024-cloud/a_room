import "server-only";

import { buildCommunityShareDraftContent, isCommunityShareSourceType } from "@/lib/notes/community-share";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { CommunityShareDraft } from "@/types/community-share";
import type { PersonalNote, PersonalNoteSourceType } from "@/types/personal-notes";
import type { Database, Json } from "@/types/supabase";

type PersonalNoteRow = Database["public"]["Tables"]["personal_notes"]["Row"];

export class PersonalNoteValidationError extends Error {}

export class PersonalNoteAccessError extends Error {}

export class PersonalNoteSchemaError extends Error {}

type CreatePersonalNoteInput = {
  userId: string;
  bookId: string;
  chapterId: string;
  paragraphId: string;
  sourceType: PersonalNoteSourceType;
  sourceText?: string | null;
  aiContent?: string | null;
  noteContent?: string | null;
  metadata?: Json;
};

type NoteContext = {
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterOrder: number;
  chapterTitle: string;
  paragraphId: string;
  paragraphOrder: number;
  paragraphExcerpt: string;
};

const VALID_SOURCE_TYPES = new Set<PersonalNoteSourceType>([
  "ai_answer",
  "smart_mark_explanation",
  "selected_text",
  "reflection",
  "dialogue_summary"
]);

function normalizeText(value: string | null | undefined, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function normalizeExcerpt(content: string, maxLength = 180) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function isObjectLike(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMetadata(value: Json | undefined): Json {
  if (!value || !isObjectLike(value)) {
    return {};
  }

  return value;
}

function isMissingPersonalNoteSchemaError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  return (
    message.includes("personal_notes") &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("Could not find the table"))
  );
}

export async function getOwnedNoteContext(input: {
  userId: string;
  bookId: string;
  chapterId: string;
  paragraphId: string;
}): Promise<NoteContext> {
  const supabase = getSupabaseServiceRoleClient();
  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, user_id, title")
    .eq("id", input.bookId)
    .maybeSingle();

  if (bookError) {
    throw bookError;
  }

  if (!book || book.user_id !== input.userId) {
    throw new PersonalNoteAccessError("无法为不属于你的书籍保存笔记。");
  }

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id, book_id, title, order_index")
    .eq("id", input.chapterId)
    .eq("book_id", input.bookId)
    .maybeSingle();

  if (chapterError) {
    throw chapterError;
  }

  if (!chapter) {
    throw new PersonalNoteValidationError("笔记章节上下文不存在。");
  }

  const { data: paragraph, error: paragraphError } = await supabase
    .from("paragraphs")
    .select("id, book_id, chapter_id, order_index, content")
    .eq("id", input.paragraphId)
    .eq("book_id", input.bookId)
    .eq("chapter_id", input.chapterId)
    .maybeSingle();

  if (paragraphError) {
    throw paragraphError;
  }

  if (!paragraph) {
    throw new PersonalNoteValidationError("笔记段落上下文不存在。");
  }

  return {
    bookId: book.id,
    bookTitle: book.title,
    chapterId: chapter.id,
    chapterOrder: chapter.order_index,
    chapterTitle: chapter.title || `第 ${chapter.order_index} 章`,
    paragraphId: paragraph.id,
    paragraphOrder: paragraph.order_index,
    paragraphExcerpt: normalizeExcerpt(paragraph.content)
  };
}

function toPersonalNote(row: PersonalNoteRow, context: NoteContext): PersonalNote {
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    bookTitle: context.bookTitle,
    chapterId: row.chapter_id,
    chapterOrder: context.chapterOrder,
    chapterTitle: context.chapterTitle,
    paragraphId: row.paragraph_id,
    paragraphOrder: context.paragraphOrder,
    paragraphExcerpt: row.paragraph_excerpt || context.paragraphExcerpt,
    sourceType: row.source_type,
    sourceText: row.source_text,
    aiContent: row.ai_content,
    noteContent: row.note_content,
    metadata: row.metadata,
    createdAt: row.created_at
  };
}

async function buildNoteContextMaps(rows: PersonalNoteRow[]) {
  const supabase = getSupabaseServiceRoleClient();
  const bookIds = [...new Set(rows.map((row) => row.book_id))];
  const chapterIds = [...new Set(rows.map((row) => row.chapter_id))];
  const paragraphIds = [...new Set(rows.map((row) => row.paragraph_id))];

  const [booksResult, chaptersResult, paragraphsResult] = await Promise.all([
    bookIds.length
      ? supabase.from("books").select("id, title").in("id", bookIds)
      : Promise.resolve({ data: [], error: null }),
    chapterIds.length
      ? supabase.from("chapters").select("id, title, order_index").in("id", chapterIds)
      : Promise.resolve({ data: [], error: null }),
    paragraphIds.length
      ? supabase.from("paragraphs").select("id, order_index, content").in("id", paragraphIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (booksResult.error) {
    throw booksResult.error;
  }

  if (chaptersResult.error) {
    throw chaptersResult.error;
  }

  if (paragraphsResult.error) {
    throw paragraphsResult.error;
  }

  return {
    books: new Map((booksResult.data ?? []).map((book) => [book.id, book.title])),
    chapters: new Map(
      (chaptersResult.data ?? []).map((chapter) => [
        chapter.id,
        {
          order: chapter.order_index,
          title: chapter.title || `第 ${chapter.order_index} 章`
        }
      ])
    ),
    paragraphs: new Map(
      (paragraphsResult.data ?? []).map((paragraph) => [
        paragraph.id,
        {
          order: paragraph.order_index,
          excerpt: normalizeExcerpt(paragraph.content)
        }
      ])
    )
  };
}

export function assertPersonalNoteSourceType(value: unknown): PersonalNoteSourceType {
  if (typeof value === "string" && VALID_SOURCE_TYPES.has(value as PersonalNoteSourceType)) {
    return value as PersonalNoteSourceType;
  }

  throw new PersonalNoteValidationError("笔记来源类型无效。");
}

export async function createPersonalNote(input: CreatePersonalNoteInput) {
  const sourceText = normalizeText(input.sourceText, 3000);
  const aiContent = normalizeText(input.aiContent, 5000);
  const noteContent = normalizeText(input.noteContent, 3000);

  if (!sourceText && !aiContent && !noteContent) {
    throw new PersonalNoteValidationError("没有可保存的笔记内容。");
  }

  const context = await getOwnedNoteContext(input);
  const supabase = getSupabaseServiceRoleClient();
  const insertPayload: Database["public"]["Tables"]["personal_notes"]["Insert"] = {
    user_id: input.userId,
    book_id: context.bookId,
    chapter_id: context.chapterId,
    paragraph_id: context.paragraphId,
    source_type: input.sourceType,
    source_text: sourceText,
    ai_content: aiContent,
    note_content: noteContent,
    paragraph_excerpt: context.paragraphExcerpt,
    metadata: normalizeMetadata(input.metadata)
  };
  const { data, error } = await supabase
    .from("personal_notes")
    .insert(insertPayload)
    .select(
      "id, user_id, book_id, chapter_id, paragraph_id, source_type, source_text, ai_content, note_content, paragraph_excerpt, metadata, created_at, updated_at"
    )
    .single();

  if (error) {
    if (isMissingPersonalNoteSchemaError(error)) {
      throw new PersonalNoteSchemaError("Personal note schema is not ready.");
    }

    throw error;
  }

  return toPersonalNote(data as PersonalNoteRow, context);
}

export async function listPersonalNotes(userId: string): Promise<PersonalNote[]> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("personal_notes")
    .select(
      "id, user_id, book_id, chapter_id, paragraph_id, source_type, source_text, ai_content, note_content, paragraph_excerpt, metadata, created_at, updated_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingPersonalNoteSchemaError(error)) {
      throw new PersonalNoteSchemaError("Personal note schema is not ready.");
    }

    throw error;
  }

  const rows = (data ?? []) as PersonalNoteRow[];

  if (rows.length === 0) {
    return [];
  }

  const maps = await buildNoteContextMaps(rows);

  return rows.map((row) => {
    const bookTitle = maps.books.get(row.book_id) ?? "原书已不可用";
    const chapter = maps.chapters.get(row.chapter_id) ?? {
      order: 0,
      title: "原章节已不可用"
    };
    const paragraph = maps.paragraphs.get(row.paragraph_id) ?? {
      order: 0,
      excerpt: row.paragraph_excerpt
    };

    return toPersonalNote(row, {
      bookId: row.book_id,
      bookTitle,
      chapterId: row.chapter_id,
      chapterOrder: chapter.order,
      chapterTitle: chapter.title,
      paragraphId: row.paragraph_id,
      paragraphOrder: paragraph.order,
      paragraphExcerpt: paragraph.excerpt
    });
  });
}

export async function getOwnedPersonalNote(input: { userId: string; noteId: string }): Promise<PersonalNote> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("personal_notes")
    .select(
      "id, user_id, book_id, chapter_id, paragraph_id, source_type, source_text, ai_content, note_content, paragraph_excerpt, metadata, created_at, updated_at"
    )
    .eq("id", input.noteId)
    .maybeSingle();

  if (error) {
    if (isMissingPersonalNoteSchemaError(error)) {
      throw new PersonalNoteSchemaError("Personal note schema is not ready.");
    }

    throw error;
  }

  if (!data || data.user_id !== input.userId) {
    throw new PersonalNoteAccessError("这条笔记暂时不可用，或不属于当前账号。");
  }

  const context = await getOwnedNoteContext({
    userId: input.userId,
    bookId: data.book_id,
    chapterId: data.chapter_id,
    paragraphId: data.paragraph_id
  });

  return toPersonalNote(data as PersonalNoteRow, context);
}

export async function buildCommunityShareDraft(input: {
  userId: string;
  noteId: string;
}): Promise<CommunityShareDraft> {
  const note = await getOwnedPersonalNote(input);

  if (!isCommunityShareSourceType(note.sourceType)) {
    throw new PersonalNoteValidationError("这类笔记暂时不能分享到社区。");
  }

  if (note.chapterOrder <= 0 || note.paragraphOrder <= 0) {
    throw new PersonalNoteValidationError("这条笔记缺少可分享的原文位置。");
  }

  const content = buildCommunityShareDraftContent(note);

  if (!content) {
    throw new PersonalNoteValidationError("这条笔记没有可分享的内容。");
  }

  return {
    noteId: note.id,
    content,
    context: {
      bookId: note.bookId,
      bookTitle: note.bookTitle,
      chapterId: note.chapterId,
      chapterOrder: note.chapterOrder,
      chapterTitle: note.chapterTitle,
      paragraphId: note.paragraphId,
      paragraphOrder: note.paragraphOrder,
      paragraphExcerpt: note.paragraphExcerpt
    }
  };
}
