import "server-only";

import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { ThemeMode, UserReadingPreferences } from "@/types/reading-preferences";
import type { Database } from "@/types/supabase";

type UserAppSettingsRow = Database["public"]["Tables"]["user_app_settings"]["Row"];

export class ReadingPreferencesValidationError extends Error {}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

function toReadingPreferences(row: UserAppSettingsRow): UserReadingPreferences {
  return {
    userId: row.user_id,
    themeMode: row.theme_mode,
    readingSlumpDetectionEnabled: row.reading_slump_detection_enabled,
    updatedAt: row.updated_at
  };
}

export function getDefaultReadingPreferences(userId: string): UserReadingPreferences {
  return {
    userId,
    themeMode: "light",
    readingSlumpDetectionEnabled: true,
    updatedAt: new Date().toISOString()
  };
}

export function getDisabledReadingSlumpState() {
  return {
    status: "steady" as const,
    triggeredSignals: [],
    signalCount: 0,
    ruleVersion: 0,
    evaluatedAt: new Date().toISOString(),
    reminderSuppressedUntil: null,
    lastDismissedAt: null,
    isReminderEligible: false
  };
}

export async function getUserReadingPreferences(userId: string): Promise<UserReadingPreferences> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("user_app_settings")
    .select("id, user_id, theme_mode, reading_slump_detection_enabled, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return toReadingPreferences(data as UserAppSettingsRow);
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("user_app_settings")
    .insert({
      user_id: userId,
      theme_mode: "light",
      reading_slump_detection_enabled: true,
      created_at: now,
      updated_at: now
    })
    .select("id, user_id, theme_mode, reading_slump_detection_enabled, created_at, updated_at")
    .single();

  if (insertError) {
    throw insertError;
  }

  return toReadingPreferences(inserted as UserAppSettingsRow);
}

export async function updateUserReadingPreferences(
  userId: string,
  input: {
    themeMode?: unknown;
    readingSlumpDetectionEnabled?: unknown;
  }
) {
  const current = await getUserReadingPreferences(userId);
  const nextThemeMode =
    input.themeMode === undefined
      ? current.themeMode
      : isThemeMode(input.themeMode)
        ? input.themeMode
        : null;

  if (!nextThemeMode) {
    throw new ReadingPreferencesValidationError("请选择有效的日间或夜间模式。");
  }

  if (
    input.readingSlumpDetectionEnabled !== undefined &&
    typeof input.readingSlumpDetectionEnabled !== "boolean"
  ) {
    throw new ReadingPreferencesValidationError("请选择有效的阅读低迷检测开关状态。");
  }

  const nextSlumpDetectionEnabled =
    input.readingSlumpDetectionEnabled === undefined
      ? current.readingSlumpDetectionEnabled
      : input.readingSlumpDetectionEnabled;
  const supabase = getSupabaseServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_app_settings")
    .upsert(
      {
        user_id: userId,
        theme_mode: nextThemeMode,
        reading_slump_detection_enabled: nextSlumpDetectionEnabled,
        updated_at: now
      },
      { onConflict: "user_id" }
    )
    .select("id, user_id, theme_mode, reading_slump_detection_enabled, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return toReadingPreferences(data as UserAppSettingsRow);
}
