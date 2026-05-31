import "server-only";

import { DEFAULT_READING_SLUMP_CONFIG, evaluateReadingSlump, getSuppressionUntil } from "@/lib/reading-slump/detection";
import { getDisabledReadingSlumpState, getUserReadingPreferences } from "@/lib/settings/reading-preferences";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  ReadingBehaviorEvent,
  ReadingBehaviorEventType,
  ReadingSlumpChapterStats,
  ReadingSlumpEvaluationResult,
  ReadingSlumpRuleConfig,
  ReadingSlumpSignal,
  ReadingSlumpThresholds
} from "@/types/reading-slump";
import type { Database, Json } from "@/types/supabase";

type BehaviorEventRow = Database["public"]["Tables"]["reading_behavior_events"]["Row"];
type SlumpStateRow = Database["public"]["Tables"]["reading_slump_states"]["Row"];
type RuleConfigRow = Database["public"]["Tables"]["reading_slump_rule_configs"]["Row"];

type RecordReadingBehaviorEventInput = {
  userId: string;
  bookId: string;
  eventType: ReadingBehaviorEventType;
  chapterOrder: number | null;
  paragraphOrder: number | null;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeEnabledRules(value: Json): ReadingSlumpRuleConfig["enabledRules"] {
  const raw = isRecord(value) ? value : {};

  return {
    inactivity: raw.inactivity !== false,
    chapter_stagnation: raw.chapter_stagnation !== false,
    repeated_open_without_progress: raw.repeated_open_without_progress !== false,
    frequent_comprehension_questions: raw.frequent_comprehension_questions !== false,
    low_chapter_completion: raw.low_chapter_completion !== false
  };
}

function normalizeThresholds(value: Json): ReadingSlumpThresholds {
  const raw = isRecord(value) ? value : {};

  return {
    inactivityDays: normalizeNumber(raw.inactivityDays, DEFAULT_READING_SLUMP_CONFIG.thresholds.inactivityDays),
    chapterStagnationDays: normalizeNumber(
      raw.chapterStagnationDays,
      DEFAULT_READING_SLUMP_CONFIG.thresholds.chapterStagnationDays
    ),
    repeatedOpenCount: normalizeNumber(raw.repeatedOpenCount, DEFAULT_READING_SLUMP_CONFIG.thresholds.repeatedOpenCount),
    repeatedOpenWindowDays: normalizeNumber(
      raw.repeatedOpenWindowDays,
      DEFAULT_READING_SLUMP_CONFIG.thresholds.repeatedOpenWindowDays
    ),
    comprehensionQuestionCount: normalizeNumber(
      raw.comprehensionQuestionCount,
      DEFAULT_READING_SLUMP_CONFIG.thresholds.comprehensionQuestionCount
    ),
    comprehensionQuestionWindowDays: normalizeNumber(
      raw.comprehensionQuestionWindowDays,
      DEFAULT_READING_SLUMP_CONFIG.thresholds.comprehensionQuestionWindowDays
    ),
    lowCompletionRatio: normalizeNumber(raw.lowCompletionRatio, DEFAULT_READING_SLUMP_CONFIG.thresholds.lowCompletionRatio),
    lowCompletionWindowDays: normalizeNumber(
      raw.lowCompletionWindowDays,
      DEFAULT_READING_SLUMP_CONFIG.thresholds.lowCompletionWindowDays
    ),
    reminderCooldownDays: normalizeNumber(raw.reminderCooldownDays, DEFAULT_READING_SLUMP_CONFIG.thresholds.reminderCooldownDays)
  };
}

function toRuleConfig(row: RuleConfigRow | null): ReadingSlumpRuleConfig {
  if (!row) {
    return DEFAULT_READING_SLUMP_CONFIG;
  }

  return {
    version: row.version,
    enabledRules: normalizeEnabledRules(row.enabled_rules),
    thresholds: normalizeThresholds(row.thresholds)
  };
}

function toBehaviorEvent(row: BehaviorEventRow): ReadingBehaviorEvent {
  return {
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    chapterOrder: row.chapter_order,
    paragraphOrder: row.paragraph_order,
    metadata: isRecord(row.event_metadata) ? row.event_metadata : {}
  };
}

function toEvaluationResult(row: SlumpStateRow): ReadingSlumpEvaluationResult {
  return {
    status: row.status,
    triggeredSignals: row.triggered_signals.filter((signal): signal is ReadingSlumpSignal =>
      [
        "inactivity",
        "chapter_stagnation",
        "repeated_open_without_progress",
        "frequent_comprehension_questions",
        "low_chapter_completion"
      ].includes(signal)
    ),
    signalCount: row.signal_count,
    ruleVersion: row.rule_version,
    evaluatedAt: row.evaluated_at,
    reminderSuppressedUntil: row.reminder_suppressed_until,
    lastDismissedAt: row.last_dismissed_at,
    isReminderEligible:
      !row.reminder_suppressed_until || Date.parse(row.reminder_suppressed_until) <= Date.now()
  };
}

function toJsonRecord(value: Record<string, unknown> | undefined): Json {
  return JSON.parse(JSON.stringify(value ?? {})) as Json;
}

async function assertUserOwnsBook(userId: string, bookId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("books")
    .select("id")
    .eq("id", bookId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function resolvePositionIds(bookId: string, chapterOrder: number | null, paragraphOrder: number | null) {
  if (chapterOrder === null) {
    return { chapterId: null, paragraphId: null };
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id")
    .eq("book_id", bookId)
    .eq("order_index", chapterOrder)
    .maybeSingle();

  if (chapterError) {
    throw chapterError;
  }

  if (!chapter || paragraphOrder === null) {
    return { chapterId: chapter?.id ?? null, paragraphId: null };
  }

  const { data: paragraph, error: paragraphError } = await supabase
    .from("paragraphs")
    .select("id")
    .eq("book_id", bookId)
    .eq("chapter_id", chapter.id)
    .eq("order_index", paragraphOrder)
    .maybeSingle();

  if (paragraphError) {
    throw paragraphError;
  }

  return { chapterId: chapter.id, paragraphId: paragraph?.id ?? null };
}

async function getActiveRuleConfig() {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("reading_slump_rule_configs")
    .select("id, version, is_active, enabled_rules, thresholds, created_at, updated_at")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return toRuleConfig(data as RuleConfigRow | null);
}

async function getRecentEvents(userId: string, bookId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("reading_behavior_events")
    .select("id, user_id, book_id, chapter_id, paragraph_id, event_type, chapter_order, paragraph_order, event_metadata, occurred_at, created_at")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .order("occurred_at", { ascending: true })
    .limit(300);

  if (error) {
    throw error;
  }

  return ((data ?? []) as BehaviorEventRow[]).map(toBehaviorEvent);
}

async function getChapterStats(bookId: string): Promise<ReadingSlumpChapterStats[]> {
  const supabase = getSupabaseServiceRoleClient();
  const [{ data: chapters, error: chaptersError }, { data: paragraphs, error: paragraphsError }] = await Promise.all([
    supabase.from("chapters").select("id, order_index").eq("book_id", bookId),
    supabase.from("paragraphs").select("chapter_id").eq("book_id", bookId)
  ]);

  if (chaptersError) {
    throw chaptersError;
  }

  if (paragraphsError) {
    throw paragraphsError;
  }

  const countByChapter = new Map<string, number>();

  (paragraphs ?? []).forEach((paragraph) => {
    countByChapter.set(paragraph.chapter_id, (countByChapter.get(paragraph.chapter_id) ?? 0) + 1);
  });

  return (chapters ?? []).map((chapter) => ({
    chapterOrder: chapter.order_index,
    paragraphCount: countByChapter.get(chapter.id) ?? 0
  }));
}

async function getStoredState(userId: string, bookId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("reading_slump_states")
    .select(
      "id, user_id, book_id, status, triggered_signals, signal_count, rule_version, evaluated_at, reminder_suppressed_until, last_dismissed_at, created_at, updated_at"
    )
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as SlumpStateRow | null;
}

async function upsertState(userId: string, bookId: string, result: ReadingSlumpEvaluationResult) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.from("reading_slump_states").upsert(
    {
      user_id: userId,
      book_id: bookId,
      status: result.status,
      triggered_signals: result.triggeredSignals,
      signal_count: result.signalCount,
      rule_version: result.ruleVersion,
      evaluated_at: result.evaluatedAt,
      reminder_suppressed_until: result.reminderSuppressedUntil,
      last_dismissed_at: result.lastDismissedAt,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,book_id" }
  );

  if (error) {
    throw error;
  }
}

export function inferQuestionIntent(question: string) {
  const normalized = question.toLowerCase();
  const comprehensionPatterns = [
    "什么意思",
    "意思",
    "解释",
    "看不懂",
    "不明白",
    "不理解",
    "what does",
    "what mean",
    "explain",
    "i don't understand",
    "dont understand",
    "confused"
  ];

  return comprehensionPatterns.some((pattern) => normalized.includes(pattern)) ? "comprehension" : "other";
}

export async function evaluateAndPersistReadingSlump(userId: string, bookId: string) {
  const [config, events, chapterStats, previousState] = await Promise.all([
    getActiveRuleConfig(),
    getRecentEvents(userId, bookId),
    getChapterStats(bookId),
    getStoredState(userId, bookId)
  ]);
  const result = evaluateReadingSlump({
    config,
    events,
    chapterStats,
    previousState: previousState
      ? {
          reminderSuppressedUntil: previousState.reminder_suppressed_until,
          lastDismissedAt: previousState.last_dismissed_at
        }
      : null
  });

  await upsertState(userId, bookId, result);

  return result;
}

export async function getLatestReadingSlumpState(userId: string, bookId: string) {
  const ownsBook = await assertUserOwnsBook(userId, bookId);

  if (!ownsBook) {
    return null;
  }

  const preferences = await getUserReadingPreferences(userId);

  if (!preferences.readingSlumpDetectionEnabled) {
    return getDisabledReadingSlumpState();
  }

  const state = await getStoredState(userId, bookId);
  return state ? toEvaluationResult(state) : evaluateAndPersistReadingSlump(userId, bookId);
}

export async function recordReadingBehaviorEvent(input: RecordReadingBehaviorEventInput) {
  const ownsBook = await assertUserOwnsBook(input.userId, input.bookId);

  if (!ownsBook) {
    throw new Error("This book is not available in your bookshelf.");
  }

  const preferences = await getUserReadingPreferences(input.userId);

  if (!preferences.readingSlumpDetectionEnabled) {
    return getDisabledReadingSlumpState();
  }

  const { chapterId, paragraphId } = await resolvePositionIds(input.bookId, input.chapterOrder, input.paragraphOrder);
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.from("reading_behavior_events").insert({
    user_id: input.userId,
    book_id: input.bookId,
    chapter_id: chapterId,
    paragraph_id: paragraphId,
    event_type: input.eventType,
    chapter_order: input.chapterOrder,
    paragraph_order: input.paragraphOrder,
    occurred_at: input.occurredAt,
    event_metadata: toJsonRecord(input.metadata)
  });

  if (error) {
    throw error;
  }

  return evaluateAndPersistReadingSlump(input.userId, input.bookId);
}

export async function dismissReadingSlumpReminder(userId: string, bookId: string) {
  const ownsBook = await assertUserOwnsBook(userId, bookId);

  if (!ownsBook) {
    throw new Error("This book is not available in your bookshelf.");
  }

  const preferences = await getUserReadingPreferences(userId);

  if (!preferences.readingSlumpDetectionEnabled) {
    return getDisabledReadingSlumpState();
  }

  const config = await getActiveRuleConfig();
  const now = new Date();
  const previousState = await getStoredState(userId, bookId);
  const result = previousState
    ? toEvaluationResult(previousState)
    : await evaluateAndPersistReadingSlump(userId, bookId);
  const dismissedResult: ReadingSlumpEvaluationResult = {
    ...result,
    reminderSuppressedUntil: getSuppressionUntil(now, config),
    lastDismissedAt: now.toISOString(),
    isReminderEligible: false
  };

  await recordReadingBehaviorEvent({
    userId,
    bookId,
    eventType: "reminder_dismissed",
    chapterOrder: null,
    paragraphOrder: null,
    occurredAt: now.toISOString(),
    metadata: { suppressedUntil: dismissedResult.reminderSuppressedUntil }
  });
  await upsertState(userId, bookId, dismissedResult);

  return dismissedResult;
}
