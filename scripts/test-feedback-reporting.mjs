import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const schemaSource = read("supabase/schema.sql");
const supabaseTypesSource = read("types/supabase.ts");
const feedbackTypesSource = read("types/feedback.ts");
const feedbackDataSource = read("lib/feedback/data.ts");
const feedbackRouteSource = read("app/api/feedback/route.ts");
const feedbackComponentSource = read("components/feedback/feedback-report-action.tsx");
const readerShellSource = read("components/reader/reader-shell.tsx");
const reflectionPanelSource = read("components/reflections/reflection-feed-panel.tsx");
const reflectionTypesSource = read("types/reflections.ts");
const reflectionDataSource = read("lib/reflections/data.ts");
const cssSource = read("app/globals.css");
const tasksSource = read("openspec/changes/add-feedback-and-reporting/tasks.md");

assert.match(schemaSource, /create table if not exists public\.feedback_reports/);
assert.match(schemaSource, /target_type text not null check \(target_type in \('ai_answer', 'reflection_card', 'user_content', 'system_issue'\)\)/);
assert.match(schemaSource, /feedback_type text not null check \(/);
assert.match(schemaSource, /'ai_answer_wrong'/);
assert.match(schemaSource, /'citation_inaccurate'/);
assert.match(schemaSource, /status text not null default 'open'/);
assert.match(schemaSource, /metadata jsonb not null default '\{\}'::jsonb/);
assert.match(schemaSource, /alter table public\.feedback_reports enable row level security/);
assert.match(schemaSource, /create policy "feedback reports owner read"/);
assert.match(schemaSource, /create policy "feedback reports owner insert"/);
assert.match(schemaSource, /idx_feedback_reports_target/);
assert.match(schemaSource, /moderation_status text not null default 'visible'/);
assert.match(schemaSource, /report_count integer not null default 0/);
assert.match(schemaSource, /idx_reflection_cards_moderation/);

assert.match(supabaseTypesSource, /feedback_reports: \{/);
assert.match(supabaseTypesSource, /moderation_status: string/);
assert.match(supabaseTypesSource, /report_count: number/);
assert.match(feedbackTypesSource, /export type FeedbackTargetType/);
assert.match(feedbackTypesSource, /export type FeedbackType/);
assert.match(feedbackTypesSource, /CreateFeedbackReportRequest/);
assert.match(feedbackTypesSource, /FEEDBACK_TYPE_OPTIONS/);

assert.match(feedbackDataSource, /export async function createFeedbackReport/);
assert.match(feedbackDataSource, /assertFeedbackTargetType/);
assert.match(feedbackDataSource, /assertFeedbackType/);
assert.match(feedbackDataSource, /verifyReflectionCardTarget/);
assert.match(feedbackDataSource, /REFLECTION_REPORT_REVIEW_THRESHOLD = 3/);
assert.match(feedbackDataSource, /\.from\("feedback_reports"\)[\s\S]*?\.insert\(insertPayload\)/);
assert.match(feedbackDataSource, /\.from\("reflection_cards"\)[\s\S]*?moderation_status: nextModerationStatus/);
assert.match(feedbackDataSource, /pending_review/);

assert.match(feedbackRouteSource, /export async function POST/);
assert.match(feedbackRouteSource, /getCurrentUser/);
assert.match(feedbackRouteSource, /createFeedbackReport/);
assert.match(feedbackRouteSource, /FeedbackValidationError/);
assert.match(feedbackRouteSource, /FeedbackTargetNotFoundError/);

assert.match(feedbackComponentSource, /export function FeedbackReportAction/);
assert.match(feedbackComponentSource, /\/api\/feedback/);
assert.match(feedbackComponentSource, /feedbackType/);
assert.match(feedbackComponentSource, /补充说明/);
assert.match(feedbackComponentSource, /提交中/);

assert.match(readerShellSource, /FeedbackReportAction/);
assert.match(readerShellSource, /targetType="ai_answer"/);
assert.match(readerShellSource, /surface: "selection_ai_panel"/);
assert.match(readerShellSource, /answerExcerpt: turn\.answer\.slice\(0, 800\)/);
assert.match(readerShellSource, /selectedTextExcerpt: selectionContext\.selectedText\.slice\(0, 500\)/);
const aiFeedbackSnippet = readerShellSource.slice(
  readerShellSource.indexOf('targetType="ai_answer"'),
  readerShellSource.indexOf("turn.insufficientEvidence")
);
assert.doesNotMatch(aiFeedbackSnippet, /conversationTurns/);

assert.match(reflectionPanelSource, /FeedbackReportAction/);
assert.match(reflectionPanelSource, /targetType="reflection_card"/);
assert.match(reflectionPanelSource, /targetId=\{card\.id\}/);
assert.match(reflectionPanelSource, /cardContentExcerpt: card\.content\.slice\(0, 500\)/);
assert.match(reflectionPanelSource, /reflection-card-review-state/);
assert.match(reflectionTypesSource, /moderationStatus/);
assert.match(reflectionTypesSource, /reportCount/);
assert.match(reflectionDataSource, /\.neq\("moderation_status", "hidden"\)/);

assert.match(cssSource, /\.feedback-report-action/);
assert.match(cssSource, /\.feedback-report-panel/);
assert.match(cssSource, /\.feedback-report-success/);
assert.match(cssSource, /\.reflection-card-review-state/);

assert.match(tasksSource, /- \[x\] 1\.1/);
assert.match(tasksSource, /- \[x\] 6\.7/);
assert.match(tasksSource, /- \[ \] 6\.8/);

console.log("Feedback reporting source checks passed.");
