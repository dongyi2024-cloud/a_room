import type { PersonalNote, PersonalNoteSourceType } from "@/types/personal-notes";

type NoteDraftFields = Pick<PersonalNote, "sourceType" | "sourceText" | "aiContent" | "noteContent">;

const MAX_SHARE_DRAFT_LENGTH = 600;

export function normalizeCommunityShareContent(value: string | null | undefined, maxLength = MAX_SHARE_DRAFT_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function firstPresent(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalizeCommunityShareContent(value);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export function buildCommunityShareDraftContent(note: NoteDraftFields) {
  switch (note.sourceType) {
    case "dialogue_summary":
      return firstPresent(note.noteContent, note.aiContent);
    case "selected_text":
      return firstPresent(note.noteContent, note.sourceText);
    case "ai_answer":
    case "smart_mark_explanation":
      return firstPresent(note.noteContent, note.aiContent);
    case "reflection":
      return firstPresent(note.noteContent);
    default:
      return "";
  }
}

export function isCommunityShareSourceType(sourceType: PersonalNoteSourceType) {
  return (
    sourceType === "dialogue_summary" ||
    sourceType === "selected_text" ||
    sourceType === "ai_answer" ||
    sourceType === "smart_mark_explanation" ||
    sourceType === "reflection"
  );
}
