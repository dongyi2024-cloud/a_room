import type { ResponseLanguage } from "@/types/ai";

export type AcademicTriggerReason =
  | "explicit_user_request"
  | "literary_theory"
  | "feminist_or_gender_studies"
  | "modernism"
  | "author_biography"
  | "historical_context"
  | "named_entity_background_context"
  | "philosophy_or_cultural_studies";

export type AcademicTriggerDecision = {
  shouldRetrieve: boolean;
  reasons: AcademicTriggerReason[];
  themes: string[];
};

export type AcademicSearchIntentType =
  | "named_entity_background"
  | "historical_event_context"
  | "literary_theory"
  | "author_context"
  | "book_research"
  | "cultural_context"
  | "unknown";

export type AcademicKeywordGroups = {
  primary: string[];
  secondary: string[];
  chinese: string[];
  english: string[];
};

export type AcademicSearchKeywordResult = {
  intentType: AcademicSearchIntentType;
  originalQuery: string;
  selectedText: string | null;
  contextExcerpt: string | null;
  keywords: AcademicKeywordGroups;
  searchScope: "trusted_academic_sources_only";
  fallbackUsed: boolean;
};

export type BackgroundQueryEntityType =
  | "person"
  | "literary_character"
  | "place"
  | "organization"
  | "historical_event"
  | "concept"
  | "unknown";

export type BackgroundQueryRewriteResult = {
  searchTerms: string[];
  entityType?: BackgroundQueryEntityType;
  fallbackUsed: boolean;
};

export type TrustedAcademicProvider =
  | "semantic_scholar"
  | "doaj"
  | "internet_archive"
  | "jstor"
  | "project_muse"
  | "cnki_public"
  | "wanfang_public"
  | "cqvip_public"
  | "chaoxing_public"
  | "nssd"
  | "ncpssd"
  | "national_library"
  | "library_reference"
  | "worldcat"
  | "taiwan_new_books"
  | "baidu_baike"
  | "wikipedia"
  | "university_repository"
  | "publisher_or_journal"
  | "mock";

export type AcademicEvidenceType =
  | "academic_paper"
  | "academic_book"
  | "bibliography_record"
  | "publisher_page"
  | "encyclopedia_lead"
  | "archive_record"
  | "low_quality_web";

export type AcademicSourceLanguage = "zh" | "en" | "unknown";

export type AcademicSourceConfidence = "high" | "medium" | "low";

export type AcademicSourceDisplayClass =
  | "academic_recommendation"
  | "bibliography_information"
  | "background_lead"
  | "publication_information"
  | "archive_lead"
  | "suppressed";

export type SourceDisplayPolicy = {
  canDisplayAsAcademicEvidence: boolean;
  canDisplayAsBackgroundLead: boolean;
  canDisplayAsBibliography: boolean;
  requiresExtraVerification: boolean;
};

export type ChineseTrustedSourceCandidate = {
  provider: TrustedAcademicProvider;
  evidenceType: AcademicEvidenceType;
  title: string;
  authors?: string[];
  sourceName?: string;
  publicationYear?: number | null;
  url?: string | null;
  abstract?: string;
  keywords?: string[];
  language?: AcademicSourceLanguage;
  confidence: AcademicSourceConfidence;
  canUseAsAcademicEvidence: boolean;
  canUseAsBackgroundLead: boolean;
  canUseAsBibliography: boolean;
};

export type AcademicSourceCandidate = {
  provider: TrustedAcademicProvider;
  evidenceType?: AcademicEvidenceType;
  title: string;
  sourceName: string;
  url: string | null;
  authors: string[];
  abstractOrSnippet: string;
  year?: number | null;
  publicationYear?: number | null;
  keywords?: string[];
  language?: AcademicSourceLanguage;
  confidence?: AcademicSourceConfidence;
  canUseAsAcademicEvidence?: boolean;
  canUseAsBackgroundLead?: boolean;
  canUseAsBibliography?: boolean;
  externalId?: string | null;
};

export type AcademicRecommendation = {
  id: string;
  title: string;
  scholarOrSource: string;
  sourceName: string;
  summary: string;
  relation: string;
  url: string | null;
  provider: TrustedAcademicProvider;
  year?: number | null;
};

export type AcademicSourceLeadDisplayClass =
  | "bibliography_information"
  | "background_lead"
  | "publication_information"
  | "archive_lead";

export type AcademicSourceLead = {
  id: string;
  displayClass: AcademicSourceLeadDisplayClass;
  label: string;
  title: string;
  sourceName: string;
  summary: string;
  url: string | null;
  provider: TrustedAcademicProvider;
  year?: number | null;
};

export type AcademicRecommendationRequest = {
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
  question: string;
  responseLanguage?: ResponseLanguage;
};

export type AcademicRecommendationResult = {
  shouldDisplay: boolean;
  trigger: AcademicTriggerDecision;
  recommendations: AcademicRecommendation[];
  sourceLeads: AcademicSourceLead[];
  emptyReason?: "not_relevant" | "no_reliable_sources" | "provider_unavailable";
};

export type AcademicRetrievalQuery = {
  query: string;
  themes: string[];
  originalQuery?: string;
  selectedText?: string | null;
  contextExcerpt?: string | null;
  keywords?: string[];
  intentType?: AcademicSearchIntentType;
};

export type AcademicRetrievalProvider = {
  search: (
    queries: AcademicRetrievalQuery[],
    options?: { timeoutMs?: number; maxResults?: number; allowedProviders?: string[] }
  ) => Promise<AcademicSourceCandidate[]>;
};

export type AcademicProviderQueryLanguage = "zh" | "en" | "mixed" | "unknown";

export type AcademicProviderQuery = {
  originalQuery: string;
  normalizedQuery: string;
  keywords: string[];
  language: AcademicProviderQueryLanguage;
  intentType: AcademicSearchIntentType;
  bookTitle?: string;
  chapterTitle?: string;
  selectedText?: string;
  contextExcerpt?: string;
};

export type AcademicProviderSearchOptions = {
  timeoutMs?: number;
  maxResults?: number;
  allowNetwork?: boolean;
  useMockFallback?: boolean;
  allowedProviders?: string[];
};

export type AcademicSearchProvider = {
  id: string;
  displayName: string;
  supportedLanguages: Array<"zh" | "en">;
  supportedEvidenceTypes: AcademicEvidenceType[];
  search: (query: AcademicProviderQuery, options?: AcademicProviderSearchOptions) => Promise<AcademicSourceCandidate[]>;
};
