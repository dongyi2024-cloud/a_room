import type { AcademicSourceCandidate, TrustedAcademicProvider } from "@/types/academic-recommendations";

export const TRUSTED_ACADEMIC_PROVIDERS: TrustedAcademicProvider[] = [
  "semantic_scholar",
  "doaj",
  "internet_archive",
  "jstor",
  "project_muse",
  "cnki_public",
  "wanfang_public",
  "cqvip_public",
  "chaoxing_public",
  "nssd",
  "ncpssd",
  "national_library",
  "library_reference",
  "worldcat",
  "taiwan_new_books",
  "baidu_baike",
  "wikipedia",
  "university_repository",
  "publisher_or_journal",
  "mock"
];

export const PRIMARY_ACADEMIC_PROVIDERS: TrustedAcademicProvider[] = [
  "semantic_scholar",
  "doaj",
  "jstor",
  "project_muse",
  "cnki_public",
  "wanfang_public",
  "cqvip_public",
  "chaoxing_public",
  "nssd",
  "ncpssd",
  "university_repository",
  "publisher_or_journal",
  "mock"
];

export const BIBLIOGRAPHIC_AUTHORITY_PROVIDERS: TrustedAcademicProvider[] = [
  "internet_archive",
  "national_library",
  "library_reference",
  "worldcat",
  "taiwan_new_books"
];

export const BACKGROUND_REFERENCE_PROVIDERS: TrustedAcademicProvider[] = ["baidu_baike", "wikipedia"];

const TRUSTED_HOST_SUFFIXES = [
  "semanticscholar.org",
  "api.semanticscholar.org",
  "doaj.org",
  "archive.org",
  "worldcat.org",
  "jstor.org",
  "muse.jhu.edu",
  "cnki.net",
  "cnki.com.cn",
  "wanfangdata.com.cn",
  "cqvip.com",
  "chaoxing.com",
  "duxiu.com",
  "nssd.cn",
  "ncpssd.org",
  "ncpssd.cn",
  "nlc.cn",
  "ucdrs.superlib.net",
  "isbn.ncl.edu.tw",
  "ncl.edu.tw",
  "baike.baidu.com",
  "wikipedia.org",
  "cambridge.org",
  "oup.com",
  "oxfordacademic.com",
  "tandfonline.com",
  "springer.com",
  "link.springer.com",
  "wiley.com",
  "sagepub.com",
  "journals.uchicago.edu",
  "degruyter.com",
  "mitpressjournals.org",
  "openedition.org",
  "hdl.handle.net",
  "repo",
  "repository",
  "institutionalrepository"
];

const REJECTED_HOST_HINTS = [
  "medium.com",
  "substack.com",
  "blogspot.",
  "wordpress.",
  "zhihu.com",
  "toutiao.com",
  "sohu.com",
  "baijiahao.baidu.com",
  "weixin.qq.com",
  "quora.com",
  "reddit.com"
];

export function normalizeAcademicHost(url: string | null) {
  if (!url) {
    return "";
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isTrustedAcademicProvider(provider: string): provider is TrustedAcademicProvider {
  return TRUSTED_ACADEMIC_PROVIDERS.includes(provider as TrustedAcademicProvider);
}

export function isPrimaryAcademicProvider(provider: TrustedAcademicProvider) {
  return PRIMARY_ACADEMIC_PROVIDERS.includes(provider);
}

export function isBibliographicAuthorityProvider(provider: TrustedAcademicProvider) {
  return BIBLIOGRAPHIC_AUTHORITY_PROVIDERS.includes(provider);
}

export function isBackgroundReferenceProvider(provider: TrustedAcademicProvider) {
  return BACKGROUND_REFERENCE_PROVIDERS.includes(provider);
}

export function isTrustedAcademicHost(url: string | null) {
  const host = normalizeAcademicHost(url);

  if (!host) {
    return false;
  }

  if (REJECTED_HOST_HINTS.some((hint) => host.includes(hint))) {
    return false;
  }

  if (host.endsWith(".edu") || host.endsWith(".ac.uk") || host.endsWith(".edu.cn")) {
    return true;
  }

  return TRUSTED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`) || host.includes(suffix));
}

export function isWikipediaLikeSource(candidate: AcademicSourceCandidate) {
  const host = normalizeAcademicHost(candidate.url);
  const sourceName = candidate.sourceName.toLowerCase();
  return (
    host.includes("wikipedia.org") ||
    host.includes("baike.baidu.com") ||
    sourceName.includes("wikipedia") ||
    sourceName.includes("百度百科")
  );
}

export function isRejectedSource(candidate: AcademicSourceCandidate) {
  const host = normalizeAcademicHost(candidate.url);
  const sourceName = candidate.sourceName.toLowerCase();

  return (
    REJECTED_HOST_HINTS.some((hint) => host.includes(hint)) ||
    sourceName.includes("blog") ||
    sourceName.includes("marketing") ||
    sourceName.includes("content farm")
  );
}
