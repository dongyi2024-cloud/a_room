"use client";

import { useEffect, useState } from "react";
import type {
  ReadingPreferencesApiResponse,
  ThemeMode,
  UserReadingPreferences
} from "@/types/reading-preferences";

type ReadingPreferencesPanelProps = {
  initialPreferences: UserReadingPreferences;
};

const THEME_STORAGE_KEY = "woolf-room.theme-mode.v1";

function applyThemeMode(themeMode: ThemeMode) {
  document.documentElement.dataset.theme = themeMode;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  } catch {
    // Theme persistence fallback should not block the settings UI.
  }
}

async function parsePreferencesResponse(response: Response) {
  const payload = (await response.json()) as ReadingPreferencesApiResponse;

  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "暂时无法保存阅读设置。");
  }

  return payload.preferences;
}

export function ReadingPreferencesPanel({ initialPreferences }: ReadingPreferencesPanelProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [pendingThemeMode, setPendingThemeMode] = useState<ThemeMode | null>(null);
  const [isTogglingSlumpDetection, setIsTogglingSlumpDetection] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const isSavingTheme = pendingThemeMode !== null;

  useEffect(() => {
    applyThemeMode(preferences.themeMode);
  }, [preferences.themeMode]);

  async function updatePreferences(next: {
    themeMode?: ThemeMode;
    readingSlumpDetectionEnabled?: boolean;
  }) {
    const response = await fetch("/api/settings/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(next)
    });

    return parsePreferencesResponse(response);
  }

  async function selectThemeMode(themeMode: ThemeMode) {
    if (themeMode === preferences.themeMode || isSavingTheme) {
      return;
    }

    const previousPreferences = preferences;
    setPendingThemeMode(themeMode);
    setErrorMessage("");
    setStatusMessage("");
    setPreferences((current) => ({ ...current, themeMode }));

    try {
      const saved = await updatePreferences({ themeMode });
      setPreferences(saved);
      setStatusMessage(themeMode === "dark" ? "已切换为夜间模式。" : "已切换为日间模式。");
    } catch (error) {
      setPreferences(previousPreferences);
      applyThemeMode(previousPreferences.themeMode);
      setErrorMessage(error instanceof Error ? error.message : "暂时无法保存阅读设置。");
    } finally {
      setPendingThemeMode(null);
    }
  }

  async function toggleSlumpDetection(nextEnabled: boolean) {
    if (isTogglingSlumpDetection) {
      return;
    }

    const previousPreferences = preferences;
    setIsTogglingSlumpDetection(true);
    setErrorMessage("");
    setStatusMessage("");
    setPreferences((current) => ({
      ...current,
      readingSlumpDetectionEnabled: nextEnabled
    }));

    try {
      const saved = await updatePreferences({ readingSlumpDetectionEnabled: nextEnabled });
      setPreferences(saved);
      setStatusMessage(nextEnabled ? "阅读低迷检测已开启。" : "阅读低迷检测已关闭，不会继续记录低迷检测行为。");
    } catch (error) {
      setPreferences(previousPreferences);
      setErrorMessage(error instanceof Error ? error.message : "暂时无法保存阅读设置。");
    } finally {
      setIsTogglingSlumpDetection(false);
    }
  }

  return (
    <section className="reading-preferences-panel">
      <article className="soft-card reading-preference-card">
        <div>
          <p className="page-eyebrow">Theme</p>
          <h2 className="settings-card-title">日间 / 夜间模式</h2>
          <p className="settings-card-copy">选择更适合当前阅读环境的界面亮度。</p>
        </div>
        <div className="theme-mode-control" role="group" aria-label="主题模式">
          <button
            aria-pressed={preferences.themeMode === "light"}
            className={`button-reset theme-mode-option${preferences.themeMode === "light" ? " is-active" : ""}`}
            disabled={isSavingTheme}
            onClick={() => selectThemeMode("light")}
            type="button"
          >
            日间
          </button>
          <button
            aria-pressed={preferences.themeMode === "dark"}
            className={`button-reset theme-mode-option${preferences.themeMode === "dark" ? " is-active" : ""}`}
            disabled={isSavingTheme}
            onClick={() => selectThemeMode("dark")}
            type="button"
          >
            夜间
          </button>
        </div>
      </article>

      <article className="soft-card reading-preference-card">
        <div>
          <p className="page-eyebrow">Reading assistance</p>
          <h2 className="settings-card-title">阅读低迷检测</h2>
          <p className="settings-card-copy">
            开启后，系统会根据阅读行为判断是否需要救急包提醒；关闭后不会继续写入低迷检测行为事件。
          </p>
        </div>
        <button
          aria-pressed={preferences.readingSlumpDetectionEnabled}
          className={`memory-toggle button-reset${preferences.readingSlumpDetectionEnabled ? " is-on" : ""}`}
          disabled={isTogglingSlumpDetection}
          onClick={() => toggleSlumpDetection(!preferences.readingSlumpDetectionEnabled)}
          type="button"
        >
          {preferences.readingSlumpDetectionEnabled ? "已开启" : "已关闭"}
        </button>
      </article>

      {statusMessage ? <p className="form-success page-feedback">{statusMessage}</p> : null}
      {errorMessage ? <p className="form-error page-feedback">{errorMessage}</p> : null}
    </section>
  );
}
