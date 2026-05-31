import type {
  AcademicEvidenceType,
  AcademicSourceCandidate,
  AcademicSourceDisplayClass,
  ChineseTrustedSourceCandidate,
  SourceDisplayPolicy,
  TrustedAcademicProvider
} from "@/types/academic-recommendations";
import {
  isBackgroundReferenceProvider,
  isBibliographicAuthorityProvider,
  isPrimaryAcademicProvider,
  normalizeAcademicHost
} from "@/lib/academic-recommendations/policy";

export const ACADEMIC_EVIDENCE_TYPES: AcademicEvidenceType[] = [
  "academic_paper",
  "academic_book",
  "bibliography_record",
  "publisher_page",
  "encyclopedia_lead",
  "archive_record",
  "low_quality_web"
];

export const SOURCE_DISPLAY_LABELS: Record<AcademicSourceDisplayClass, string> = {
  academic_recommendation: "学术关联推荐",
  bibliography_information: "书目信息",
  background_lead: "背景线索",
  publication_information: "出版信息",
  archive_lead: "档案线索",
  suppressed: "不展示"
};

export const sourcePolicies: Record<TrustedAcademicProvider, SourceDisplayPolicy> = {
  semantic_scholar: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: false,
    requiresExtraVerification: true
  },
  doaj: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: false,
    requiresExtraVerification: true
  },
  jstor: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: false,
    requiresExtraVerification: true
  },
  project_muse: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: false,
    requiresExtraVerification: true
  },
  cnki_public: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: false,
    requiresExtraVerification: true
  },
  wanfang_public: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: false,
    requiresExtraVerification: true
  },
  cqvip_public: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: false,
    requiresExtraVerification: true
  },
  chaoxing_public: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: true,
    requiresExtraVerification: true
  },
  nssd: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: false,
    requiresExtraVerification: true
  },
  ncpssd: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: false,
    requiresExtraVerification: true
  },
  university_repository: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: true,
    requiresExtraVerification: true
  },
  publisher_or_journal: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: true,
    requiresExtraVerification: true
  },
  internet_archive: {
    canDisplayAsAcademicEvidence: false,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: true,
    requiresExtraVerification: true
  },
  national_library: {
    canDisplayAsAcademicEvidence: false,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: true,
    requiresExtraVerification: true
  },
  library_reference: {
    canDisplayAsAcademicEvidence: false,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: true,
    requiresExtraVerification: true
  },
  worldcat: {
    canDisplayAsAcademicEvidence: false,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: true,
    requiresExtraVerification: true
  },
  taiwan_new_books: {
    canDisplayAsAcademicEvidence: false,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: true,
    requiresExtraVerification: true
  },
  baidu_baike: {
    canDisplayAsAcademicEvidence: false,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: false,
    requiresExtraVerification: true
  },
  wikipedia: {
    canDisplayAsAcademicEvidence: false,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: false,
    requiresExtraVerification: true
  },
  mock: {
    canDisplayAsAcademicEvidence: true,
    canDisplayAsBackgroundLead: true,
    canDisplayAsBibliography: true,
    requiresExtraVerification: true
  }
};

export type ChineseProviderSearchParams = {
  query: string;
  selectedText?: string;
  bookTitle?: string;
  question?: string;
  timeoutMs?: number;
};

export type ChineseTrustedSourceProvider = {
  name: string;
  enabled: boolean;
  search: (params: ChineseProviderSearchParams) => Promise<AcademicSourceCandidate[]>;
};

export type ChineseSocialScienceProvider = ChineseTrustedSourceProvider & {
  layer: "chinese_social_science";
};

export type ChineseBibliographyProvider = ChineseTrustedSourceProvider & {
  layer: "chinese_bibliography";
};

export type ChinesePublisherProvider = ChineseTrustedSourceProvider & {
  layer: "chinese_publisher";
};

export type EncyclopediaLeadProvider = ChineseTrustedSourceProvider & {
  layer: "encyclopedia_lead";
};

export type LicensedChineseAcademicProvider = ChineseTrustedSourceProvider & {
  layer: "licensed_chinese_academic";
  enabled: false;
  requiresAuthorization: true;
  authorizationNote: string;
};

export const LICENSED_CHINESE_ACADEMIC_PROVIDER_NOTE =
  "CNKI, Wanfang, CQVIP, Chaoxing, and similar providers require confirmed authorization and a stable access path before runtime use.";

function compactText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function getSourceDisplayPolicy(provider: TrustedAcademicProvider) {
  return sourcePolicies[provider];
}

export function normalizeChineseTrustedSourceCandidate(candidate: AcademicSourceCandidate): ChineseTrustedSourceCandidate {
  const policy = getSourceDisplayPolicy(candidate.provider);
  const evidenceType = isLowQualityWebCandidate(candidate) ? "low_quality_web" : candidate.evidenceType ?? inferEvidenceType(candidate);

  return {
    provider: candidate.provider,
    evidenceType,
    title: compactText(candidate.title),
    authors: candidate.authors.map(compactText).filter(Boolean),
    sourceName: compactText(candidate.sourceName),
    publicationYear: candidate.publicationYear ?? candidate.year ?? null,
    url: candidate.url,
    abstract: compactText(candidate.abstractOrSnippet),
    keywords: candidate.keywords?.map(compactText).filter(Boolean),
    language: candidate.language ?? inferCandidateLanguage(candidate),
    confidence: candidate.confidence ?? "medium",
    canUseAsAcademicEvidence: candidate.canUseAsAcademicEvidence ?? policy.canDisplayAsAcademicEvidence,
    canUseAsBackgroundLead: candidate.canUseAsBackgroundLead ?? policy.canDisplayAsBackgroundLead,
    canUseAsBibliography: candidate.canUseAsBibliography ?? policy.canDisplayAsBibliography
  };
}

export function inferEvidenceType(candidate: AcademicSourceCandidate): AcademicEvidenceType {
  if (isLowQualityWebCandidate(candidate)) {
    return "low_quality_web";
  }

  if (isBackgroundReferenceProvider(candidate.provider)) {
    return "encyclopedia_lead";
  }

  if (candidate.provider === "internet_archive") {
    return "archive_record";
  }

  if (isBibliographicAuthorityProvider(candidate.provider)) {
    return "bibliography_record";
  }

  const source = `${candidate.sourceName} ${candidate.title}`.toLowerCase();

  if (/press|publisher|出版社|出版|university press/.test(source)) {
    return "publisher_page";
  }

  if (isPrimaryAcademicProvider(candidate.provider)) {
    return "academic_paper";
  }

  return "low_quality_web";
}

export function inferCandidateLanguage(candidate: AcademicSourceCandidate) {
  const text = [candidate.title, candidate.sourceName, candidate.abstractOrSnippet].join(" ");

  if (/[\u4e00-\u9fff]/.test(text)) {
    return "zh" as const;
  }

  if (/[a-z]/i.test(text)) {
    return "en" as const;
  }

  return "unknown" as const;
}

export function hasChineseTrustedSourceMetadata(candidate: ChineseTrustedSourceCandidate) {
  const hasSourceIdentity = Boolean(
    candidate.authors?.length ||
      candidate.sourceName ||
      candidate.provider ||
      normalizeAcademicHost(candidate.url ?? null)
  );
  const hasSupportingMetadata = Boolean(
    candidate.publicationYear || candidate.url || candidate.abstract || candidate.keywords?.length
  );

  return Boolean(candidate.title && hasSourceIdentity && hasSupportingMetadata);
}

export function isAcademicEvidenceType(type: AcademicEvidenceType) {
  return type === "academic_paper" || type === "academic_book";
}

export function canUseAsAcademicEvidence(candidate: AcademicSourceCandidate) {
  const normalized = normalizeChineseTrustedSourceCandidate(candidate);
  const policy = getSourceDisplayPolicy(normalized.provider);

  return (
    isAcademicEvidenceType(normalized.evidenceType) &&
    normalized.canUseAsAcademicEvidence &&
    policy.canDisplayAsAcademicEvidence &&
    hasChineseTrustedSourceMetadata(normalized)
  );
}

export function getCandidateDisplayClass(candidate: AcademicSourceCandidate): AcademicSourceDisplayClass {
  const normalized = normalizeChineseTrustedSourceCandidate(candidate);

  if (normalized.evidenceType === "low_quality_web") {
    return "suppressed";
  }

  if (canUseAsAcademicEvidence(candidate)) {
    return "academic_recommendation";
  }

  if (normalized.evidenceType === "bibliography_record" && normalized.canUseAsBibliography) {
    return "bibliography_information";
  }

  if (normalized.evidenceType === "publisher_page" && normalized.canUseAsBackgroundLead) {
    return "publication_information";
  }

  if (normalized.evidenceType === "archive_record" && normalized.canUseAsBackgroundLead) {
    return "archive_lead";
  }

  if (normalized.evidenceType === "encyclopedia_lead" && normalized.canUseAsBackgroundLead) {
    return "background_lead";
  }

  return "suppressed";
}

export function isChineseContemporaryBookQuery(input: string) {
  const normalized = compactText(input);

  return (
    /[\u4e00-\u9fff]/.test(normalized) &&
    !/(古籍|公版|经典|民国|清代|明代|宋代|唐代|历史文献|影印|档案|版本|原著|英文原著)/.test(normalized)
  );
}

export function shouldUseInternetArchiveForQuery(input: string) {
  const normalized = compactText(input);

  if (isChineseContemporaryBookQuery(normalized)) {
    return false;
  }

  return /(古籍|公版|经典|历史文献|影印|档案|版本|原著|英文原著|public domain|archive|edition|scan|manuscript)/i.test(
    normalized
  );
}

export function isLowQualityWebCandidate(candidate: AcademicSourceCandidate) {
  const text = [candidate.title, candidate.sourceName, candidate.abstractOrSnippet, candidate.url ?? ""]
    .join(" ")
    .toLowerCase();

  return /fanqie|番茄|qidian|起点|jjwxc|晋江|webnovel|网文|爽文|无系统|穿越|盗版|聚合|content farm|营销号|ai生成/.test(
    text
  );
}

export function buildChineseTrustedSourceFailureMessage(language: "zh" | "en" = "zh") {
  return language === "en"
    ? "I tried Chinese trusted sources, but did not find enough reliable and verifiable authority."
    : "已尝试检索中文可信来源，但没有找到足够可靠、可验证的权威资料。";
}
