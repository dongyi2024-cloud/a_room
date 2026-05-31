export type ReflectionCard = {
  id: string;
  userId: string;
  displayName: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterOrder: number;
  chapterTitle: string;
  paragraphId: string;
  paragraphOrder: number;
  paragraphExcerpt: string;
  content: string;
  moderationStatus: "visible" | "pending_review" | "hidden";
  reportCount: number;
  createdAt: string;
  likeCount: number;
  likedByCurrentUser: boolean;
};

export type ReflectionDeleteResponse = {
  cardId: string;
};

export type ReflectionFeedContext = {
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterOrder: number;
  chapterTitle: string;
  paragraphId: string;
  paragraphOrder: number;
  paragraphExcerpt: string;
};

export type ReflectionFeedResponse = {
  context: ReflectionFeedContext;
  cards: ReflectionCard[];
};

export type ReflectionFeedErrorResponse = {
  error: string;
};

export type ReflectionFeedApiResponse = ReflectionFeedResponse | ReflectionFeedErrorResponse;

export type ReflectionLikeResponse = {
  cardId: string;
  likeCount: number;
  likedByCurrentUser: boolean;
};

export type ReflectionLikeApiResponse = ReflectionLikeResponse | ReflectionFeedErrorResponse;

export type ReflectionDeleteApiResponse = ReflectionDeleteResponse | ReflectionFeedErrorResponse;
