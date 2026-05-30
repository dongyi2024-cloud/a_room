import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const schemaSource = read("supabase/schema.sql");
const aiTypesSource = read("types/ai.ts");
const noteTypesSource = read("types/personal-notes.ts");
const workflowSource = read("lib/ai/dialogue-summary-workflow.ts");
const routeSource = read("app/api/ai/dialogue-summary/route.ts");
const notesRouteSource = read("app/api/notes/route.ts");
const notesDataSource = read("lib/notes/data.ts");
const readerSource = read("components/reader/reader-shell.tsx");
const notesPageSource = read("app/settings/notes/page.tsx");
const cssSource = read("app/globals.css");
const tasksSource = read("openspec/changes/add-dialogue-summary-notes/tasks.md");

assert.match(schemaSource, /'dialogue_summary'/);
assert.match(noteTypesSource, /"dialogue_summary"/);
assert.match(notesDataSource, /"dialogue_summary"/);
assert.match(notesDataSource, /export async function getOwnedNoteContext/);
assert.match(notesRouteSource, /createPersonalNote/);

assert.match(aiTypesSource, /export type DialogueSummaryTurn/);
assert.match(aiTypesSource, /export type DialogueSummaryDraft/);
assert.match(aiTypesSource, /export type DialogueSummaryRequest/);
assert.match(aiTypesSource, /export type DialogueSummaryApiResponse/);

assert.match(workflowSource, /StateGraph\(DialogueSummaryState\)/);
assert.match(workflowSource, /Only use the supplied reading context and dialogue turns/);
assert.match(workflowSource, /coreQuestions/);
assert.match(workflowSource, /answerPoints/);
assert.match(workflowSource, /relatedSourceText/);
assert.match(workflowSource, /followUpQuestions/);
assert.match(workflowSource, /editableSummary/);
assert.match(workflowSource, /export async function runDialogueSummaryWorkflow/);
assert.match(workflowSource, /turns: completedTurns/);
assert.match(workflowSource, /buildFallbackDraft/);
assert.match(workflowSource, /Unable to parse dialogue summary JSON; using fallback draft/);

assert.match(routeSource, /export async function POST/);
assert.match(routeSource, /getCurrentUser/);
assert.match(routeSource, /请先登录再生成对话摘要/);
assert.match(routeSource, /getOwnedNoteContext/);
assert.match(routeSource, /runDialogueSummaryWorkflow/);
assert.match(routeSource, /turns\.length === 0/);

assert.match(readerSource, /DialogueSummaryReviewState/);
assert.match(readerSource, /\/api\/ai\/dialogue-summary/);
assert.match(readerSource, /sourceType: "dialogue_summary"/);
assert.match(readerSource, /conversationReference: getSelectionThreadKey\(selectionContext\)/);
assert.match(readerSource, /conversationTurns: completedTurns\.slice\(-8\)/);
assert.match(readerSource, /生成摘要/);
assert.match(readerSource, /保存为笔记/);
assert.match(readerSource, /onClick=\{resetDialogueSummary\}/);
assert.match(readerSource, /status: "saved"/);
assert.match(readerSource, /disabled=\{dialogueSummary\.status === "saving"/);

assert.match(notesPageSource, /dialogue_summary: "对话摘要"/);
assert.match(notesPageSource, /getDialogueTurns/);
assert.match(notesPageSource, /原始对话/);
assert.match(notesPageSource, /回到对话位置/);
assert.match(notesPageSource, /原始对话暂不可恢复/);
assert.match(notesPageSource, /groupNotesByBook/);

assert.match(cssSource, /\.dialogue-summary-panel/);
assert.match(cssSource, /\.dialogue-summary-editor/);
assert.match(cssSource, /\.note-dialogue-source/);

assert.match(tasksSource, /- \[x\] 6\.1/);
assert.match(tasksSource, /- \[x\] 6\.5/);

console.log("Dialogue summary notes source checks passed.");
