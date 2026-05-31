import { createHash } from "node:crypto";
import {
  isRejectedSource,
  isBackgroundReferenceProvider,
  isTrustedAcademicHost,
  isTrustedAcademicProvider,
  isWikipediaLikeSource
} from "@/lib/academic-recommendations/policy";
import {
  canUseAsAcademicEvidence,
  getCandidateDisplayClass,
  SOURCE_DISPLAY_LABELS
} from "@/lib/academic-recommendations/source-policy";
import type {
  AcademicRecommendation,
  AcademicSourceCandidate,
  AcademicSourceLead,
  AcademicSourceLeadDisplayClass
} from "@/types/academic-recommendations";

const MIN_METADATA_CHARS = 36;
const THEME_ALIASES: Record<string, string[]> = {
  女性主义: ["女性主义", "feminist", "feminism", "gender", "women"],
  现代主义: ["现代主义", "modernism", "modernist", "stream of consciousness"],
  文学理论: ["文学理论", "literary theory", "narrative", "metaphor", "intertextual"],
  专名或背景语境: ["background", "context", "reference", "named entity", "biography", "history", "literary"],
  文学典故或古典语境: [
    "文学典故",
    "古典",
    "神话",
    "希腊",
    "悲剧",
    "clytemnestra",
    "agamemnon",
    "aeschylus",
    "greek tragedy",
    "classical",
    "myth",
    "allusion"
  ],
  莎士比亚: ["莎士比亚", "shakespeare", "william shakespeare", "plays", "drama", "early modern"],
  "《简·爱》": ["简·爱", "简爱", "jane eyre", "charlotte bronte", "bronte", "victorian novel"],
  "简·爱": ["简·爱", "简爱", "jane eyre", "charlotte bronte", "bronte", "victorian novel"],
  简爱: ["简·爱", "简爱", "jane eyre", "charlotte bronte", "bronte", "victorian novel"],
  历史文化语境: ["历史", "文化", "history", "historical", "culture", "class", "colonial"],
  作者生平背景: ["作者", "传记", "woolf", "author", "biography"],
  哲学或文化研究: ["哲学", "文化研究", "philosophy", "subjectivity", "identity", "cultural studies"]
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTitle(value: string) {
  return normalizeText(value).toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, " ").trim();
}

function includesAnyTheme(candidate: AcademicSourceCandidate, themes: string[]) {
  const haystack = [candidate.title, candidate.sourceName, candidate.abstractOrSnippet, candidate.authors.join(" ")]
    .join(" ")
    .toLowerCase();
  const expandedThemes = themes.flatMap((theme) => THEME_ALIASES[theme] ?? [theme]);

  return expandedThemes.some((theme) => {
    const normalizedTheme = theme.toLowerCase().trim();
    return normalizedTheme.length >= 2 && haystack.includes(normalizedTheme);
  });
}

export function hasSufficientAcademicProvenance(candidate: AcademicSourceCandidate) {
  const title = normalizeText(candidate.title);
  const sourceName = normalizeText(candidate.sourceName);
  const metadata = normalizeText(candidate.abstractOrSnippet);
  const usesEvidencePolicy = Boolean(candidate.evidenceType);

  return (
    title.length >= 4 &&
    sourceName.length >= 2 &&
    metadata.length >= MIN_METADATA_CHARS &&
    isTrustedAcademicProvider(candidate.provider) &&
    !isRejectedSource(candidate) &&
    !isBackgroundReferenceProvider(candidate.provider) &&
    !isWikipediaLikeSource(candidate) &&
    (!usesEvidencePolicy || canUseAsAcademicEvidence(candidate)) &&
    (candidate.provider === "semantic_scholar" ||
      candidate.provider === "doaj" ||
      candidate.provider === "internet_archive" ||
      candidate.provider === "mock" ||
      isTrustedAcademicHost(candidate.url))
  );
}

export function filterVerifiedAcademicCandidates(candidates: AcademicSourceCandidate[], themes: string[]) {
  const seen = new Set<string>();
  const verified: AcademicSourceCandidate[] = [];

  for (const candidate of candidates) {
    if (!hasSufficientAcademicProvenance(candidate) || !includesAnyTheme(candidate, themes)) {
      continue;
    }

    const key = candidate.externalId || candidate.url || normalizeTitle(candidate.title);
    const normalizedKey = normalizeText(key).toLowerCase();

    if (!normalizedKey || seen.has(normalizedKey)) {
      continue;
    }

    seen.add(normalizedKey);
    verified.push({
      ...candidate,
      title: normalizeText(candidate.title),
      sourceName: normalizeText(candidate.sourceName),
      abstractOrSnippet: normalizeText(candidate.abstractOrSnippet),
      authors: candidate.authors.map(normalizeText).filter(Boolean).slice(0, 5)
    });
  }

  return verified;
}

export function classifyAcademicSourceDisplay(candidate: AcademicSourceCandidate) {
  return getCandidateDisplayClass(candidate);
}

const SOURCE_LEAD_DISPLAY_CLASSES: AcademicSourceLeadDisplayClass[] = [
  "background_lead",
  "bibliography_information",
  "publication_information",
  "archive_lead"
];

function isSourceLeadDisplayClass(value: string): value is AcademicSourceLeadDisplayClass {
  return SOURCE_LEAD_DISPLAY_CLASSES.includes(value as AcademicSourceLeadDisplayClass);
}

function hasSufficientSourceLeadMetadata(candidate: AcademicSourceCandidate) {
  return Boolean(
    normalizeText(candidate.title).length >= 2 &&
      normalizeText(candidate.sourceName).length >= 2 &&
      (candidate.url || normalizeText(candidate.abstractOrSnippet).length >= 8 || candidate.year)
  );
}

export function toAcademicSourceLead(candidate: AcademicSourceCandidate): AcademicSourceLead | null {
  const displayClass = classifyAcademicSourceDisplay(candidate);

  if (!isSourceLeadDisplayClass(displayClass) || !hasSufficientSourceLeadMetadata(candidate)) {
    return null;
  }

  const idSource = candidate.externalId || candidate.url || `${candidate.provider}:${candidate.title}:${displayClass}`;
  const summary = normalizeText(candidate.abstractOrSnippet);

  return {
    id: createHash("sha1").update(idSource).digest("hex").slice(0, 16),
    displayClass,
    label: SOURCE_DISPLAY_LABELS[displayClass],
    title: normalizeText(candidate.title),
    sourceName: normalizeText(candidate.sourceName),
    summary: summary.length > 220 ? `${summary.slice(0, 220).trimEnd()}...` : summary,
    url: candidate.url,
    provider: candidate.provider,
    year: candidate.year ?? candidate.publicationYear ?? null
  };
}

export function buildAcademicSourceLeads(candidates: AcademicSourceCandidate[], maxLeads = 5) {
  const seen = new Set<string>();
  const leads: AcademicSourceLead[] = [];

  for (const candidate of candidates) {
    const lead = toAcademicSourceLead(candidate);

    if (!lead) {
      continue;
    }

    const key = `${lead.displayClass}:${lead.url || lead.title}`.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    leads.push(lead);

    if (leads.length >= maxLeads) {
      break;
    }
  }

  return leads;
}

export function toAcademicRecommendation(
  candidate: AcademicSourceCandidate,
  relationTheme: string
): AcademicRecommendation {
  const idSource = candidate.externalId || candidate.url || `${candidate.provider}:${candidate.title}`;
  const id = createHash("sha1").update(idSource).digest("hex").slice(0, 16);
  const scholarOrSource = candidate.authors.length > 0 ? candidate.authors.join(", ") : candidate.sourceName;
  const summary =
    candidate.abstractOrSnippet.length > 220
      ? `${candidate.abstractOrSnippet.slice(0, 220).trimEnd()}...`
      : candidate.abstractOrSnippet;

  return {
    id,
    title: candidate.title,
    scholarOrSource,
    sourceName: candidate.sourceName,
    summary,
    relation: `与当前文本中的「${relationTheme}」相关，可作为外部学术脉络参考。`,
    url: candidate.url,
    provider: candidate.provider,
    year: candidate.year ?? null
  };
}
