import "server-only";

import { createHash } from "node:crypto";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  AcademicRecommendation,
  AcademicRecommendationRequest,
  AcademicRecommendationResult,
  AcademicTriggerDecision
} from "@/types/academic-recommendations";
import type { Database, Json } from "@/types/supabase";

type AcademicCacheRow = Database["public"]["Tables"]["academic_recommendation_cache"]["Row"];

const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function buildAcademicRecommendationCacheKey(request: AcademicRecommendationRequest, themes: string[]) {
  const signature = [
    request.bookId,
    request.chapterId,
    request.paragraphId ?? request.paragraphOrder ?? "no-paragraph",
    request.selectedText.replace(/\s+/g, " ").trim().slice(0, 280),
    request.question.replace(/\s+/g, " ").trim().slice(0, 220),
    themes.map((theme) => theme.toLowerCase()).sort().join("|")
  ].join("\n");

  return createHash("sha1").update(signature).digest("hex");
}

function isRecommendation(value: unknown): value is AcademicRecommendation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AcademicRecommendation>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.scholarOrSource === "string" &&
    typeof candidate.sourceName === "string" &&
    typeof candidate.summary === "string" &&
    typeof candidate.relation === "string" &&
    typeof candidate.provider === "string"
  );
}

function parseRecommendations(value: Json) {
  return Array.isArray(value) ? value.filter(isRecommendation) : [];
}

export async function getCachedAcademicRecommendations(params: {
  userId: string;
  bookId: string;
  cacheKey: string;
  trigger: AcademicTriggerDecision;
}): Promise<AcademicRecommendationResult | null> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("academic_recommendation_cache")
    .select(
      "id, user_id, book_id, chapter_id, paragraph_id, chapter_order, paragraph_order, cache_key, trigger_reasons, themes, recommendations, source_count, retrieved_at, created_at, updated_at"
    )
    .eq("user_id", params.userId)
    .eq("book_id", params.bookId)
    .eq("cache_key", params.cacheKey)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as AcademicCacheRow;
  const retrievedAt = new Date(row.retrieved_at).getTime();

  if (!Number.isFinite(retrievedAt) || Date.now() - retrievedAt > CACHE_MAX_AGE_MS) {
    return null;
  }

  const recommendations = parseRecommendations(row.recommendations);

  if (recommendations.length === 0) {
    return null;
  }

  return {
    shouldDisplay: true,
    trigger: params.trigger,
    recommendations,
    sourceLeads: []
  };
}

export async function cacheAcademicRecommendations(params: {
  request: AcademicRecommendationRequest;
  cacheKey: string;
  trigger: AcademicTriggerDecision;
  recommendations: AcademicRecommendation[];
}) {
  const { request, cacheKey, trigger, recommendations } = params;
  const supabase = getSupabaseServiceRoleClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("academic_recommendation_cache").upsert(
    {
      user_id: request.userId,
      book_id: request.bookId,
      chapter_id: request.chapterId || null,
      paragraph_id: request.paragraphId,
      chapter_order: request.chapterOrder,
      paragraph_order: request.paragraphOrder,
      cache_key: cacheKey,
      trigger_reasons: trigger.reasons,
      themes: trigger.themes,
      recommendations: toJson(recommendations),
      source_count: recommendations.length,
      retrieved_at: now,
      updated_at: now
    },
    { onConflict: "user_id,book_id,cache_key" }
  );

  if (error) {
    throw error;
  }
}
