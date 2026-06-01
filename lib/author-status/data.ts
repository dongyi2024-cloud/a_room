import "server-only";

import { generateDeepSeekChatCompletion } from "@/lib/ai/deepseek";
import {
  getFallbackAuthorStatusCard,
  getTimeMood,
  getTimeMoodForDate,
  parseAuthorStatusCardJson,
  validateAuthorStatusCardText
} from "@/lib/author-status/time-mood";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  AuthorStatusApiResponse,
  AuthorStatusCardText,
  AuthorStatusReadingContext,
  TimeMood,
  TimeMoodPeriod
} from "@/types/author-status";
import type { Database } from "@/types/supabase";

type AuthorStatusCardRow = Database["public"]["Tables"]["author_status_cards"]["Row"];
type BookRow = Pick<Database["public"]["Tables"]["books"]["Row"], "id" | "title" | "author" | "import_status">;
type ChapterRow = Pick<Database["public"]["Tables"]["chapters"]["Row"], "id" | "title" | "order_index">;
type ReadingEventRow = Pick<
  Database["public"]["Tables"]["reading_behavior_events"]["Row"],
  "book_id" | "chapter_id" | "chapter_order" | "paragraph_order" | "event_type" | "occurred_at"
>;

type EffectiveTimeInput = {
  now?: Date;
  hour?: number | null;
  timezone?: string | null;
};

type CacheLookupInput = {
  userId: string;
  cardDate: string;
  period: TimeMoodPeriod;
};

type GenerateInput = {
  userId: string;
  timeMood: TimeMood;
  context: AuthorStatusReadingContext;
};

export type AuthorStatusResult = AuthorStatusApiResponse & {
  source_summary: string | null;
};

const EVENT_PRIORITY = ["progress_saved", "chapter_viewed", "reader_opened"] as const;

const AUTHOR_STATUS_SYSTEM_PROMPT = `你是 Woolf Room 应用中的「伍尔夫作者状态卡片生成器」。

你的任务是根据后端提供的时间段气质和用户阅读记录，生成首页作者状态卡片文案。

时间段已经由系统判断完成。你不能自行更改时间段，也不能推断其他时间。

作者状态卡片由两个不同视角组成：

1. woolf_status 是客观描述。
   它必须使用第三人称，以「她」作为主语，像镜头观察到 Woolf 当前的状态。
   它不能使用第一人称，不能直接对用户说话，不能提出建议。

2. thought_body 是 Woolf 的主观思绪。
   它必须使用第一人称，以 Woolf 本人的口吻表达。
   它可以使用「我」，可以提出问题，可以轻微引导用户思考。
   它不能像 AI 助手，不能像老师讲课，也不能变成第三人称评价。

写作风格：

* 温和、敏锐、克制。
* 有文学气质，但语言必须清晰。
* 像一张放在书页旁边的纸条，而不是客服欢迎语。
* 可以有轻微的 Woolf 气质，但不要模仿具体作品原文。
* 不要鸡汤，不要夸张，不要营销化。
* 不要编造用户没有提供的阅读内容。

输出格式：
只输出 JSON，不要输出解释文字。`;

function normalizeHour(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const hour = Math.floor(value);
  return hour >= 0 && hour <= 23 ? hour : null;
}

export function getEffectiveAuthorStatusTime({ now = new Date(), hour, timezone }: EffectiveTimeInput = {}) {
  const normalizedHour = normalizeHour(hour);
  const timed = getTimeMoodForDate(now, timezone);

  if (normalizedHour === null) {
    return timed;
  }

  return {
    ...timed,
    hour: normalizedHour,
    timeMood: getTimeMood(normalizedHour)
  };
}

export function isAuthorStatusSchemaMissingError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";

  return code === "42P01" || code === "PGRST205" || /author_status_cards|relation .* does not exist/i.test(message);
}

function toApiResponse(params: {
  period: TimeMoodPeriod;
  bookId: string | null;
  chapterId: string | null;
  content: AuthorStatusCardText;
  fromCache: boolean;
  sourceSummary?: string | null;
}): AuthorStatusResult {
  return {
    period: params.period,
    book_id: params.bookId,
    chapter_id: params.chapterId,
    woolf_status: params.content.woolf_status,
    thought_title: params.content.thought_title,
    thought_body: params.content.thought_body,
    cta_hint: params.content.cta_hint,
    from_cache: params.fromCache,
    source_summary: params.sourceSummary ?? null
  };
}

function rowToApi(row: AuthorStatusCardRow): AuthorStatusResult {
  return toApiResponse({
    period: row.time_period,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    content: {
      woolf_status: row.woolf_status,
      thought_title: row.thought_title,
      thought_body: row.thought_body,
      cta_hint: row.cta_hint
    },
    fromCache: true,
    sourceSummary: row.source_summary
  });
}

async function getCachedCard(input: CacheLookupInput) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("author_status_cards")
    .select("id, user_id, book_id, chapter_id, card_date, time_period, woolf_status, thought_title, thought_body, cta_hint, source_summary, generated_at")
    .eq("user_id", input.userId)
    .eq("card_date", input.cardDate)
    .eq("time_period", input.period)
    .maybeSingle();

  if (error) {
    if (isAuthorStatusSchemaMissingError(error)) {
      return null;
    }

    throw error;
  }

  return data ? rowToApi(data as AuthorStatusCardRow) : null;
}

async function saveCard(params: {
  userId: string;
  cardDate: string;
  period: TimeMoodPeriod;
  bookId: string | null;
  chapterId: string | null;
  content: AuthorStatusCardText;
  sourceSummary: string;
}) {
  const supabase = getSupabaseServiceRoleClient();
  const { error } = await supabase.from("author_status_cards").insert({
    user_id: params.userId,
    book_id: params.bookId,
    chapter_id: params.chapterId,
    card_date: params.cardDate,
    time_period: params.period,
    woolf_status: params.content.woolf_status,
    thought_title: params.content.thought_title,
    thought_body: params.content.thought_body,
    cta_hint: params.content.cta_hint,
    source_summary: params.sourceSummary
  });

  if (error && !isAuthorStatusSchemaMissingError(error)) {
    throw error;
  }
}

async function getLatestReadingEvent(userId: string) {
  const supabase = getSupabaseServiceRoleClient();

  for (const eventType of EVENT_PRIORITY) {
    const { data, error } = await supabase
      .from("reading_behavior_events")
      .select("book_id, chapter_id, chapter_order, paragraph_order, event_type, occurred_at")
      .eq("user_id", userId)
      .eq("event_type", eventType)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data as ReadingEventRow;
    }
  }

  return null;
}

async function getReadyBook(userId: string, bookId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("books")
    .select("id, title, author, import_status")
    .eq("id", bookId)
    .eq("user_id", userId)
    .eq("import_status", "ready")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as BookRow | null) ?? null;
}

async function getNewestReadyBook(userId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: shelfRows, error: shelfError } = await supabase
    .from("user_bookshelves")
    .select("book_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (shelfError) {
    throw shelfError;
  }

  const bookIds = (shelfRows ?? []).map((row) => row.book_id);

  if (bookIds.length === 0) {
    return null;
  }

  const { data: books, error: booksError } = await supabase
    .from("books")
    .select("id, title, author, import_status")
    .in("id", bookIds)
    .eq("user_id", userId)
    .eq("import_status", "ready");

  if (booksError) {
    throw booksError;
  }

  const byId = new Map(((books ?? []) as BookRow[]).map((book) => [book.id, book]));
  const firstReady = bookIds.map((id) => byId.get(id)).find((book): book is BookRow => Boolean(book));

  return firstReady ?? null;
}

async function getChapters(bookId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("chapters")
    .select("id, title, order_index")
    .eq("book_id", bookId)
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ChapterRow[];
}

async function getChapterParagraphCount(bookId: string, chapterId: string | null) {
  if (!chapterId) {
    return 0;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { count, error } = await supabase
    .from("paragraphs")
    .select("id", { count: "exact", head: true })
    .eq("book_id", bookId)
    .eq("chapter_id", chapterId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function buildProgressLabel(params: {
  chapters: ChapterRow[];
  chapter: ChapterRow | null;
  paragraphOrder: number | null;
  paragraphCount: number;
}) {
  const { chapters, chapter, paragraphOrder, paragraphCount } = params;

  if (!chapter || chapters.length === 0) {
    return null;
  }

  const chapterIndex = chapters.findIndex((entry) => entry.id === chapter.id);
  const safeChapterIndex = chapterIndex >= 0 ? chapterIndex : Math.max(chapter.order_index - 1, 0);

  if (paragraphOrder !== null && paragraphCount > 0) {
    const paragraphProgress = Math.min(Math.max(paragraphOrder, 1), paragraphCount) / paragraphCount;
    const progress = Math.round(((safeChapterIndex + paragraphProgress) / chapters.length) * 100);

    return `${Math.min(Math.max(progress, 1), 100)}%`;
  }

  return `第 ${chapter.order_index} 章 / 共 ${chapters.length} 章`;
}

export async function getLatestAuthorStatusReadingContext(userId: string): Promise<AuthorStatusReadingContext> {
  const event = await getLatestReadingEvent(userId);
  const eventBook = event ? await getReadyBook(userId, event.book_id) : null;
  const book = eventBook ?? (await getNewestReadyBook(userId));

  if (!book) {
    return {
      user_id: userId,
      book_id: null,
      chapter_id: null,
      book_title: null,
      chapter_title: null,
      progress: null,
      last_read_at: null,
      recent_highlights: [],
      recent_notes: []
    };
  }

  const chapters = await getChapters(book.id);
  const chapter =
    (event?.chapter_id ? chapters.find((entry) => entry.id === event.chapter_id) : null) ??
    (event?.chapter_order ? chapters.find((entry) => entry.order_index === event.chapter_order) : null) ??
    chapters[0] ??
    null;
  const paragraphCount = await getChapterParagraphCount(book.id, chapter?.id ?? null);

  return {
    user_id: userId,
    book_id: book.id,
    chapter_id: chapter?.id ?? null,
    book_title: book.title,
    chapter_title: chapter?.title || (chapter ? `第 ${chapter.order_index} 章` : null),
    progress: buildProgressLabel({
      chapters,
      chapter,
      paragraphOrder: event?.paragraph_order ?? null,
      paragraphCount
    }),
    last_read_at: event?.occurred_at ?? null,
    recent_highlights: [],
    recent_notes: []
  };
}

function buildSourceSummary(context: AuthorStatusReadingContext, source: "ai" | "fallback") {
  const parts = [
    source,
    context.book_title ? `book:${context.book_title}` : "book:none",
    context.chapter_title ? `chapter:${context.chapter_title}` : "chapter:none",
    context.progress ? `progress:${context.progress}` : "progress:none",
    context.last_read_at ? `last_read_at:${context.last_read_at}` : "last_read_at:none"
  ];

  return parts.join("; ");
}

function buildAiUserPrompt(input: GenerateInput) {
  const payload = {
    period: input.timeMood.period,
    mood: input.timeMood.mood,
    scene: input.timeMood.scene,
    cta: input.timeMood.cta,
    book_title: input.context.book_title,
    chapter_title: input.context.chapter_title,
    progress: input.context.progress,
    last_read_at: input.context.last_read_at,
    recent_highlights: input.context.recent_highlights,
    recent_notes: input.context.recent_notes
  };

  return `请基于以下后端输入生成作者状态卡片。不要更改 period、mood、scene、cta，不要补写未提供的阅读记录。

后端输入：
${JSON.stringify(payload, null, 2)}

输出 JSON 字段：
{
  "woolf_status": "她...",
  "thought_title": "今日思绪",
  "thought_body": "我...",
  "cta_hint": "${input.timeMood.cta}"
}`;
}

async function generateAuthorStatusCard(input: GenerateInput) {
  const completion = await generateDeepSeekChatCompletion({
    systemPrompt: AUTHOR_STATUS_SYSTEM_PROMPT,
    userPrompt: buildAiUserPrompt(input),
    temperature: 0.35,
    maxTokens: 420
  });

  return parseAuthorStatusCardJson(completion.answer, input.timeMood.cta);
}

export async function getAuthorStatusForUser(
  userId: string,
  timeInput: EffectiveTimeInput = {}
): Promise<AuthorStatusResult> {
  const { cardDate, timeMood } = getEffectiveAuthorStatusTime(timeInput);
  const fallback = getFallbackAuthorStatusCard(timeMood.period);

  try {
    const cached = await getCachedCard({ userId, cardDate, period: timeMood.period });

    if (cached) {
      return cached;
    }
  } catch (error) {
    if (!isAuthorStatusSchemaMissingError(error)) {
      console.warn("Unable to read author status card cache", error);
    }
  }

  let context: AuthorStatusReadingContext;

  try {
    context = await getLatestAuthorStatusReadingContext(userId);
  } catch (error) {
    console.warn("Unable to load author status reading context", error);
    context = {
      user_id: userId,
      book_id: null,
      chapter_id: null,
      book_title: null,
      chapter_title: null,
      progress: null,
      last_read_at: null,
      recent_highlights: [],
      recent_notes: []
    };
  }

  let content: AuthorStatusCardText | null = null;
  let sourceSummary = buildSourceSummary(context, "fallback");

  if (context.book_title) {
    try {
      content = await generateAuthorStatusCard({ userId, timeMood, context });
      sourceSummary = buildSourceSummary(context, content ? "ai" : "fallback");
    } catch (error) {
      console.warn("Unable to generate author status card AI content", error);
    }
  }

  const finalContent = validateAuthorStatusCardText(content, timeMood.cta) ?? fallback;

  if (content) {
    try {
      await saveCard({
        userId,
        cardDate,
        period: timeMood.period,
        bookId: context.book_id,
        chapterId: context.chapter_id,
        content: finalContent,
        sourceSummary
      });
    } catch (error) {
      if (!isAuthorStatusSchemaMissingError(error)) {
        console.warn("Unable to save author status card cache", error);
      }
    }
  }

  return toApiResponse({
    period: timeMood.period,
    bookId: context.book_id,
    chapterId: context.chapter_id,
    content: finalContent,
    fromCache: false,
    sourceSummary
  });
}
