import type {
  ReadingBehaviorEvent,
  ReadingSlumpChapterStats,
  ReadingSlumpEvaluationInput,
  ReadingSlumpEvaluationResult,
  ReadingSlumpRuleConfig,
  ReadingSlumpSignal,
  ReadingSlumpThresholds
} from "@/types/reading-slump";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_READING_SLUMP_THRESHOLDS: ReadingSlumpThresholds = {
  inactivityDays: 4,
  chapterStagnationDays: 3,
  repeatedOpenCount: 3,
  repeatedOpenWindowDays: 2,
  comprehensionQuestionCount: 3,
  comprehensionQuestionWindowDays: 2,
  lowCompletionRatio: 0.35,
  lowCompletionWindowDays: 2,
  reminderCooldownDays: 5
};

export const DEFAULT_READING_SLUMP_CONFIG: ReadingSlumpRuleConfig = {
  version: 1,
  enabledRules: {
    inactivity: true,
    chapter_stagnation: true,
    repeated_open_without_progress: true,
    frequent_comprehension_questions: true,
    low_chapter_completion: true
  },
  thresholds: DEFAULT_READING_SLUMP_THRESHOLDS
};

function parseTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function daysBefore(now: Date, days: number) {
  return now.getTime() - Math.max(days, 0) * MS_PER_DAY;
}

function happenedAfter(event: ReadingBehaviorEvent, cutoff: number) {
  const timestamp = parseTime(event.occurredAt);
  return timestamp !== null && timestamp >= cutoff;
}

function sortEvents(events: ReadingBehaviorEvent[]) {
  return [...events].sort((left, right) => {
    const leftTime = parseTime(left.occurredAt) ?? 0;
    const rightTime = parseTime(right.occurredAt) ?? 0;
    return leftTime - rightTime;
  });
}

function latestEvent(events: ReadingBehaviorEvent[], predicate: (event: ReadingBehaviorEvent) => boolean) {
  return sortEvents(events).filter(predicate).at(-1) ?? null;
}

function earliestEvent(events: ReadingBehaviorEvent[], predicate: (event: ReadingBehaviorEvent) => boolean) {
  return sortEvents(events).find(predicate) ?? null;
}

function getChapterParagraphCount(chapterStats: ReadingSlumpChapterStats[], chapterOrder: number | null) {
  if (chapterOrder === null) {
    return 0;
  }

  return chapterStats.find((chapter) => chapter.chapterOrder === chapterOrder)?.paragraphCount ?? 0;
}

function isComprehensionQuestion(event: ReadingBehaviorEvent) {
  if (event.eventType !== "selection_ai_question") {
    return false;
  }

  return event.metadata?.questionIntent === "comprehension";
}

function hasRule(config: ReadingSlumpRuleConfig, signal: ReadingSlumpSignal) {
  return config.enabledRules[signal] !== false;
}

function detectInactivity(input: ReadingSlumpEvaluationInput) {
  const latestProgress = latestEvent(input.events, (event) => event.eventType === "progress_saved");

  if (!latestProgress) {
    return false;
  }

  const latestProgressAt = parseTime(latestProgress.occurredAt);

  if (latestProgressAt === null) {
    return false;
  }

  return latestProgressAt < daysBefore(input.now ?? new Date(), input.config.thresholds.inactivityDays);
}

function detectChapterStagnation(input: ReadingSlumpEvaluationInput) {
  const latestProgress = latestEvent(input.events, (event) => event.eventType === "progress_saved");

  if (!latestProgress || latestProgress.chapterOrder === null) {
    return false;
  }

  const chapterOrder = latestProgress.chapterOrder;
  const chapterEntry = earliestEvent(
    input.events,
    (event) =>
      (event.eventType === "progress_saved" || event.eventType === "chapter_viewed") &&
      event.chapterOrder === chapterOrder
  );
  const chapterEntryAt = chapterEntry ? parseTime(chapterEntry.occurredAt) : null;

  if (chapterEntryAt === null || chapterEntryAt >= daysBefore(input.now ?? new Date(), input.config.thresholds.chapterStagnationDays)) {
    return false;
  }

  const chapterProgressEvents = input.events.filter(
    (event) => event.eventType === "progress_saved" && event.chapterOrder === chapterOrder
  );
  const paragraphOrders = chapterProgressEvents
    .map((event) => event.paragraphOrder)
    .filter((paragraphOrder): paragraphOrder is number => typeof paragraphOrder === "number");

  if (paragraphOrders.length === 0) {
    return true;
  }

  return Math.max(...paragraphOrders) - Math.min(...paragraphOrders) <= 1;
}

function detectRepeatedOpenWithoutProgress(input: ReadingSlumpEvaluationInput) {
  const cutoff = daysBefore(input.now ?? new Date(), input.config.thresholds.repeatedOpenWindowDays);
  const count = input.events.filter(
    (event) => event.eventType === "page_reopened_without_progress" && happenedAfter(event, cutoff)
  ).length;

  return count >= input.config.thresholds.repeatedOpenCount;
}

function detectFrequentComprehensionQuestions(input: ReadingSlumpEvaluationInput) {
  const cutoff = daysBefore(input.now ?? new Date(), input.config.thresholds.comprehensionQuestionWindowDays);
  const count = input.events.filter((event) => isComprehensionQuestion(event) && happenedAfter(event, cutoff)).length;

  return count >= input.config.thresholds.comprehensionQuestionCount;
}

function detectLowChapterCompletion(input: ReadingSlumpEvaluationInput) {
  const latestProgress = latestEvent(input.events, (event) => event.eventType === "progress_saved");

  if (!latestProgress || latestProgress.chapterOrder === null || latestProgress.paragraphOrder === null) {
    return false;
  }

  const chapterEntry = earliestEvent(
    input.events,
    (event) =>
      (event.eventType === "progress_saved" || event.eventType === "chapter_viewed") &&
      event.chapterOrder === latestProgress.chapterOrder
  );
  const chapterEntryAt = chapterEntry ? parseTime(chapterEntry.occurredAt) : null;

  if (chapterEntryAt === null || chapterEntryAt >= daysBefore(input.now ?? new Date(), input.config.thresholds.lowCompletionWindowDays)) {
    return false;
  }

  const paragraphCount = getChapterParagraphCount(input.chapterStats, latestProgress.chapterOrder);

  if (paragraphCount <= 0) {
    return false;
  }

  return latestProgress.paragraphOrder / paragraphCount < input.config.thresholds.lowCompletionRatio;
}

function getReminderEligibility(input: ReadingSlumpEvaluationInput, evaluatedAt: Date) {
  const suppressedUntil = input.previousState?.reminderSuppressedUntil ?? null;

  if (!suppressedUntil) {
    return true;
  }

  const suppressedUntilTime = parseTime(suppressedUntil);
  return suppressedUntilTime === null || suppressedUntilTime <= evaluatedAt.getTime();
}

export function evaluateReadingSlump(input: ReadingSlumpEvaluationInput): ReadingSlumpEvaluationResult {
  const evaluatedAt = input.now ?? new Date();
  const signals: ReadingSlumpSignal[] = [];

  if (hasRule(input.config, "inactivity") && detectInactivity(input)) {
    signals.push("inactivity");
  }

  if (hasRule(input.config, "chapter_stagnation") && detectChapterStagnation(input)) {
    signals.push("chapter_stagnation");
  }

  if (hasRule(input.config, "repeated_open_without_progress") && detectRepeatedOpenWithoutProgress(input)) {
    signals.push("repeated_open_without_progress");
  }

  if (hasRule(input.config, "frequent_comprehension_questions") && detectFrequentComprehensionQuestions(input)) {
    signals.push("frequent_comprehension_questions");
  }

  if (hasRule(input.config, "low_chapter_completion") && detectLowChapterCompletion(input)) {
    signals.push("low_chapter_completion");
  }

  return {
    status: signals.length >= 2 ? "slump" : signals.length === 1 ? "at_risk" : "steady",
    triggeredSignals: signals,
    signalCount: signals.length,
    ruleVersion: input.config.version,
    evaluatedAt: evaluatedAt.toISOString(),
    reminderSuppressedUntil: input.previousState?.reminderSuppressedUntil ?? null,
    lastDismissedAt: input.previousState?.lastDismissedAt ?? null,
    isReminderEligible: getReminderEligibility(input, evaluatedAt)
  };
}

export function getSuppressionUntil(now: Date, config: ReadingSlumpRuleConfig) {
  return new Date(now.getTime() + Math.max(0, config.thresholds.reminderCooldownDays) * MS_PER_DAY).toISOString();
}
