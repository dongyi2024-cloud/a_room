export type UserMemoryType =
  | "explanation_style"
  | "interpretive_interest"
  | "recurring_question"
  | "answer_length"
  | "reading_assistance";

export type UserMemorySource = "selection_ai" | "chapter_end_ai" | "reader_behavior" | "manual";

export type UserMemoryStatus = "active" | "deleted" | "rejected";

export type UserMemory = {
  id: string;
  userId: string;
  memoryType: UserMemoryType;
  memoryKey: string;
  content: string;
  source: UserMemorySource;
  sourceContext: Record<string, unknown>;
  status: UserMemoryStatus;
  isEnabled: boolean;
  reinforcementCount: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserMemorySettings = {
  userId: string;
  memoryEnabled: boolean;
  updatedAt: string;
};

export type UserMemoryCandidate = {
  memoryType: UserMemoryType;
  memoryKey: string;
  content: string;
  source: UserMemorySource;
  sourceContext: Record<string, unknown>;
};

export type AiMemoryInteractionInput = {
  userId: string;
  source: Extract<UserMemorySource, "selection_ai" | "chapter_end_ai">;
  question: string;
  answer: string;
  explanationMode?: "plain" | "close_reading";
  answerLengthMode?: "default" | "detailed";
  selectedText?: string;
  bookTitle?: string;
  chapterTitle?: string;
};

export type MemoryManagementApiResponse =
  | {
      ok: true;
      settings: UserMemorySettings;
      memories: UserMemory[];
    }
  | {
      error: string;
    };

export type MemorySettingsApiResponse =
  | {
      ok: true;
      settings: UserMemorySettings;
    }
  | {
      error: string;
    };

export type DeleteMemoryApiResponse =
  | {
      ok: true;
      memoryId: string;
    }
  | {
      error: string;
    };

export type CreateMemoryApiResponse =
  | {
      ok: true;
      memory: UserMemory;
    }
  | {
      error: string;
    };
