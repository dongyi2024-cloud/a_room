"use client";

import { useMemo, useState } from "react";
import { FEEDBACK_TYPE_OPTIONS, type FeedbackReportApiResponse, type FeedbackTargetType, type FeedbackType } from "@/types/feedback";
import type { Json } from "@/types/supabase";

type FeedbackReportActionProps = {
  mode: "feedback" | "report";
  targetType: FeedbackTargetType;
  targetId?: string;
  targetLabel: string;
  metadata?: Json;
  buttonLabel?: string;
  className?: string;
};

const REPORT_TYPE_OPTIONS = FEEDBACK_TYPE_OPTIONS.filter((option) =>
  ["inappropriate_content", "offensive_or_uncomfortable", "other"].includes(option.value)
);

export function FeedbackReportAction({
  mode,
  targetType,
  targetId,
  targetLabel,
  metadata = {},
  buttonLabel,
  className = ""
}: FeedbackReportActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(
    mode === "report" ? "inappropriate_content" : "ai_answer_wrong"
  );
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const options = useMemo(() => (mode === "report" ? REPORT_TYPE_OPTIONS : FEEDBACK_TYPE_OPTIONS), [mode]);
  const resolvedButtonLabel = buttonLabel || (mode === "report" ? "举报" : "反馈");

  async function submitFeedback() {
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetType,
          targetId,
          feedbackType,
          content,
          metadata
        })
      });
      const payload = (await response.json()) as FeedbackReportApiResponse;

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "暂时无法提交反馈。");
      }

      setContent("");
      setSuccessMessage(mode === "report" ? "举报已提交，我们会尽快处理。" : "反馈已提交。");
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "暂时无法提交反馈。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={`feedback-report-action ${className}`.trim()}>
      <button
        className="button-reset secondary-link feedback-report-entry"
        disabled={isSubmitting}
        onClick={() => {
          setIsOpen((current) => !current);
          setErrorMessage("");
          setSuccessMessage("");
        }}
        type="button"
      >
        {resolvedButtonLabel}
      </button>
      {isOpen ? (
        <div className="feedback-report-panel">
          <p className="feedback-report-target">{targetLabel}</p>
          <label className="feedback-report-field">
            <span>类型</span>
            <select value={feedbackType} onChange={(event) => setFeedbackType(event.target.value as FeedbackType)}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="feedback-report-field">
            <span>补充说明</span>
            <textarea
              onChange={(event) => setContent(event.target.value)}
              placeholder={mode === "report" ? "哪里不适合公开展示？" : "哪里不准确或不好用？"}
              rows={3}
              value={content}
            />
          </label>
          {errorMessage ? <p className="feedback-report-error">{errorMessage}</p> : null}
          <div className="feedback-report-actions">
            <button
              className="button-reset secondary-link"
              disabled={isSubmitting}
              onClick={() => setIsOpen(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="button-reset primary-link"
              disabled={isSubmitting}
              onClick={submitFeedback}
              type="button"
            >
              {isSubmitting ? "提交中..." : "提交"}
            </button>
          </div>
        </div>
      ) : null}
      {successMessage ? <p className="feedback-report-success">{successMessage}</p> : null}
      {!isOpen && errorMessage ? <p className="feedback-report-error">{errorMessage}</p> : null}
    </div>
  );
}
