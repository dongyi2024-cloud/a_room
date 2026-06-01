export type ReaderParagraph = {
  id: string;
  orderIndex: number;
  content: string;
  smartMarks: ReaderSmartMark[];
};

export type ReaderChapter = {
  id: string;
  orderIndex: number;
  title: string;
  paragraphs: ReaderParagraph[];
};

export type ReaderBookSummary = {
  id: string;
  title: string;
  author: string;
  language: string;
  description: string;
  coverPath: string | null;
  chapterCount: number;
  paragraphCount: number;
};

export type ReaderBookDetail = ReaderBookSummary & {
  chapters: ReaderChapter[];
};

export type SmartMarkType =
  | "difficult-term"
  | "background"
  | "person"
  | "place"
  | "historical-context"
  | "literary-allusion"
  | "abstract-concept"
  | "author-keyword";

export type ReaderSmartMark = {
  chapterOrder: number;
  paragraphId: string;
  paragraphOrder: number;
  targetText: string;
  markType: SmartMarkType;
  explanation: string | null;
  startOffset: number;
  endOffset: number;
};

export type ReaderProgressRecord = {
  version: 1;
  userId: string;
  bookId: string;
  chapterOrder: number;
  paragraphOrder: number;
  scrollOffset: number;
  updatedAt: string;
};
