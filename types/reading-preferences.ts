export type ThemeMode = "light" | "dark";

export type UserReadingPreferences = {
  userId: string;
  themeMode: ThemeMode;
  readingSlumpDetectionEnabled: boolean;
  updatedAt: string;
};

export type ReadingPreferencesUpdateRequest = {
  themeMode?: ThemeMode;
  readingSlumpDetectionEnabled?: boolean;
};

export type ReadingPreferencesApiResponse =
  | {
      ok: true;
      preferences: UserReadingPreferences;
    }
  | {
      error: string;
    };
