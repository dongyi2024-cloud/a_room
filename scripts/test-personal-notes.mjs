import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const schemaSource = read("supabase/schema.sql");
const typesSource = read("types/supabase.ts");
const noteTypesSource = read("types/personal-notes.ts");
const helperSource = read("lib/notes/data.ts");
const routeSource = read("app/api/notes/route.ts");
const readerSource = read("components/reader/reader-shell.tsx");
const reflectionSource = read("components/reflections/reflection-feed-panel.tsx");
const notesPageSource = read("app/settings/notes/page.tsx");
const bookshelfSource = read("components/bookshelf/bookshelf-shell.tsx");
const cssSource = read("app/globals.css");

assert.match(schemaSource, /create table if not exists public\.personal_notes/);
assert.match(schemaSource, /user_id uuid not null references auth\.users \(id\) on delete cascade/);
assert.match(schemaSource, /book_id uuid not null references public\.books \(id\) on delete cascade/);
assert.match(schemaSource, /chapter_id uuid not null references public\.chapters \(id\) on delete cascade/);
assert.match(schemaSource, /paragraph_id uuid not null references public\.paragraphs \(id\) on delete cascade/);
assert.match(schemaSource, /source_type text not null check \(source_type in \('ai_answer', 'smart_mark_explanation', 'selected_text', 'reflection', 'dialogue_summary'\)\)/);
assert.match(schemaSource, /idx_personal_notes_user_created/);
assert.match(schemaSource, /idx_personal_notes_context/);
assert.match(schemaSource, /alter table public\.personal_notes enable row level security/);
assert.match(schemaSource, /create policy "personal notes owner read"[\s\S]*?using \(auth\.uid\(\) = user_id\)/);
assert.match(schemaSource, /create policy "personal notes owner write"[\s\S]*?with check \(auth\.uid\(\) = user_id\)/);

assert.match(typesSource, /personal_notes:/);
assert.match(typesSource, /source_type: "ai_answer" \| "smart_mark_explanation" \| "selected_text" \| "reflection" \| "dialogue_summary"/);
assert.match(noteTypesSource, /"dialogue_summary"/);
assert.match(noteTypesSource, /bookTitle: string/);
assert.match(noteTypesSource, /paragraphOrder: number/);

assert.match(helperSource, /export class PersonalNoteValidationError/);
assert.match(helperSource, /export class PersonalNoteAccessError/);
assert.match(helperSource, /export class PersonalNoteSchemaError/);
assert.match(helperSource, /export async function createPersonalNote/);
assert.match(helperSource, /export async function listPersonalNotes/);
assert.match(helperSource, /\.from\("books"\)[\s\S]*?\.eq\("id", input\.bookId\)/);
assert.match(helperSource, /book\.user_id !== input\.userId/);
assert.match(helperSource, /\.from\("chapters"\)[\s\S]*?\.eq\("id", input\.chapterId\)[\s\S]*?\.eq\("book_id", input\.bookId\)/);
assert.match(helperSource, /\.from\("paragraphs"\)[\s\S]*?\.eq\("id", input\.paragraphId\)[\s\S]*?\.eq\("book_id", input\.bookId\)[\s\S]*?\.eq\("chapter_id", input\.chapterId\)/);
assert.match(helperSource, /\.from\("personal_notes"\)[\s\S]*?\.insert\(insertPayload\)/);
assert.match(helperSource, /\.from\("personal_notes"\)[\s\S]*?\.eq\("user_id", userId\)/);

assert.match(routeSource, /export async function GET/);
assert.match(routeSource, /export async function POST/);
assert.match(routeSource, /getCurrentUser/);
assert.match(routeSource, /请先登录再加入笔记/);
assert.match(routeSource, /createPersonalNote/);
assert.match(routeSource, /listPersonalNotes/);
assert.match(routeSource, /PersonalNoteAccessError/);
assert.match(routeSource, /PersonalNoteValidationError/);

assert.match(readerSource, /import \{ SaveNoteButton \}/);
assert.match(readerSource, /sourceType: "selected_text"/);
assert.match(readerSource, /sourceType: "ai_answer"/);
assert.match(readerSource, /sourceType: "smart_mark_explanation"/);
assert.match(readerSource, /data-paragraph-id=\{paragraph\.id\}/);
assert.match(readerSource, /initialParagraphId/);

assert.match(reflectionSource, /import \{ SaveNoteButton \}/);
assert.match(reflectionSource, /sourceType: "reflection"/);
assert.match(reflectionSource, /draftOnly: true/);
assert.match(reflectionSource, /reflectionCardId: card\.id/);

assert.match(notesPageSource, /export default async function PersonalNotesPage/);
assert.match(notesPageSource, /listPersonalNotes\(user\.id\)/);
assert.match(notesPageSource, /groupNotesByBook/);
assert.match(notesPageSource, /searchParams\?:/);
assert.match(notesPageSource, /note-book-grid/);
assert.match(notesPageSource, /note-book-card/);
assert.match(notesPageSource, /\/settings\/notes\?book=\$\{encodeURIComponent\(group\.bookId\)\}/);
assert.match(notesPageSource, /selectedBook\.notes\.map/);
assert.match(notesPageSource, /paragraphId=\$\{encodeURIComponent\(note\.paragraphId\)\}/);
assert.match(notesPageSource, /note\.sourceType === "selected_text"/);
assert.match(notesPageSource, /primaryContent \? <p className="note-card-content">/);
assert.match(notesPageSource, /个人笔记/);
assert.match(notesPageSource, /回到原文/);
assert.match(notesPageSource, /原文位置暂不可用/);
assert.match(notesPageSource, /还没有保存笔记/);
assert.match(bookshelfSource, /href="\/settings\/notes"/);

assert.match(cssSource, /\.note-save-inline/);
assert.match(cssSource, /\.note-save-row/);
assert.match(cssSource, /\.notes-list/);
assert.match(cssSource, /\.note-book-grid/);
assert.match(cssSource, /\.note-book-card/);
assert.match(cssSource, /\.note-book-selected/);
assert.match(cssSource, /\.note-card/);

console.log("Personal notes source checks passed.");
