export type TimeMoodPeriod = "清晨" | "上午" | "中午" | "下午" | "夜晚" | "深夜";

export type TimeMood = {
  period: TimeMoodPeriod;
  mood: string;
  scene: string;
  cta: string;
};

export type AuthorStatusCardText = {
  woolf_status: string;
  thought_title: string;
  thought_body: string;
  cta_hint: string;
};

export type AuthorStatusReadingContext = {
  user_id: string;
  book_id: string | null;
  chapter_id: string | null;
  book_title: string | null;
  chapter_title: string | null;
  progress: string | null;
  last_read_at: string | null;
  recent_highlights: string[];
  recent_notes: string[];
};

export type AuthorStatusApiResponse = AuthorStatusCardText & {
  period: TimeMoodPeriod;
  book_id: string | null;
  chapter_id: string | null;
  from_cache: boolean;
};
