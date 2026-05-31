import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const shareTypesSource = read("types/community-share.ts");
const draftSource = read("lib/notes/community-share.ts");
const notesDataSource = read("lib/notes/data.ts");
const shareRouteSource = read("app/api/notes/share/route.ts");
const notesPageSource = read("app/settings/notes/page.tsx");
const shareComponentSource = read("components/notes/community-share-note-action.tsx");
const reflectionsSource = read("lib/reflections/data.ts");
const communityPageSource = read("app/community/page.tsx");
const reflectionPanelSource = read("components/reflections/reflection-feed-panel.tsx");
const cssSource = read("app/globals.css");
const tasksSource = read("openspec/changes/add-community-share-from-notes/tasks.md");

assert.match(shareTypesSource, /export type CommunityShareDraft/);
assert.match(shareTypesSource, /noteId: string/);
assert.match(shareTypesSource, /context: ReflectionFeedContext/);
assert.match(shareTypesSource, /export type CommunitySharePublishRequest/);
assert.match(shareTypesSource, /noteId\?: string/);
assert.match(shareTypesSource, /content\?: string/);

assert.match(draftSource, /export function buildCommunityShareDraftContent/);
assert.match(draftSource, /case "dialogue_summary":[\s\S]*?firstPresent\(note\.noteContent, note\.aiContent\)/);
assert.match(draftSource, /case "selected_text":[\s\S]*?firstPresent\(note\.noteContent, note\.sourceText\)/);
assert.match(draftSource, /case "ai_answer":[\s\S]*?case "smart_mark_explanation":[\s\S]*?firstPresent\(note\.noteContent, note\.aiContent\)/);
assert.match(draftSource, /case "reflection":[\s\S]*?firstPresent\(note\.noteContent\)/);
assert.doesNotMatch(draftSource, /conversationTurns/);
assert.match(draftSource, /MAX_SHARE_DRAFT_LENGTH = 600/);

assert.match(notesDataSource, /export async function getOwnedPersonalNote/);
assert.match(notesDataSource, /\.eq\("id", input\.noteId\)/);
assert.match(notesDataSource, /data\.user_id !== input\.userId/);
assert.match(notesDataSource, /getOwnedNoteContext/);
assert.match(notesDataSource, /export async function buildCommunityShareDraft/);
assert.match(notesDataSource, /buildCommunityShareDraftContent\(note\)/);
assert.match(notesDataSource, /isCommunityShareSourceType\(note\.sourceType\)/);

assert.match(shareRouteSource, /export async function GET/);
assert.match(shareRouteSource, /export async function POST/);
assert.match(shareRouteSource, /getCurrentUser/);
assert.match(shareRouteSource, /请先登录再分享到社区/);
assert.match(shareRouteSource, /buildCommunityShareDraft/);
assert.match(shareRouteSource, /createReflectionCard/);
assert.match(shareRouteSource, /const noteId = normalizeId\(payload\.noteId\)/);
assert.match(shareRouteSource, /noteId\s*\n\s*\}\);/);
assert.match(shareRouteSource, /bookId: draft\.context\.bookId/);
assert.match(shareRouteSource, /chapterOrder: draft\.context\.chapterOrder/);
assert.match(shareRouteSource, /paragraphOrder: draft\.context\.paragraphOrder/);
assert.doesNotMatch(shareRouteSource, /chapterId: payload/);
assert.doesNotMatch(shareRouteSource, /paragraphId: payload/);
assert.doesNotMatch(shareRouteSource, /metadata/);
assert.doesNotMatch(shareRouteSource, /conversationTurns/);

assert.match(notesPageSource, /CommunityShareNoteAction/);
assert.match(notesPageSource, /sourceType: note\.sourceType/);
assert.match(notesPageSource, /noteContent: note\.noteContent/);
assert.doesNotMatch(notesPageSource, /metadata: note\.metadata/);

assert.match(shareComponentSource, /分享到社区/);
assert.match(shareComponentSource, /\/api\/notes\/share\?noteId=/);
assert.match(shareComponentSource, /method: "POST"/);
assert.match(shareComponentSource, /body: JSON\.stringify\(\{[\s\S]*?noteId: note\.id,[\s\S]*?content/);
assert.match(shareComponentSource, /默认只发布下方确认内容，不公开完整原始 AI 对话/);
assert.match(shareComponentSource, /确认发布/);
assert.match(shareComponentSource, /取消/);
assert.match(shareComponentSource, /href="\/community"/);
assert.doesNotMatch(shareComponentSource, /conversationTurns/);
assert.doesNotMatch(shareComponentSource, /metadata/);

assert.match(reflectionsSource, /export async function createReflectionCard/);
assert.match(reflectionsSource, /\.from\("reflection_cards"\)[\s\S]*?\.insert\(insertPayload\)/);
assert.match(communityPageSource, /listAllReflectionCards/);
assert.match(reflectionPanelSource, /listReflectionCardsForParagraph|\/api\/reflections/);

assert.match(cssSource, /\.note-community-share/);
assert.match(cssSource, /\.note-share-editor/);
assert.match(cssSource, /\.note-share-textarea/);
assert.match(cssSource, /\.note-share-success/);

assert.match(tasksSource, /- \[x\] 1\.1/);
assert.match(tasksSource, /- \[x\] 4\.3/);

console.log("Community share from notes source checks passed.");
