import "server-only";

import { randomUUID } from "node:crypto";
import { formatMemoriesForPrompt, generateMemoryCandidates } from "@/lib/memory/candidates";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  AiMemoryInteractionInput,
  UserMemory,
  UserMemoryCandidate,
  UserMemoryType,
  UserMemorySettings
} from "@/types/memory";
import type { Database, Json } from "@/types/supabase";

type UserMemoryRow = Database["public"]["Tables"]["user_memories"]["Row"];
type UserMemorySettingsRow = Database["public"]["Tables"]["user_memory_settings"]["Row"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toJsonRecord(value: Record<string, unknown>): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function toMemory(row: UserMemoryRow): UserMemory {
  return {
    id: row.id,
    userId: row.user_id,
    memoryType: row.memory_type,
    memoryKey: row.memory_key,
    content: row.content,
    source: row.source,
    sourceContext: isRecord(row.source_context) ? row.source_context : {},
    status: row.status,
    isEnabled: row.is_enabled,
    reinforcementCount: row.reinforcement_count,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toSettings(row: UserMemorySettingsRow): UserMemorySettings {
  return {
    userId: row.user_id,
    memoryEnabled: row.memory_enabled,
    updatedAt: row.updated_at
  };
}

function normalizeManualMemoryKey(content: string) {
  return content
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export async function getUserMemorySettings(userId: string): Promise<UserMemorySettings> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("user_memory_settings")
    .select("id, user_id, memory_enabled, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return toSettings(data as UserMemorySettingsRow);
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("user_memory_settings")
    .insert({
      user_id: userId,
      memory_enabled: true,
      created_at: now,
      updated_at: now
    })
    .select("id, user_id, memory_enabled, created_at, updated_at")
    .single();

  if (insertError) {
    throw insertError;
  }

  return toSettings(inserted as UserMemorySettingsRow);
}

export async function setUserMemoryEnabled(userId: string, memoryEnabled: boolean) {
  const supabase = getSupabaseServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_memory_settings")
    .upsert(
      {
        user_id: userId,
        memory_enabled: memoryEnabled,
        updated_at: now
      },
      { onConflict: "user_id" }
    )
    .select("id, user_id, memory_enabled, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return toSettings(data as UserMemorySettingsRow);
}

export async function listUserMemories(userId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("user_memories")
    .select(
      "id, user_id, memory_type, memory_key, content, source, source_context, status, is_enabled, reinforcement_count, deleted_at, created_at, updated_at"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("is_enabled", true)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return ((data ?? []) as UserMemoryRow[]).map(toMemory);
}

export async function loadAiMemoryContext(userId: string) {
  const settings = await getUserMemorySettings(userId);

  if (!settings.memoryEnabled) {
    return "";
  }

  const memories = await listUserMemories(userId);
  return formatMemoriesForPrompt(memories);
}

export async function deleteUserMemory(params: { userId: string; memoryId: string }) {
  const { userId, memoryId } = params;
  const supabase = getSupabaseServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_memories")
    .update({
      status: "deleted",
      is_enabled: false,
      deleted_at: now,
      updated_at: now
    })
    .eq("id", memoryId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function createManualUserMemory(params: { userId: string; memoryType: UserMemoryType; content: string }) {
  const { userId, memoryType } = params;
  const content = params.content.replace(/\s+/g, " ").trim().slice(0, 180);

  if (!content) {
    throw new Error("Memory content is required.");
  }

  const supabase = getSupabaseServiceRoleClient();
  const now = new Date().toISOString();
  const memoryKey = `manual:${memoryType}:${normalizeManualMemoryKey(content) || randomUUID()}`;
  const { data, error } = await supabase
    .from("user_memories")
    .upsert(
      {
        user_id: userId,
        memory_type: memoryType,
        memory_key: memoryKey,
        content,
        source: "manual",
        source_context: toJsonRecord({ createdFrom: "memory_management" }),
        status: "active",
        is_enabled: true,
        deleted_at: null,
        reinforcement_count: 1,
        created_at: now,
        updated_at: now
      },
      { onConflict: "user_id,memory_key" }
    )
    .select(
      "id, user_id, memory_type, memory_key, content, source, source_context, status, is_enabled, reinforcement_count, deleted_at, created_at, updated_at"
    )
    .single();

  if (error) {
    throw error;
  }

  return toMemory(data as UserMemoryRow);
}

async function upsertCandidate(userId: string, candidate: UserMemoryCandidate) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: existing, error: existingError } = await supabase
    .from("user_memories")
    .select("id, reinforcement_count")
    .eq("user_id", userId)
    .eq("memory_key", candidate.memoryKey)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const now = new Date().toISOString();

  if (existing) {
    const { error } = await supabase
      .from("user_memories")
      .update({
        content: candidate.content,
        source: candidate.source,
        source_context: toJsonRecord(candidate.sourceContext),
        status: "active",
        is_enabled: true,
        deleted_at: null,
        reinforcement_count: (existing.reinforcement_count ?? 0) + 1,
        updated_at: now
      })
      .eq("id", existing.id)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from("user_memories").insert({
    user_id: userId,
    memory_type: candidate.memoryType,
    memory_key: candidate.memoryKey,
    content: candidate.content,
    source: candidate.source,
    source_context: toJsonRecord(candidate.sourceContext),
    status: "active",
    is_enabled: true,
    reinforcement_count: 1,
    created_at: now,
    updated_at: now
  });

  if (error) {
    throw error;
  }
}

export async function recordAiMemoryCandidates(input: AiMemoryInteractionInput) {
  const settings = await getUserMemorySettings(input.userId);

  if (!settings.memoryEnabled) {
    return [];
  }

  const candidates = generateMemoryCandidates(input);

  for (const candidate of candidates) {
    await upsertCandidate(input.userId, candidate);
  }

  return candidates;
}
