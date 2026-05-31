import type { Json } from "@/types/supabase";

export type FeedbackTargetType = "ai_answer" | "reflection_card" | "user_content" | "system_issue";

export type FeedbackType =
  | "ai_answer_wrong"
  | "citation_inaccurate"
  | "inappropriate_content"
  | "offensive_or_uncomfortable"
  | "bug"
  | "other";

export type FeedbackReportStatus = "open" | "in_review" | "resolved" | "dismissed";

export type CreateFeedbackReportRequest = {
  targetType: FeedbackTargetType;
  targetId?: string;
  feedbackType: FeedbackType;
  content?: string;
  metadata?: Json;
};

export type FeedbackReport = {
  id: string;
  userId: string;
  targetType: FeedbackTargetType;
  targetId: string | null;
  feedbackType: FeedbackType;
  content: string | null;
  status: FeedbackReportStatus;
  metadata: Json;
  createdAt: string;
};

export type FeedbackReportApiResponse =
  | {
      report: FeedbackReport;
    }
  | {
      error: string;
    };

export const FEEDBACK_TYPE_OPTIONS: Array<{ value: FeedbackType; label: string }> = [
  { value: "ai_answer_wrong", label: "AI 回答错误" },
  { value: "citation_inaccurate", label: "引用来源不准确" },
  { value: "inappropriate_content", label: "内容不适" },
  { value: "offensive_or_uncomfortable", label: "冒犯 / 不舒服" },
  { value: "bug", label: "功能故障" },
  { value: "other", label: "其他建议" }
];
