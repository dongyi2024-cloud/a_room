import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  CreateFeedbackReportRequest,
  FeedbackReport,
  FeedbackReportStatus,
  FeedbackTargetType,
  FeedbackType
} from "@/types/feedback";
import type { Database, Json } from "@/types/supabase";

type FeedbackReportRow = Database["public"]["Tables"]["feedback_reports"]["Row"];

const FEEDBACK_TARGET_TYPES = new Set<FeedbackTargetType>([
  "ai_answer",
  "reflection_card",
  "user_content",
  "system_issue"
]);

const FEEDBACK_TYPES = new Set<FeedbackType>([
  "ai_answer_wrong",
  "citation_inaccurate",
  "inappropriate_content",
  "offensive_or_uncomfortable",
  "bug",
  "other"
]);

const REFLECTION_REPORT_REVIEW_THRESHOLD = 3;

export class FeedbackValidationError extends Error {}
export class FeedbackTargetNotFoundError extends Error {}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeMetadata(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Json;
}

function assertFeedbackTargetType(value: unknown): FeedbackTargetType {
  if (typeof value === "string" && FEEDBACK_TARGET_TYPES.has(value as FeedbackTargetType)) {
    return value as FeedbackTargetType;
  }

  throw new FeedbackValidationError("请选择有效的反馈对象。");
}

function assertFeedbackType(value: unknown): FeedbackType {
  if (typeof value === "string" && FEEDBACK_TYPES.has(value as FeedbackType)) {
    return value as FeedbackType;
  }

  throw new FeedbackValidationError("请选择有效的反馈类型。");
}

function toFeedbackReport(row: FeedbackReportRow): FeedbackReport {
  return {
    id: row.id,
    userId: row.user_id,
    targetType: row.target_type as FeedbackTargetType,
    targetId: row.target_id,
    feedbackType: row.feedback_type as FeedbackType,
    content: row.content,
    status: row.status as FeedbackReportStatus,
    metadata: row.metadata,
    createdAt: row.created_at
  };
}

async function verifyReflectionCardTarget(targetId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("reflection_cards")
    .select("id, moderation_status, report_count")
    .eq("id", targetId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new FeedbackTargetNotFoundError("这张社区感悟卡片不存在，暂时不能举报。");
  }

  return data;
}

async function refreshReflectionCardReportState(targetId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { count, error: countError } = await supabase
    .from("feedback_reports")
    .select("id", { count: "exact", head: true })
    .eq("target_type", "reflection_card")
    .eq("target_id", targetId);

  if (countError) {
    throw countError;
  }

  const reportCount = count ?? 0;
  const nextModerationStatus = reportCount >= REFLECTION_REPORT_REVIEW_THRESHOLD ? "pending_review" : "visible";
  const { error: updateError } = await supabase
    .from("reflection_cards")
    .update({
      report_count: reportCount,
      moderation_status: nextModerationStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", targetId)
    .neq("moderation_status", "hidden");

  if (updateError) {
    throw updateError;
  }
}

export async function createFeedbackReport(userId: string, input: CreateFeedbackReportRequest) {
  const targetType = assertFeedbackTargetType(input.targetType);
  const feedbackType = assertFeedbackType(input.feedbackType);
  const targetId = normalizeText(input.targetId, 120);
  const content = normalizeText(input.content, 1200);
  const metadata = normalizeMetadata(input.metadata);

  if (targetType === "reflection_card") {
    if (!targetId) {
      throw new FeedbackValidationError("缺少要举报的社区内容。");
    }

    await verifyReflectionCardTarget(targetId);
  }

  if (!content && feedbackType === "other") {
    throw new FeedbackValidationError("请补充一点说明，方便我们处理。");
  }

  const supabase = getSupabaseServiceRoleClient();
  const insertPayload: Database["public"]["Tables"]["feedback_reports"]["Insert"] = {
    user_id: userId,
    target_type: targetType,
    target_id: targetId || null,
    feedback_type: feedbackType,
    content: content || null,
    metadata
  };

  const { data, error } = await supabase
    .from("feedback_reports")
    .insert(insertPayload)
    .select("id, user_id, target_type, target_id, feedback_type, content, status, metadata, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  if (targetType === "reflection_card" && targetId) {
    await refreshReflectionCardReportState(targetId);
  }

  return toFeedbackReport(data as FeedbackReportRow);
}
