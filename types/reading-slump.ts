export type ReadingBehaviorEventType =
  | "reader_opened"
  | "chapter_viewed"
  | "progress_saved"
  | "page_reopened_without_progress"
  | "selection_ai_question"
  | "reminder_dismissed";

export type ReadingSlumpSignal =
  | "inactivity"
  | "chapter_stagnation"
  | "repeated_open_without_progress"
  | "frequent_comprehension_questions"
  | "low_chapter_completion";

export type ReadingSlumpStatus = "steady" | "at_risk" | "slump";

export type ReadingSlumpRuleEnabledMap = Record<ReadingSlumpSignal, boolean>;

export type ReadingSlumpThresholds = {
  inactivityDays: number;
  chapterStagnationDays: number;
  repeatedOpenCount: number;
  repeatedOpenWindowDays: number;
  comprehensionQuestionCount: number;
  comprehensionQuestionWindowDays: number;
  lowCompletionRatio: number;
  lowCompletionWindowDays: number;
  reminderCooldownDays: number;
};

export type ReadingSlumpRuleConfig = {
  version: number;
  enabledRules: ReadingSlumpRuleEnabledMap;
  thresholds: ReadingSlumpThresholds;
};

export type ReadingBehaviorEvent = {
  eventType: ReadingBehaviorEventType;
  occurredAt: string;
  chapterOrder: number | null;
  paragraphOrder: number | null;
  metadata?: Record<string, unknown>;
};

export type ReadingSlumpChapterStats = {
  chapterOrder: number;
  paragraphCount: number;
};

export type ReadingSlumpEvaluationInput = {
  config: ReadingSlumpRuleConfig;
  events: ReadingBehaviorEvent[];
  chapterStats: ReadingSlumpChapterStats[];
  previousState?: {
    reminderSuppressedUntil: string | null;
    lastDismissedAt: string | null;
  } | null;
  now?: Date;
};

export type ReadingSlumpEvaluationResult = {
  status: ReadingSlumpStatus;
  triggeredSignals: ReadingSlumpSignal[];
  signalCount: number;
  ruleVersion: number;
  evaluatedAt: string;
  reminderSuppressedUntil: string | null;
  lastDismissedAt: string | null;
  isReminderEligible: boolean;
};

export type ReadingEventApiPayload = {
  bookId?: string;
  eventType?: ReadingBehaviorEventType;
  chapterOrder?: number | null;
  paragraphOrder?: number | null;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

export type ReadingEventApiResponse =
  | {
      ok: true;
      state: ReadingSlumpEvaluationResult;
    }
  | {
      error: string;
    };

export type ReadingSlumpStateApiResponse =
  | {
      ok: true;
      state: ReadingSlumpEvaluationResult | null;
    }
  | {
      error: string;
    };
