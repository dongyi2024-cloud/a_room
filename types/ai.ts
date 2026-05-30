import type { AcademicRecommendation, AcademicSourceLead } from "@/types/academic-recommendations";

export type ResponseLanguage = "zh" | "en";

export type AnswerLengthMode = "default" | "detailed";

export type AnswerLengthPolicy = {
  mode: AnswerLengthMode;
  maxSentences: number | null;
};

export type SelectionAiExplanationMode = "plain" | "close_reading";
export type SelectionAiIntent = "strict_grounded" | "interpretive";

export type SelectionAiCitation = {
  type: "book_chunk";
  bookTitle: string;
  chapterId: string;
  chapterTitle: string | null;
  paragraphIds: string[];
  quote: string;
  chunkId: string;
  startParagraphId: string;
  endParagraphId: string;
  startParagraphOrder: number;
  endParagraphOrder: number;
};

export type SelectionAiExplanationContext = {
  targetText: string;
  explanation: string;
};

export type SelectionAiTurn = {
  question: string;
  answer: string;
  truncated: boolean;
  citations?: SelectionAiCitation[];
  academicRecommendations?: AcademicRecommendation[];
  academicSourceLeads?: AcademicSourceLead[];
  insufficientEvidence?: boolean;
  status?: "pending" | "done" | "error";
  errorMessage?: string;
};

export type DialogueSummaryTurn = {
  question: string;
  answer: string;
};

export type DialogueSummaryDraft = {
  coreQuestions: string[];
  answerPoints: string[];
  relatedSourceText: string;
  followUpQuestions: string[];
  editableSummary: string;
};

export type DialogueSummaryRequest = {
  userId: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterOrder: number;
  chapterTitle: string;
  paragraphId: string;
  paragraphOrder: number;
  paragraphText: string;
  selectedText: string;
  conversationReference: string;
  turns: DialogueSummaryTurn[];
};

export type SelectionAiRequest = {
  userId: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterOrder: number;
  chapterTitle: string;
  paragraphId: string | null;
  paragraphOrder: number | null;
  paragraphText: string;
  selectedText: string;
  explanationMode: SelectionAiExplanationMode;
  explanationContext: SelectionAiExplanationContext | null;
  question: string;
  priorTurns: SelectionAiTurn[];
};

export type ChapterEndAiRequest = {
  userId: string;
  bookId: string;
  bookTitle: string;
  chapterOrder: number;
  chapterTitle: string;
  chapterContext: string;
  question: string;
  readerReachedChapterEnd: true;
};

export type ChapterEndAiQuestionRequest = {
  bookId: string;
  bookTitle: string;
  chapterOrder: number;
  chapterTitle: string;
  chapterContext: string;
  readerReachedChapterEnd: true;
};

export type SelectionAiWorkflowState = {
  request: SelectionAiRequest;
  readingContext: string;
  conversationHistory: string;
  recentTurns: SelectionAiTurn[];
  personaPrompt: string;
  intent: SelectionAiIntent;
  responseLanguage: ResponseLanguage;
  answerLengthMode: AnswerLengthMode;
  answerLengthPolicy: AnswerLengthPolicy;
  memoryContext: string;
  retrievedChunkCount: number;
  citations: SelectionAiCitation[];
  academicRecommendations: AcademicRecommendation[];
  academicSourceLeads: AcademicSourceLead[];
  insufficientEvidence: boolean;
  answer: string;
  answerWasTruncated: boolean;
};

export type ChapterEndAiWorkflowState = {
  request: ChapterEndAiRequest;
  readingContext: string;
  personaPrompt: string;
  responseLanguage: ResponseLanguage;
  answerLengthMode: AnswerLengthMode;
  answerLengthPolicy: AnswerLengthPolicy;
  memoryContext: string;
  answer: string;
  answerWasTruncated: boolean;
};

export type ChapterEndAiQuestionWorkflowState = {
  request: ChapterEndAiQuestionRequest;
  readingContext: string;
  personaPrompt: string;
  responseLanguage: ResponseLanguage;
  question: string;
};

export type DialogueSummaryWorkflowState = {
  request: DialogueSummaryRequest;
  readingContext: string;
  conversationContext: string;
  responseLanguage: ResponseLanguage;
  draft: DialogueSummaryDraft;
};

export type SelectionAiSuccessResponse = {
  answer: string;
  truncated: boolean;
  citations: SelectionAiCitation[];
  academicRecommendations: AcademicRecommendation[];
  academicSourceLeads: AcademicSourceLead[];
  insufficientEvidence: boolean;
};

export type ChapterEndAiSuccessResponse = {
  answer: string;
  truncated: boolean;
};

export type ChapterEndAiQuestionSuccessResponse = {
  question: string;
};

export type DialogueSummarySuccessResponse = {
  draft: DialogueSummaryDraft;
};

export type SelectionAiErrorResponse = {
  error: string;
};

export type SelectionAiApiResponse = SelectionAiSuccessResponse | SelectionAiErrorResponse;
export type ChapterEndAiApiResponse = ChapterEndAiSuccessResponse | SelectionAiErrorResponse;
export type ChapterEndAiQuestionApiResponse = ChapterEndAiQuestionSuccessResponse | SelectionAiErrorResponse;
export type DialogueSummaryApiResponse = DialogueSummarySuccessResponse | SelectionAiErrorResponse;
