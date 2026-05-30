import type { Json } from "@/types/supabase";

export type PersonalNoteSourceType =
  | "ai_answer"
  | "smart_mark_explanation"
  | "selected_text"
  | "reflection"
  | "dialogue_summary";

export type PersonalNote = {
  id: string;
  userId: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterOrder: number;
  chapterTitle: string;
  paragraphId: string;
  paragraphOrder: number;
  paragraphExcerpt: string;
  sourceType: PersonalNoteSourceType;
  sourceText: string | null;
  aiContent: string | null;
  noteContent: string | null;
  metadata: Json;
  createdAt: string;
};

export type CreatePersonalNoteRequest = {
  bookId?: string;
  chapterId?: string;
  paragraphId?: string;
  sourceType?: PersonalNoteSourceType;
  sourceText?: string | null;
  aiContent?: string | null;
  noteContent?: string | null;
  metadata?: Json;
};

export type PersonalNoteCreateResponse = {
  note: PersonalNote;
};

export type PersonalNoteListResponse = {
  notes: PersonalNote[];
};

export type PersonalNoteErrorResponse = {
  error: string;
};

export type PersonalNoteApiResponse =
  | PersonalNoteCreateResponse
  | PersonalNoteListResponse
  | PersonalNoteErrorResponse;
