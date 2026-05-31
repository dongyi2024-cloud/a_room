import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const schemaSource = read("supabase/schema.sql");
const supabaseTypesSource = read("types/supabase.ts");
const preferencesTypesSource = read("types/reading-preferences.ts");
const preferencesDataSource = read("lib/settings/reading-preferences.ts");
const preferencesRouteSource = read("app/api/settings/preferences/route.ts");
const preferencesPageSource = read("app/settings/preferences/page.tsx");
const preferencesPanelSource = read("components/settings/reading-preferences-panel.tsx");
const layoutSource = read("app/layout.tsx");
const bookshelfSource = read("components/bookshelf/bookshelf-shell.tsx");
const readingSlumpDataSource = read("lib/reading-slump/data.ts");
const rescueReminderSource = read("components/reader/rescue-pack-reminder.tsx");
const cssSource = read("app/globals.css");
const tasksSource = read("openspec/changes/add-user-reading-preferences-settings/tasks.md");

assert.match(schemaSource, /create table if not exists public\.user_app_settings/);
assert.match(schemaSource, /theme_mode text not null default 'light'/);
assert.match(schemaSource, /reading_slump_detection_enabled boolean not null default true/);
assert.match(schemaSource, /idx_user_app_settings_user_id/);
assert.match(schemaSource, /alter table public\.user_app_settings enable row level security/);
assert.match(schemaSource, /create policy "user app settings owner read write"/);

assert.match(supabaseTypesSource, /user_app_settings: \{/);
assert.match(supabaseTypesSource, /theme_mode: "light" \| "dark"/);
assert.match(supabaseTypesSource, /reading_slump_detection_enabled: boolean/);
assert.match(preferencesTypesSource, /export type ThemeMode = "light" \| "dark"/);
assert.match(preferencesTypesSource, /readingSlumpDetectionEnabled: boolean/);

assert.match(preferencesDataSource, /export async function getUserReadingPreferences/);
assert.match(preferencesDataSource, /export async function updateUserReadingPreferences/);
assert.match(preferencesDataSource, /getDisabledReadingSlumpState/);
assert.match(preferencesDataSource, /isThemeMode/);
assert.match(preferencesRouteSource, /export async function GET/);
assert.match(preferencesRouteSource, /export async function POST/);
assert.match(preferencesRouteSource, /ReadingPreferencesValidationError/);
assert.match(preferencesRouteSource, /\/?阅读设置数据表还没有准备好/);

assert.match(preferencesPageSource, /ReadingPreferencesPanel/);
assert.match(preferencesPageSource, /requireUser\("\/settings\/preferences"\)/);
assert.match(preferencesPanelSource, /theme-mode-option/);
assert.match(preferencesPanelSource, /applyThemeMode/);
assert.match(preferencesPanelSource, /woolf-room\.theme-mode\.v1/);
assert.match(preferencesPanelSource, /readingSlumpDetectionEnabled/);
assert.match(preferencesPanelSource, /\/api\/settings\/preferences/);
assert.match(layoutSource, /themeBootScript/);
assert.match(layoutSource, /document\.documentElement\.dataset\.theme/);
assert.match(cssSource, /\[data-theme="dark"\]/);
assert.match(cssSource, /\.reading-preferences-panel/);
assert.match(cssSource, /\.theme-mode-control/);

assert.match(bookshelfSource, /href="\/settings\/preferences"/);
assert.match(bookshelfSource, /阅读设置/);
assert.match(readingSlumpDataSource, /getUserReadingPreferences/);
assert.match(readingSlumpDataSource, /!preferences\.readingSlumpDetectionEnabled/);
assert.match(readingSlumpDataSource, /return getDisabledReadingSlumpState\(\)/);
assert.match(readingSlumpDataSource, /\.from\("reading_behavior_events"\)[\s\S]*?\.insert/);
assert.match(rescueReminderSource, /isRescuePackReminderEligible\(state\)/);
assert.match(rescueReminderSource, /notificationStatus !== "granted"/);

assert.match(tasksSource, /- \[x\] 1\.1/);
assert.match(tasksSource, /- \[x\] 7\.9/);
assert.match(tasksSource, /- \[ \] 7\.10/);

console.log("reading preferences source checks passed");
