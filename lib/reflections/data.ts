import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { ReflectionCard, ReflectionFeedContext } from "@/types/reflections";
import type { Database } from "@/types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ReflectionCardRow = Database["public"]["Tables"]["reflection_cards"]["Row"];
type ReflectionCardLikeRow = Database["public"]["Tables"]["reflection_card_likes"]["Row"];

type ReflectionQuery = {
  bookId: string;
  chapterOrder: number;
  paragraphOrder: number;
};

type CreateReflectionInput = ReflectionQuery & {
  userId: string;
  content: string;
};

type DeleteReflectionInput = {
  cardId: string;
  userId: string;
};

type ReflectionMetadataMaps = {
  bookTitles: Map<string, string>;
  chapters: Map<string, { order: number; title: string }>;
  paragraphs: Map<string, number>;
};

type ReflectionLikeSummary = {
  likeCounts: Map<string, number>;
  likedCardIds: Set<string>;
};

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "";
}

function isMissingReflectionLikeSchemaError(error: unknown) {
  const message = getUnknownErrorMessage(error);

  return (
    message.includes("reflection_card_likes") &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("Could not find the table"))
  );
}

function normalizeExcerpt(content: string, maxLength = 160) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function normalizeReflectionContent(content: string) {
  return content.replace(/\s+/g, " ").trim();
}

function normalizeDisplayName(profile: Pick<ProfileRow, "display_name"> | null) {
  const normalized = profile?.display_name?.replace(/\s+/g, " ").trim();

  return normalized || "一位读者";
}

function normalizeModerationStatus(value: string): ReflectionCard["moderationStatus"] {
  if (value === "pending_review" || value === "hidden") {
    return value;
  }

  return "visible";
}

async function getParagraphContext(query: ReflectionQuery): Promise<ReflectionFeedContext | null> {
  const supabase = getSupabaseServiceRoleClient();
  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, title")
    .eq("id", query.bookId)
    .eq("import_status", "ready")
    .maybeSingle();

  if (bookError) {
    throw bookError;
  }

  if (!book) {
    return null;
  }

  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id, title, order_index")
    .eq("book_id", query.bookId)
    .eq("order_index", query.chapterOrder)
    .maybeSingle();

  if (chapterError) {
    throw chapterError;
  }

  if (!chapter) {
    return null;
  }

  const { data: paragraph, error: paragraphError } = await supabase
    .from("paragraphs")
    .select("id, order_index, content")
    .eq("book_id", query.bookId)
    .eq("chapter_id", chapter.id)
    .eq("order_index", query.paragraphOrder)
    .maybeSingle();

  if (paragraphError) {
    throw paragraphError;
  }

  if (!paragraph) {
    return null;
  }

  return {
    bookId: book.id,
    bookTitle: book.title,
    chapterId: chapter.id,
    chapterOrder: chapter.order_index,
    chapterTitle: chapter.title || `第 ${chapter.order_index} 章`,
    paragraphId: paragraph.id,
    paragraphOrder: paragraph.order_index,
    paragraphExcerpt: normalizeExcerpt(paragraph.content)
  };
}

function toReflectionCard(
  row: ReflectionCardRow,
  context: ReflectionFeedContext,
  likeSummary?: ReflectionLikeSummary
): ReflectionCard {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name_snapshot || "一位读者",
    bookId: row.book_id,
    bookTitle: context.bookTitle,
    chapterId: row.chapter_id,
    chapterOrder: context.chapterOrder,
    chapterTitle: context.chapterTitle,
    paragraphId: row.paragraph_id,
    paragraphOrder: context.paragraphOrder,
    paragraphExcerpt: row.paragraph_excerpt,
    content: row.content,
    moderationStatus: normalizeModerationStatus(row.moderation_status),
    reportCount: row.report_count,
    createdAt: row.created_at,
    likeCount: likeSummary?.likeCounts.get(row.id) ?? 0,
    likedByCurrentUser: likeSummary?.likedCardIds.has(row.id) ?? false
  };
}

async function buildReflectionMetadataMaps(rows: ReflectionCardRow[]): Promise<ReflectionMetadataMaps> {
  const bookIds = [...new Set(rows.map((row) => row.book_id))];
  const chapterIds = [...new Set(rows.map((row) => row.chapter_id))];
  const paragraphIds = [...new Set(rows.map((row) => row.paragraph_id))];
  const supabase = getSupabaseServiceRoleClient();

  const [booksResult, chaptersResult, paragraphsResult] = await Promise.all([
    bookIds.length > 0
      ? supabase.from("books").select("id, title").in("id", bookIds).eq("import_status", "ready")
      : Promise.resolve({ data: [], error: null }),
    chapterIds.length > 0
      ? supabase.from("chapters").select("id, title, order_index").in("id", chapterIds)
      : Promise.resolve({ data: [], error: null }),
    paragraphIds.length > 0
      ? supabase.from("paragraphs").select("id, order_index").in("id", paragraphIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (booksResult.error) {
    throw booksResult.error;
  }

  if (chaptersResult.error) {
    throw chaptersResult.error;
  }

  if (paragraphsResult.error) {
    throw paragraphsResult.error;
  }

  return {
    bookTitles: new Map((booksResult.data ?? []).map((book) => [book.id, book.title])),
    chapters: new Map(
      (chaptersResult.data ?? []).map((chapter) => [
        chapter.id,
        {
          order: chapter.order_index,
          title: chapter.title || `第 ${chapter.order_index} 章`
        }
      ])
    ),
    paragraphs: new Map((paragraphsResult.data ?? []).map((paragraph) => [paragraph.id, paragraph.order_index]))
  };
}

function toReflectionCardFromMaps(
  row: ReflectionCardRow,
  maps: ReflectionMetadataMaps,
  likeSummary?: ReflectionLikeSummary
): ReflectionCard | null {
  const bookTitle = maps.bookTitles.get(row.book_id);
  const chapter = maps.chapters.get(row.chapter_id);
  const paragraphOrder = maps.paragraphs.get(row.paragraph_id);

  if (!bookTitle || !chapter || paragraphOrder === undefined) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name_snapshot || "一位读者",
    bookId: row.book_id,
    bookTitle,
    chapterId: row.chapter_id,
    chapterOrder: chapter.order,
    chapterTitle: chapter.title,
    paragraphId: row.paragraph_id,
    paragraphOrder,
    paragraphExcerpt: row.paragraph_excerpt,
    content: row.content,
    moderationStatus: normalizeModerationStatus(row.moderation_status),
    reportCount: row.report_count,
    createdAt: row.created_at,
    likeCount: likeSummary?.likeCounts.get(row.id) ?? 0,
    likedByCurrentUser: likeSummary?.likedCardIds.has(row.id) ?? false
  };
}

async function getReflectionLikeSummary(cardIds: string[], currentUserId?: string | null): Promise<ReflectionLikeSummary> {
  if (cardIds.length === 0) {
    return {
      likeCounts: new Map(),
      likedCardIds: new Set()
    };
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("reflection_card_likes")
    .select("card_id, user_id, created_at, id")
    .in("card_id", cardIds);

  if (error) {
    if (isMissingReflectionLikeSchemaError(error)) {
      return {
        likeCounts: new Map(),
        likedCardIds: new Set()
      };
    }

    throw error;
  }

  const rows = (data ?? []) as ReflectionCardLikeRow[];
  const likeCounts = new Map<string, number>();
  const likedCardIds = new Set<string>();

  for (const row of rows) {
    likeCounts.set(row.card_id, (likeCounts.get(row.card_id) ?? 0) + 1);

    if (currentUserId && row.user_id === currentUserId) {
      likedCardIds.add(row.card_id);
    }
  }

  return {
    likeCounts,
    likedCardIds
  };
}

export async function listReflectionCardsForParagraph(query: ReflectionQuery, currentUserId?: string | null) {
  const context = await getParagraphContext(query);

  if (!context) {
    return null;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("reflection_cards")
    .select(
      "id, user_id, book_id, chapter_id, paragraph_id, content, paragraph_excerpt, display_name_snapshot, moderation_status, report_count, created_at, updated_at"
    )
    .eq("book_id", context.bookId)
    .eq("chapter_id", context.chapterId)
    .eq("paragraph_id", context.paragraphId)
    .neq("moderation_status", "hidden")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ReflectionCardRow[];
  const likeSummary = await getReflectionLikeSummary(
    rows.map((row) => row.id),
    currentUserId
  );

  return {
    context,
    cards: rows.map((row) => toReflectionCard(row, context, likeSummary))
  };
}

export async function listAllReflectionCards(currentUserId?: string | null) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("reflection_cards")
    .select(
      "id, user_id, book_id, chapter_id, paragraph_id, content, paragraph_excerpt, display_name_snapshot, moderation_status, report_count, created_at, updated_at"
    )
    .neq("moderation_status", "hidden")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ReflectionCardRow[];

  if (rows.length === 0) {
    return [];
  }

  const maps = await buildReflectionMetadataMaps(rows);
  const likeSummary = await getReflectionLikeSummary(
    rows.map((row) => row.id),
    currentUserId
  );

  return rows
    .map((row) => toReflectionCardFromMaps(row, maps, likeSummary))
    .filter((card): card is ReflectionCard => card !== null);
}

export async function createReflectionCard(input: CreateReflectionInput) {
  const normalizedContent = normalizeReflectionContent(input.content);

  if (normalizedContent.length < 2) {
    throw new Error("感悟内容太短了，至少写下两三个字。");
  }

  if (normalizedContent.length > 600) {
    throw new Error("感悟内容请控制在 600 字以内。");
  }

  const context = await getParagraphContext(input);

  if (!context) {
    throw new Error("当前段落上下文不存在，暂时不能发布感悟。");
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", input.userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const displayNameSnapshot = normalizeDisplayName(profile as Pick<ProfileRow, "display_name"> | null);
  const insertPayload: Database["public"]["Tables"]["reflection_cards"]["Insert"] = {
    user_id: input.userId,
    book_id: context.bookId,
    chapter_id: context.chapterId,
    paragraph_id: context.paragraphId,
    content: normalizedContent,
    paragraph_excerpt: context.paragraphExcerpt,
    display_name_snapshot: displayNameSnapshot
  };

  const { data, error } = await supabase
    .from("reflection_cards")
    .insert(insertPayload)
    .select(
      "id, user_id, book_id, chapter_id, paragraph_id, content, paragraph_excerpt, display_name_snapshot, moderation_status, report_count, created_at, updated_at"
    )
    .single();

  if (error) {
    throw error;
  }

  return {
    context,
    card: toReflectionCard(data as ReflectionCardRow, context)
  };
}

export async function toggleReflectionCardLike(input: { cardId: string; userId: string }) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: existingCard, error: cardError } = await supabase
    .from("reflection_cards")
    .select("id")
    .eq("id", input.cardId)
    .maybeSingle();

  if (cardError) {
    throw cardError;
  }

  if (!existingCard) {
    throw new Error("这张感悟卡片暂时不存在，无法点赞。");
  }

  const { data: existingLike, error: existingLikeError } = await supabase
    .from("reflection_card_likes")
    .select("id, card_id, user_id, created_at")
    .eq("card_id", input.cardId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existingLikeError) {
    throw existingLikeError;
  }

  if (existingLike) {
    const { error: deleteError } = await supabase
      .from("reflection_card_likes")
      .delete()
      .eq("id", existingLike.id);

    if (deleteError) {
      throw deleteError;
    }
  } else {
    const insertPayload: Database["public"]["Tables"]["reflection_card_likes"]["Insert"] = {
      card_id: input.cardId,
      user_id: input.userId
    };

    const { error: insertError } = await supabase.from("reflection_card_likes").insert(insertPayload);

    if (insertError) {
      throw insertError;
    }
  }

  const likeSummary = await getReflectionLikeSummary([input.cardId], input.userId);

  return {
    cardId: input.cardId,
    likeCount: likeSummary.likeCounts.get(input.cardId) ?? 0,
    likedByCurrentUser: likeSummary.likedCardIds.has(input.cardId)
  };
}

export async function deleteReflectionCard(input: DeleteReflectionInput) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: existingCard, error: cardError } = await supabase
    .from("reflection_cards")
    .select("id, user_id")
    .eq("id", input.cardId)
    .maybeSingle();

  if (cardError) {
    throw cardError;
  }

  if (!existingCard) {
    throw new Error("这张感悟卡片暂时不存在，不能删除。");
  }

  if (existingCard.user_id !== input.userId) {
    throw new Error("你只能删除自己发布的感悟。");
  }

  const { error: deleteError } = await supabase
    .from("reflection_cards")
    .delete()
    .eq("id", input.cardId)
    .eq("user_id", input.userId);

  if (deleteError) {
    throw deleteError;
  }

  return {
    cardId: input.cardId
  };
}
