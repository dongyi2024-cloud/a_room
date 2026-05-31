import type { ReflectionCard, ReflectionFeedContext } from "@/types/reflections";

export type CommunityShareDraft = {
  noteId: string;
  content: string;
  context: ReflectionFeedContext;
};

export type CommunityShareDraftResponse = {
  draft: CommunityShareDraft;
};

export type CommunitySharePublishRequest = {
  noteId?: string;
  content?: string;
};

export type CommunitySharePublishResponse = {
  draft: CommunityShareDraft;
  card: ReflectionCard;
};

export type CommunityShareErrorResponse = {
  error: string;
};

export type CommunityShareApiResponse =
  | CommunityShareDraftResponse
  | CommunitySharePublishResponse
  | CommunityShareErrorResponse;
