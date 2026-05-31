# academic-association-recommendations Specification

## Purpose
Provide bounded, trusted-source academic association recommendations for reading contexts that have clear literary, theoretical, historical, cultural, author-biographical, or related background value without fabricating sources or overwhelming the reader flow.
## Requirements
### Requirement: System SHALL detect academically relevant reading contexts
The system SHALL evaluate the current reading context or explicit user question before attempting academic association retrieval.

#### Scenario: The current passage contains academic extension value
- **WHEN** the current passage or selected text contains a clear literary, philosophical, historical, gender studies, cultural studies, author-biographical, or theoretical theme
- **THEN** the system marks the context as eligible for academic association retrieval

#### Scenario: The user explicitly asks for academic background
- **WHEN** the user asks for related papers, scholars, theories, background materials, or academic viewpoints for the current text
- **THEN** the system marks the request as eligible for academic association retrieval

#### Scenario: Ordinary narrative does not trigger recommendations
- **WHEN** the current passage is only ordinary narrative progression, concrete description, or emotional expression without clear academic extension value
- **THEN** the system does not attempt academic association retrieval

### Requirement: System SHALL search only trusted academic source scopes
The system SHALL restrict academic association retrieval to configured trusted academic sources and source-filtered providers.

#### Scenario: Retrieval uses approved source scopes
- **WHEN** the system performs academic association retrieval
- **THEN** it searches only approved academic sources such as Semantic Scholar, DOAJ, Internet Archive, JSTOR public pages, Project MUSE public pages, university repositories, institutional open-course pages, authoritative publisher or journal public abstract pages, or accessible CNKI public abstract pages

#### Scenario: Untrusted source is rejected
- **WHEN** a candidate source comes from an unsourced blog, marketing account, content farm, unverifiable page, unsupported AI-generated summary, or another source outside the trusted policy
- **THEN** the system rejects that candidate and does not include it in recommendations

#### Scenario: Wikipedia is not treated as primary academic evidence
- **WHEN** retrieval finds Wikipedia or similar encyclopedia material
- **THEN** the system may use it only as a background lead for finding better sources
- **AND** it does not present Wikipedia as the primary academic source for a recommendation

### Requirement: Recommendations SHALL use verified academic provenance
The system SHALL include only recommendations whose source metadata can be verified from retrieved public information.

#### Scenario: Candidate has sufficient provenance
- **WHEN** a retrieved candidate includes a verifiable title, author or scholar identity when available, source name, source URL or provider identifier, and public abstract, snippet, or metadata
- **THEN** the system may consider the candidate for recommendation ranking

#### Scenario: Candidate provenance is insufficient
- **WHEN** a retrieved candidate lacks a verifiable title, source identity, or public metadata
- **THEN** the system rejects the candidate instead of asking the model to fill missing facts

#### Scenario: Duplicate or weakly related candidates are filtered
- **WHEN** multiple candidates refer to the same work or do not clearly relate to the current text or user question
- **THEN** the system removes duplicates and excludes weakly related candidates from the final recommendation set

### Requirement: Academic recommendations SHALL be concise and tied to the current text
The system SHALL generate short academic association recommendations that explain why each source matters for the current text or question.

#### Scenario: Recommendation contains required fields
- **WHEN** the system returns an academic association recommendation
- **THEN** it includes a scholar or source identity, a paper, book, article, or course title, a source name, a short summary, and a brief relation to the current text or question

#### Scenario: Public link is available
- **WHEN** the verified source has a public URL
- **THEN** the recommendation includes that URL as an optional source link

#### Scenario: Relation to the current text is unclear
- **WHEN** the system cannot explain a clear relation between the source and the current text or question
- **THEN** it excludes that source from the final recommendations

### Requirement: System SHALL suppress recommendations when reliable sources are unavailable
The system SHALL not show an academic recommendation section unless at least one reliable, relevant, verified source is available.

#### Scenario: No reliable sources are found
- **WHEN** retrieval returns no trusted and relevant academic source candidates
- **THEN** the system returns no academic recommendation section

#### Scenario: Retrieval or provider fails
- **WHEN** trusted-source retrieval fails, times out, or is unavailable
- **THEN** the system degrades silently or with a non-blocking empty result
- **AND** it does not fabricate academic recommendations

### Requirement: System SHALL not fabricate papers, scholars, or viewpoints
The system MUST NOT invent academic titles, author names, source names, links, abstracts, or scholarly claims.

#### Scenario: Model output references an unverified source
- **WHEN** the generation step produces a source, title, scholar, or link that is not present in the verified candidate set
- **THEN** the system excludes that item from the response

#### Scenario: Verified metadata does not support a claim
- **WHEN** a generated summary or relation note makes a claim not supported by the verified candidate metadata or snippet
- **THEN** the system revises or removes that claim before showing the recommendation

### Requirement: Reader UI SHALL show academic recommendations as secondary collapsed content
The system SHALL render academic association recommendations as a collapsed or lightweight reader UI element that does not dominate the reading flow.

#### Scenario: Recommendations are available
- **WHEN** verified academic recommendations are returned for the current context
- **THEN** the reader displays them in a collapsed or lightweight academic association region

#### Scenario: Web sources are grouped before book paragraph sources
- **WHEN** verified academic recommendations and current-book paragraph citations are both returned for the same answer
- **THEN** the reader shows them in the same collapsed source region
- **AND** the web or academic source entries appear before the current-book paragraph source entries

#### Scenario: No recommendations are available
- **WHEN** the academic association result is empty
- **THEN** the reader does not render an empty academic recommendation region

#### Scenario: PC and mobile rendering
- **WHEN** the reader is used on PC or mobile
- **THEN** the academic association region remains readable, does not obscure the main text, and preserves the same recommendation content across viewport sizes

### Requirement: System SHALL generate context-aware academic search keywords
The system SHALL generate bounded academic search keywords from the current reading context before performing trusted-source academic retrieval.

#### Scenario: Named entity background question generates expanded keywords
- **WHEN** the user asks what a selected person, organization, religious group, place, historical name, or proper noun is
- **THEN** the system generates academic search keywords using the selected text, user question, current paragraph, chapter title, book title, and detected entity/background clues
- **AND** the generated keywords include contextually useful terms beyond the original selected text when such terms can be inferred safely

#### Scenario: Historical event question generates event context keywords
- **WHEN** the user asks about the background or textual relevance of a historical event, war, movement, social institution, or era
- **THEN** the system generates academic search keywords that include historical context terms, cultural context terms, and text-relation terms when applicable

#### Scenario: Literary theory question generates scholarship-oriented keywords
- **WHEN** the user asks how the current text relates to a literary, philosophical, feminist, modernist, cultural, or theoretical theme
- **THEN** the system generates academic search keywords that connect the current work, author when known, selected text, and relevant scholarly theme

#### Scenario: Author context question generates author-background keywords
- **WHEN** the user asks whether the passage relates to the author's life, period, education, group affiliation, or writing background
- **THEN** the system generates academic search keywords that combine author identity, work title, biographical context, historical context, and the user's question focus

### Requirement: Academic keyword generation SHALL return structured and bounded output
The system SHALL represent academic keyword generation as a structured result that can be validated before provider retrieval.

#### Scenario: Keyword result contains required fields
- **WHEN** the keyword generation node completes
- **THEN** it returns an intent type, original query, optional selected text, optional context excerpt, grouped keyword lists, trusted-source search scope, and fallback status

#### Scenario: Keyword intent is classified
- **WHEN** the current request is eligible for academic retrieval
- **THEN** the system classifies keyword intent as one of `named_entity_background`, `historical_event_context`, `literary_theory`, `author_context`, or `cultural_context`

#### Scenario: Keyword lists are bounded
- **WHEN** generated keywords are converted into provider retrieval queries
- **THEN** the system deduplicates keywords, removes empty or unsafe entries, and enforces configured query-count and query-length limits before search

#### Scenario: Chinese and English keyword support
- **WHEN** the selected text, paragraph, or question is in Chinese, English, or a mixture of both
- **THEN** the system may generate both Chinese and English keyword lists
- **AND** provider retrieval receives only bounded query strings derived from those validated keyword lists

### Requirement: Keyword generation SHALL be safe and non-authoritative
The system SHALL use AI-generated keywords only as search input and MUST NOT treat them as verified academic evidence.

#### Scenario: Keyword generator proposes source facts
- **WHEN** the keyword generator output includes paper titles, scholar names, URLs, source claims, or viewpoint claims that are not already verified by trusted retrieval
- **THEN** the system does not treat those fields as recommendation evidence
- **AND** final recommendations still require trusted provider candidates and provenance validation

#### Scenario: Keyword generation fails
- **WHEN** keyword generation fails, times out, returns malformed data, or produces no usable keywords
- **THEN** the system uses deterministic fallback keywords derived from the current request and detected trigger themes
- **AND** the fallback status is recorded in the keyword result

#### Scenario: No reliable sources after keyword search
- **WHEN** keyword-derived trusted-source retrieval returns no verified and relevant academic candidates
- **THEN** the system does not show an academic recommendation section
- **AND** it does not fabricate papers, scholars, viewpoints, or source links from the keyword result

### Requirement: Trusted-source retrieval SHALL use generated keywords without expanding source scope
The system SHALL pass context-aware keyword queries only to configured trusted academic retrieval providers.

#### Scenario: Provider search receives keyword-derived queries
- **WHEN** context-aware keyword generation succeeds or fallback keywords are available
- **THEN** the system converts the validated keyword groups into academic retrieval queries and passes them to the trusted provider abstraction

#### Scenario: Source policy remains unchanged
- **WHEN** keyword-derived queries are searched
- **THEN** the system searches only the trusted academic sources allowed by the academic association source policy
- **AND** it does not perform unrestricted web search

#### Scenario: Provider set remains bounded for P1
- **WHEN** the system performs P1 academic keyword retrieval
- **THEN** supported provider search remains limited to configured trusted providers and source tiers such as academic databases, bibliographic authority sources, and background reference sources

### Requirement: Trusted source policy SHALL distinguish evidence tiers
The system SHALL distinguish primary academic evidence, bibliographic authority evidence, and background reference leads when evaluating candidate sources.

#### Scenario: Primary academic source is eligible for recommendation
- **WHEN** a candidate comes from Semantic Scholar, DOAJ, JSTOR public pages, Project MUSE public pages, NSSD/NCPSDD, CNKI public abstracts, Wanfang, CQVIP, Chaoxing, a university repository, or an authoritative publisher or journal page
- **AND** it has sufficient verifiable metadata and relevance
- **THEN** the system may include it as academic recommendation evidence

#### Scenario: Bibliographic authority source is eligible as book-level authority
- **WHEN** a candidate comes from Internet Archive, National Library of China, National Library Reference Consultation Union, WorldCat, or Taiwan National New Books Information Network
- **AND** it has sufficient verifiable title, author, catalog, publication, or metadata context
- **THEN** the system may use it as bibliographic authority evidence for book-level questions

#### Scenario: Encyclopedia source is not primary academic evidence
- **WHEN** a candidate comes from Baidu Baike, Wikipedia, or similar encyclopedia material
- **THEN** the system may treat it as a background lead
- **AND** it MUST NOT present the encyclopedia page as primary academic recommendation evidence

### Requirement: Selection AI SHALL use academic retrieval as an intent-gated bounded tool for source-backed questions
The system SHALL make verified academic retrieval available to the selection AI answer generator only when the structured search intent mode is `academic_evidence`.

#### Scenario: Source-backed question is classified for academic tool use
- **WHEN** the user asks a selected-text question that explicitly requests authoritative sources, scholarly support, data support, source evidence, or reliable provenance
- **THEN** the selection workflow classifies the request with search intent mode `academic_evidence`
- **AND** it attempts full academic retrieval before answer generation within the configured academic wait budget
- **AND** the answer generator may use only verified academic recommendations returned by trusted providers as external support

#### Scenario: Ordinary reading question skips academic tool use
- **WHEN** the user asks an ordinary selected-text explanation question without academic, source-backed, background, bibliography, or authoritative-support intent
- **THEN** the selection workflow classifies the request with search intent mode `none`
- **AND** it does not invoke external source providers for that turn

#### Scenario: Background question skips full academic retrieval
- **WHEN** the user asks a selected-text named-entity or concept background question without requesting scholars, papers, research, sources, or authority support
- **THEN** the selection workflow classifies the request with search intent mode `background_lead`
- **AND** it may invoke only the fast background-lead retrieval path
- **AND** it does not invoke the full academic retrieval workflow

#### Scenario: Academic tool is bounded in the selection answer path
- **WHEN** academic retrieval is invoked from the selection AI workflow
- **THEN** the retrieval attempt is bounded by the search intent decision's wait budget so the main AI answer is not indefinitely blocked
- **AND** if no verified academic recommendation is available within the bound, the system returns no academic support instead of fabricating sources

#### Scenario: Book evidence is insufficient but verified academic sources exist
- **WHEN** the current book evidence is insufficient for a strict grounded answer
- **AND** verified academic recommendations are available for an `academic_evidence` question
- **THEN** the system may answer using the verified academic sources as external support
- **AND** it indicates that the support comes from external academic sources rather than book-local evidence

### Requirement: System SHALL normalize Chinese trusted-source candidates
The system SHALL define a normalized candidate structure for Chinese trusted-source provider outputs before validation or display.

#### Scenario: Candidate contains normalized evidence fields
- **WHEN** a Chinese trusted-source provider returns a raw result
- **THEN** the system maps the result to a normalized candidate with provider, evidence type, title, optional authors, optional source name, optional publication year, optional URL, optional abstract, optional keywords, language, confidence, and source-use permissions

#### Scenario: Candidate records display permissions
- **WHEN** a result is normalized
- **THEN** the candidate records whether it can be used as academic evidence, background lead, or bibliography

### Requirement: System SHALL classify Chinese source evidence types
The system SHALL classify each trusted-source candidate into a clear evidence type before ranking or display.

#### Scenario: Academic paper evidence
- **WHEN** a candidate is a journal article, dissertation, conference paper, or comparable scholarly paper with sufficient metadata
- **THEN** the system classifies it as `academic_paper`
- **AND** it may be eligible for academic evidence if provider policy allows it

#### Scenario: Academic book evidence
- **WHEN** a candidate is a scholarly monograph, academic edited volume, or comparable academic book with sufficient metadata
- **THEN** the system classifies it as `academic_book`
- **AND** it may be eligible for academic evidence if provider policy allows it

#### Scenario: Bibliography record evidence
- **WHEN** a candidate is a library catalog, ISBN, CIP, holdings, edition, or bibliography record
- **THEN** the system classifies it as `bibliography_record`
- **AND** it MUST NOT present the record as a scholarly viewpoint

#### Scenario: Publisher page evidence
- **WHEN** a candidate is a publisher, university press, journal, or official publication page
- **THEN** the system classifies it as `publisher_page`
- **AND** it may support publication background or book description only unless additional scholarly metadata is verified

#### Scenario: Encyclopedia lead evidence
- **WHEN** a candidate is Baidu Baike, Wikipedia, or similar encyclopedia material
- **THEN** the system classifies it as `encyclopedia_lead`
- **AND** it MUST NOT present the entry as academic paper evidence or scholar viewpoint evidence

#### Scenario: Archive record evidence
- **WHEN** a candidate is an archive, scan, edition, public-domain record, or historical document record
- **THEN** the system classifies it as `archive_record`
- **AND** it may support archive or version context but MUST NOT default to academic-paper evidence

#### Scenario: Low-quality web evidence
- **WHEN** a candidate comes from a web-fiction platform, content farm, marketing page, unverifiable page, unauthorized aggregation page, or AI-generated article without reliable provenance
- **THEN** the system classifies it as `low_quality_web`
- **AND** it filters the candidate from final output

### Requirement: System SHALL enforce source display policies
The system SHALL use source display policy to decide whether a candidate may appear as academic evidence, background lead, or bibliography.

#### Scenario: NSSD-like source policy
- **WHEN** a candidate comes from National Center for Philosophy and Social Sciences Documentation, NSSD, or a comparable Chinese social-science academic source
- **THEN** the source policy allows academic evidence only when extra verification and metadata sufficiency pass

#### Scenario: WorldCat-like source policy
- **WHEN** a candidate comes from WorldCat, National Library of China, National Library Reference Consultation Union, ISBN/CIP, or a comparable bibliography source
- **THEN** the source policy allows bibliography and background lead display
- **AND** it does not allow academic evidence display

#### Scenario: Baidu Baike or Wikipedia source policy
- **WHEN** a candidate comes from Baidu Baike, Wikipedia, or comparable encyclopedia material
- **THEN** the source policy allows background lead use only
- **AND** it does not allow academic evidence or bibliography display

#### Scenario: Internet Archive source policy
- **WHEN** a candidate comes from Internet Archive
- **THEN** the source policy allows bibliography, archive lead, or background lead display after extra verification
- **AND** it does not allow academic evidence display by default

### Requirement: System SHALL plan Chinese provider layers without unauthorized scraping
The system SHALL plan Chinese trusted-source provider layers while avoiding unauthorized scraping or protected access.

#### Scenario: Chinese social-science provider layer
- **WHEN** the system needs Chinese humanities or social-science academic sources
- **THEN** it uses a planned `ChineseSocialScienceProvider` layer for sources such as National Center for Philosophy and Social Sciences Documentation or comparable public metadata sources

#### Scenario: Chinese bibliography provider layer
- **WHEN** the system needs Chinese book identity, edition, ISBN, publication, or holdings evidence
- **THEN** it uses a planned `ChineseBibliographyProvider` layer for National Library of China, WorldCat, National Library Reference Consultation Union, ISBN/CIP, or comparable catalog sources
- **AND** it treats those results as bibliography or publication leads, not scholar viewpoints

#### Scenario: Chinese publisher provider layer
- **WHEN** the system needs publication background or official book descriptions
- **THEN** it uses a planned `ChinesePublisherProvider` layer for authoritative publishers, university presses, journal sites, or public publisher pages
- **AND** it does not automatically treat publisher pages as academic-paper evidence

#### Scenario: Encyclopedia lead provider layer
- **WHEN** the system needs background identification or keyword expansion
- **THEN** it uses a planned `EncyclopediaLeadProvider` layer for Baidu Baike, Wikipedia, and similar sources
- **AND** it does not present encyclopedia results as academic viewpoints

#### Scenario: Licensed Chinese academic provider layer
- **WHEN** the system needs CNKI, Wanfang, CQVIP, Chaoxing, or comparable licensed academic database access
- **THEN** it uses a planned `LicensedChineseAcademicProvider` layer
- **AND** it MUST NOT scrape or access licensed content without confirmed authorization and a stable technical access path

### Requirement: System SHALL downgrade Internet Archive for Chinese contemporary-book queries
The system SHALL downgrade or disable Internet Archive for Chinese contemporary-book queries unless the query context supports archival use.

#### Scenario: Chinese contemporary book query
- **WHEN** the query is about a Chinese contemporary book or a non-public-domain Chinese title
- **THEN** the system disables or heavily downgrades Internet Archive results by default

#### Scenario: Archival query
- **WHEN** the query is about a public-domain classic, historical document, rare-book scan, English original, edition history, or archive material
- **THEN** the system may use Internet Archive as an archive or bibliography lead after verification

#### Scenario: Internet Archive low-quality result
- **WHEN** an Internet Archive result appears to be from a web-fiction platform, content farm, pirated aggregation source, or unrelated low-authority fiction record
- **THEN** the system filters the candidate and does not display it

### Requirement: System SHALL validate Chinese trusted-source candidates before evidence display
The system SHALL validate every Chinese trusted-source candidate before using it as academic evidence.

#### Scenario: Candidate qualifies as academic evidence
- **WHEN** a candidate has evidence type `academic_paper` or `academic_book`
- **AND** provider policy allows academic evidence
- **AND** metadata is sufficient
- **AND** relevance to the user question or reading context is clear
- **THEN** the system may display it as academic evidence

#### Scenario: Metadata is sufficient
- **WHEN** a candidate has a title
- **AND** it has at least one of author, source institution, journal, publisher, or encyclopedia site
- **AND** it has at least one of year, URL, abstract, or keywords
- **THEN** the candidate passes the metadata sufficiency check

#### Scenario: Candidate cannot be academic evidence
- **WHEN** a candidate is a bibliography record, holdings record, publisher marketing page, catalog page, web-fiction platform result, content farm, authorless sourceless dateless web page, or AI-generated article without reliable provenance
- **THEN** the system MUST NOT display it as academic evidence

### Requirement: System SHALL degrade clearly when Chinese trusted sources fail
The system SHALL provide a clear non-fabricating failure state when Chinese trusted-source retrieval produces no verified result.

#### Scenario: Chinese trusted-source retrieval has no verified result
- **WHEN** the system has attempted Chinese trusted-source retrieval
- **AND** no candidate passes validation
- **THEN** the upper layer can state that it tried Chinese trusted sources but did not find enough reliable and verifiable authority
- **AND** it MUST NOT fabricate papers, scholars, viewpoints, catalog records, publishers, or links

### Requirement: System SHALL keep evidence display categories separate
The system SHALL not mix academic evidence, bibliography, background leads, publisher information, and archive leads in final presentation.

#### Scenario: Academic evidence display
- **WHEN** a verified candidate is an academic paper or academic book
- **THEN** the system may display it as an academic association recommendation

#### Scenario: Bibliography display
- **WHEN** a verified candidate is a bibliography or holdings record
- **THEN** the system may display it only as bibliography or publication lead information
- **AND** it MUST NOT phrase the record as a scholar viewpoint

#### Scenario: Encyclopedia display
- **WHEN** a verified candidate is an encyclopedia lead
- **THEN** the system may display it only as a background lead
- **AND** it MUST NOT display it as academic evidence

#### Scenario: Publisher display
- **WHEN** a verified candidate is a publisher page
- **THEN** the system may display it only as publication information unless additional academic evidence is verified

#### Scenario: Archive display
- **WHEN** a verified candidate is an archive record
- **THEN** the system may display it only as archive or version context unless additional academic evidence is verified

### Requirement: System SHALL provide a runtime academic search provider interface
The system SHALL define a shared runtime provider adapter interface for trusted-source academic, bibliography, encyclopedia, archive, and background-lead retrieval.

#### Scenario: Provider exposes runtime contract
- **WHEN** a runtime provider is registered
- **THEN** it exposes an identifier, display name, supported languages, supported evidence types, and a search function that returns normalized `AcademicSourceCandidate[]`

#### Scenario: Provider receives normalized query
- **WHEN** the system invokes a provider
- **THEN** it passes a normalized query containing original query, normalized query, keywords, language, intent type, and optional book, chapter, selected-text, and context-excerpt fields

#### Scenario: Provider receives runtime options
- **WHEN** the system invokes a provider
- **THEN** it may pass timeout, max results, network permission, and mock fallback options

### Requirement: System SHALL select academic providers by query context
The system SHALL select runtime providers according to query language, user intent, evidence needs, provider configuration, and source safety rules.

#### Scenario: Chinese query prioritizes Chinese-capable providers
- **WHEN** a query is Chinese or mixed-language
- **THEN** the provider registry prioritizes Chinese-capable trusted-source providers before English-only providers

#### Scenario: Background question enables encyclopedia leads
- **WHEN** a Chinese or English user question asks what a named entity, historical event, cultural term, or background concept is
- **THEN** the provider registry may enable encyclopedia lead providers
- **AND** encyclopedia results remain background leads only

#### Scenario: Research question prioritizes academic and bibliography providers
- **WHEN** a user asks for related research, scholar viewpoints, papers, or book research
- **THEN** the provider registry prioritizes academic and bibliography providers
- **AND** it MUST NOT rely on encyclopedia providers as academic evidence

#### Scenario: Internet Archive disabled for Chinese contemporary-book query
- **WHEN** the query is about a Chinese contemporary book and is not clearly archival, public-domain, edition-history, historical-document, rare-book, or English-original context
- **THEN** the provider registry does not enable Internet Archive by default

### Requirement: System SHALL isolate provider timeout and failure
The system SHALL prevent a single provider timeout, network failure, disabled credential state, or parse failure from breaking the academic recommendation workflow.

#### Scenario: Provider timeout
- **WHEN** a provider exceeds its timeout
- **THEN** the provider execution layer returns an empty result list for that provider
- **AND** other selected providers continue executing

#### Scenario: Provider network or parse failure
- **WHEN** a provider encounters a network error, invalid response, parse error, or disabled credentials
- **THEN** the provider execution layer returns an empty result list for that provider
- **AND** it records debug information without exposing internal errors to the user

#### Scenario: All providers return no verified result
- **WHEN** all selected providers return no candidates or no candidate passes validation
- **THEN** the upper layer can continue using the existing no-reliable-source failure state
- **AND** it MUST NOT fabricate sources, papers, scholars, links, or viewpoints

### Requirement: System SHALL normalize provider responses before validation
The system SHALL map every provider's raw remote response or fixture response into `AcademicSourceCandidate[]` before validation, ranking, prompt construction, or display.

#### Scenario: Raw response is not exposed upstream
- **WHEN** a provider receives a raw API response
- **THEN** the provider adapter maps it to normalized source candidates
- **AND** upstream recommendation logic receives only normalized candidates

#### Scenario: Normalized candidate keeps display permissions
- **WHEN** a provider normalizes a result
- **THEN** the candidate records evidence type, confidence, language, and whether it may be used as academic evidence, background lead, or bibliography

### Requirement: System SHALL use Wikipedia only as encyclopedia background lead
The system SHALL support a Wikipedia encyclopedia provider through the public MediaWiki Search API for Chinese and English background-lead retrieval.

#### Scenario: Chinese Wikipedia search
- **WHEN** the query language is Chinese or mixed-language and Wikipedia provider is enabled
- **THEN** the provider uses the Chinese Wikipedia MediaWiki Search API
- **AND** it returns normalized candidates with title, URL, source name, abstract or snippet, language, confidence, and background-only permissions

#### Scenario: English Wikipedia search
- **WHEN** the query language is English and Wikipedia provider is enabled
- **THEN** the provider uses the English Wikipedia MediaWiki Search API
- **AND** it returns normalized candidates with title, URL, source name, abstract or snippet, language, confidence, and background-only permissions

#### Scenario: Wikipedia result is background only
- **WHEN** Wikipedia returns a result such as Cistercian Order or 西多会
- **THEN** the normalized candidate has `evidenceType` equal to `encyclopedia_lead`
- **AND** `canUseAsBackgroundLead` is true
- **AND** `canUseAsAcademicEvidence` is false
- **AND** `canUseAsBibliography` is false

#### Scenario: Wikipedia cannot become scholar opinion
- **WHEN** the only available external result for a scholar-opinion or paper request is Wikipedia
- **THEN** the system MUST NOT generate scholar-opinion evidence or paper recommendations from that result
- **AND** it may present the result only as a background lead or report that no sufficiently reliable academic source was found

### Requirement: System SHALL treat WorldCat as credentials-gated bibliography provider
The system SHALL provide a WorldCat bibliography provider adapter skeleton that uses WorldCat Search API v2 only when configured credentials or access token are available.

#### Scenario: WorldCat credentials missing
- **WHEN** WorldCat provider is enabled but credentials or access token are not configured
- **THEN** the provider returns an empty result list without throwing
- **AND** it records a debug log

#### Scenario: WorldCat credentials configured
- **WHEN** WorldCat Search API v2 credentials or access token are configured
- **THEN** the provider may call the configured WorldCat API base URL
- **AND** it normalizes title, authors, source name, publication year, URL, language, evidence type, confidence, and display permissions

#### Scenario: WorldCat bibliography record is not academic opinion
- **WHEN** WorldCat returns a library, holdings, edition, ISBN, or bibliography record
- **THEN** the normalized candidate has `evidenceType` equal to `bibliography_record`
- **AND** `canUseAsBibliography` is true
- **AND** `canUseAsAcademicEvidence` is false
- **AND** the system MUST NOT display it as a scholar viewpoint

#### Scenario: WorldCat does not scrape web pages
- **WHEN** WorldCat credentials are absent or a WorldCat API request fails
- **THEN** the provider MUST NOT fall back to web scraping or WorldCat Search API 1.0

### Requirement: System SHALL keep sensitive Chinese providers disabled without compliant access
The system SHALL provide runtime skeletons for NSSD, Baidu Baike, and licensed Chinese academic providers without unauthorized scraping or protected access.

#### Scenario: NSSD provider skeleton
- **WHEN** NSSD or comparable Chinese social-science provider is not configured with a compliant stable access path
- **THEN** the provider returns an empty result list or explicitly configured fixture results only
- **AND** it MUST NOT bypass login, captcha, robots, rate limits, or access restrictions

#### Scenario: Baidu Baike provider skeleton
- **WHEN** Baidu Baike provider has no compliant API or controlled retrieval path configured
- **THEN** the provider returns an empty result list
- **AND** it MUST NOT use fragile page scraping
- **AND** future results MUST be encyclopedia background leads only

#### Scenario: Licensed Chinese academic provider disabled by default
- **WHEN** CNKI, Wanfang, CQVIP, Chaoxing, or similar licensed provider access is not explicitly configured
- **THEN** the provider is disabled or returns an empty result list
- **AND** it MUST NOT perform real network requests
- **AND** it MUST NOT affect other selected providers

### Requirement: System SHALL expose optional provider configuration
The system SHALL allow provider runtime behavior to be controlled by optional environment variables without requiring local credentials.

#### Scenario: Provider flags absent
- **WHEN** provider enable flags or credentials are absent
- **THEN** providers use safe defaults and do not require local configuration to run tests or build

#### Scenario: Provider timeout configured
- **WHEN** `ACADEMIC_PROVIDER_TIMEOUT_MS` is configured
- **THEN** provider execution uses that timeout unless a narrower per-call option is supplied

#### Scenario: Network disabled in tests
- **WHEN** tests run with mock providers or `allowNetwork` disabled
- **THEN** provider tests do not depend on real external network access

### Requirement: System SHALL expose validated non-academic source leads separately
The system SHALL expose trusted non-academic source leads from academic retrieval separately from academic recommendations.

#### Scenario: Background lead is available
- **WHEN** retrieval returns a validated encyclopedia lead such as Wikipedia or Baidu Baike
- **THEN** the system exposes it as a background lead
- **AND** it does not include it in academic recommendations

#### Scenario: Bibliography record is available
- **WHEN** retrieval returns a validated WorldCat, library, ISBN, CIP, or comparable bibliography record
- **THEN** the system exposes it as bibliography information
- **AND** it does not include it in academic recommendations

#### Scenario: Publisher or archive lead is available
- **WHEN** retrieval returns a validated publisher page or archive record
- **THEN** the system exposes it as publication information or archive lead according to its display class
- **AND** it does not include it in academic recommendations unless separate academic evidence exists

#### Scenario: Suppressed candidate is available
- **WHEN** retrieval returns a low-quality, untrusted, or suppressed candidate
- **THEN** the system does not expose it as a source lead or academic recommendation

### Requirement: Ask AI SHALL use source leads with evidence-safe wording
The system SHALL allow Ask AI to use background and bibliography leads only with wording that respects their evidence class.

#### Scenario: Encyclopedia lead supports explanation
- **WHEN** the user asks what a term, person, place, book, or historical event is
- **AND** a validated encyclopedia lead is available
- **THEN** Ask AI may use it as background context
- **AND** it labels or phrases it as a background lead rather than academic evidence

#### Scenario: Bibliography record supports book identity
- **WHEN** the user asks about a book and a bibliography record is available
- **THEN** Ask AI may use it for title, author, edition, publication, ISBN, or holdings context
- **AND** it MUST NOT phrase the record as a scholar viewpoint or research conclusion

#### Scenario: User asks for scholar viewpoints but only leads exist
- **WHEN** the user asks for scholar viewpoints, papers, or academic claims
- **AND** only encyclopedia, bibliography, publisher, or archive leads are available
- **THEN** Ask AI MUST NOT generate "学者认为", "学界认为", "论文指出", or paper recommendation wording from those leads
- **AND** it may state that reliable academic evidence was not found while still showing available leads under their correct labels

### Requirement: Reader UI SHALL display source lead groups in the source region
The reader UI SHALL render validated source leads in the existing source region using clear evidence-class labels.

#### Scenario: Background leads render
- **WHEN** Ask AI has one or more background leads
- **THEN** the reader source region displays them under "背景线索"
- **AND** it does not display them under "学术关联"

#### Scenario: Bibliography information renders
- **WHEN** Ask AI has one or more bibliography leads
- **THEN** the reader source region displays them under "书目信息"
- **AND** it does not display them as scholar viewpoints

#### Scenario: Multiple source groups render
- **WHEN** academic recommendations, source leads, and current-book citations are all available
- **THEN** the reader source region groups them by evidence class
- **AND** academic recommendations appear before background and bibliography leads
- **AND** external source groups appear before current-book paragraph citations

#### Scenario: No source leads are available
- **WHEN** there are no academic recommendations, no source leads, and no current-book citations
- **THEN** the reader does not render an empty source group

#### Scenario: PC and mobile source lead rendering
- **WHEN** the reader is used on PC or mobile
- **THEN** source lead groups remain readable and do not obscure the main text or Ask AI answer

### Requirement: Selection AI SHALL classify external search intent into bounded modes
The system SHALL classify selected-text AI requests into a structured external search intent before invoking external source providers.

#### Scenario: Ordinary book-local question selects no external search
- **WHEN** the user asks a simple explanation, interpretation, reflection, or "write feelings" question without requesting external background, bibliography, authority, source, research, scholar, paper, or data support
- **THEN** the search intent mode is `none`
- **AND** the system does not call external academic, bibliography, encyclopedia, or archive providers for that turn

#### Scenario: Named entity background question selects fast background mode
- **WHEN** the user asks what a selected person, organization, concept, historical term, religious group, or proper noun is
- **THEN** the search intent mode is `background_lead`
- **AND** the decision includes a short `maxWaitMs`
- **AND** the allowed providers are limited to background-lead providers

#### Scenario: Bibliography question selects bibliography mode
- **WHEN** the user asks about book identity, edition, ISBN, publication record, publisher record, library record, or catalog information
- **THEN** the search intent mode is `bibliography`
- **AND** the allowed providers are limited to bibliographic or publication metadata providers

#### Scenario: Explicit source-backed question selects academic evidence mode
- **WHEN** the user explicitly requests authoritative sources, scholar viewpoints, academic support, papers, research, source evidence, provenance, or data support
- **THEN** the search intent mode is `academic_evidence`
- **AND** the full trusted academic retrieval workflow is allowed within its configured timeout

#### Scenario: Ambiguous question defaults to no external search
- **WHEN** the user question does not clearly match a background, bibliography, or academic-evidence intent
- **THEN** the search intent mode is `none`
- **AND** the system avoids external provider latency for that turn

### Requirement: Search intent decision SHALL expose routing metadata
The system SHALL represent every selected-text AI external-search decision with auditable routing metadata.

#### Scenario: Decision contains required fields
- **WHEN** the system classifies selected-text AI search intent
- **THEN** the decision includes `mode`, `reason`, `maxWaitMs`, and `allowedProviders`

#### Scenario: Routing decision is logged
- **WHEN** the selected-text AI workflow handles a question
- **THEN** the server logs a compact debug entry with the selected mode, reason, wait budget, and allowed provider ids

### Requirement: Background search mode SHALL avoid full academic keyword generation
The system SHALL keep fast background-lead lookup separate from full academic keyword generation and academic evidence retrieval.

#### Scenario: What-is question uses fast background leads only
- **WHEN** the search intent mode is `background_lead`
- **THEN** the system may query configured background-lead providers within the fast wait budget
- **AND** it does not run the full academic keyword generation node
- **AND** it does not run the full academic recommendation workflow

#### Scenario: Background lead remains non-academic
- **WHEN** a background provider returns a verified encyclopedia or background result
- **THEN** the result may be displayed as a background lead
- **AND** it MUST NOT be displayed as a scholar viewpoint, paper recommendation, or academic conclusion

### Requirement: Bibliography search mode SHALL remain separate from academic opinions
The system SHALL handle bibliography and publication metadata searches without converting their results into academic opinions.

#### Scenario: Bibliography result displays as book metadata
- **WHEN** the search intent mode is `bibliography`
- **AND** a bibliographic provider returns a verified record
- **THEN** the result may be displayed as bibliography, publication, edition, or catalog information
- **AND** it MUST NOT be displayed as `学者认为`, `学界认为`, a paper recommendation, or an academic conclusion

#### Scenario: Bibliography provider unavailable
- **WHEN** bibliography mode is selected but configured bibliography providers are disabled, unavailable, or time out
- **THEN** the system returns no bibliography source for that turn
- **AND** answer generation continues without fabricated bibliography records

### Requirement: Background lead retrieval SHALL support bounded query rewrite fallback
The system SHALL support a bounded query rewrite fallback when a selected-text AI request is classified as `background_lead` and the first fast background lookup returns no usable background leads.

#### Scenario: First pass succeeds without rewrite
- **WHEN** a `background_lead` question returns at least one verified background lead from the first provider search
- **THEN** the system returns those leads without calling the query rewrite fallback

#### Scenario: First pass has no background lead
- **WHEN** a `background_lead` question returns no usable background lead from the first provider search
- **THEN** the system may invoke query rewrite using the selected text, user question, current paragraph, chapter title, and book title
- **AND** the rewritten terms are searched only against providers allowed for `background_lead`

#### Scenario: Translated literary name expands search terms
- **WHEN** the user asks who `苔丝狄蒙娜` is and the first background search has no usable result
- **THEN** the rewrite fallback may generate search terms such as `苔丝狄蒙娜`, `黛丝德蒙娜`, `Desdemona`, or `奥赛罗 Desdemona`
- **AND** any returned source still must pass background-lead validation before display

#### Scenario: Classical or mythological name expands safely
- **WHEN** the user asks who `克吕泰涅斯特拉` is and the first background search has no usable result
- **THEN** the rewrite fallback may generate alternate Chinese or original-language search terms such as `Clytemnestra`
- **AND** those terms are used only as search input

### Requirement: Query rewrite output SHALL be structured and non-authoritative
The system SHALL treat background query rewrite output as non-authoritative search input only.

#### Scenario: Rewrite result contains bounded search terms
- **WHEN** the query rewrite fallback succeeds
- **THEN** the result contains at most five sanitized search terms
- **AND** each term is short, deduplicated, and safe to pass to background providers

#### Scenario: Rewrite tries to produce source facts
- **WHEN** the query rewrite output includes paper titles, scholar names, URLs, citations, source metadata, factual claims, or final answer prose
- **THEN** the system ignores those fields
- **AND** it does not treat them as evidence, answer content, or displayable source information

#### Scenario: Rewrite fails or times out
- **WHEN** the query rewrite fallback fails, times out, returns malformed JSON, or produces no valid terms
- **THEN** the system falls back to deterministic search terms or returns no background leads
- **AND** it does not fabricate source leads

### Requirement: Background rewrite SHALL preserve source policy
The system SHALL preserve existing source policy and evidence-tier rules for all results found through rewritten background queries.

#### Scenario: Rewritten term finds encyclopedia result
- **WHEN** a rewritten term finds a Wikipedia, Baidu Baike, or similar encyclopedia result
- **THEN** the result may be displayed only as a background lead
- **AND** it MUST NOT be displayed as academic evidence, scholar viewpoint, or paper recommendation

#### Scenario: Rewritten term finds no verified result
- **WHEN** rewritten terms do not produce a verified background lead
- **THEN** the system returns no background lead for that turn
- **AND** the answer generator receives no fabricated external source

### Requirement: Background rewrite SHALL be observable
The system SHALL log compact routing and fallback information for background query rewrite in development/server logs.

#### Scenario: Rewrite fallback is attempted
- **WHEN** the system attempts background query rewrite
- **THEN** the logs include first-pass result count, sanitized rewrite terms, and fallback result count

#### Scenario: Rewrite fallback is skipped
- **WHEN** first-pass background lookup succeeds or the search intent mode is not `background_lead`
- **THEN** the logs indicate that rewrite was skipped or do not emit rewrite-attempt logs for that turn

### Requirement: Fast background lookup SHALL prioritize question-derived entities
Fast background lookup SHALL use a validated entity extracted from the user question as the preferred provider search term when present.

#### Scenario: Long selected text with question entity
- **WHEN** the selected text is long and the user asks `百年大战是什么`
- **THEN** the first background provider search includes `百年大战`
- **AND** it does not rely only on the full selected passage

#### Scenario: Question-derived entity finds encyclopedia lead
- **WHEN** a question-derived entity finds a Wikipedia or encyclopedia result
- **THEN** the result may be displayed only as a background lead
- **AND** it MUST NOT be displayed as academic evidence, scholar viewpoint, or paper recommendation

#### Scenario: No usable result after entity search
- **WHEN** the question-derived entity produces no verified background lead
- **THEN** the existing background query rewrite fallback may run
- **AND** failure still returns empty source leads without fabricating sources

### Requirement: Background source leads SHALL be bounded for selected-text answers
The system SHALL bound background source leads so background lookup remains fast and does not inflate the final answer prompt.

#### Scenario: Fast background path limits source leads
- **WHEN** the search intent mode is `background_lead`
- **THEN** the fast background provider path retrieves at most two background source leads

#### Scenario: Academic evidence path limits attached background leads
- **WHEN** the search intent mode is `academic_evidence`
- **THEN** any attached fast background lookup retrieves at most one background source lead

#### Scenario: Answer prompt limits non-academic source leads
- **WHEN** source leads are passed into the final answer prompt
- **THEN** the prompt includes at most two non-academic source leads
- **AND** evidence policy remains unchanged

### Requirement: Academic keyword generation SHALL preserve explicit scholarly intent
The academic keyword workflow SHALL NOT classify an explicitly scholarly or source-backed question as `named_entity_background` merely because the question contains `是什么`, `是谁`, or a similar background phrase.

#### Scenario: Scholarly support request with background phrasing
- **WHEN** the user asks `18世纪的伦敦是什么样的？需要有学术文献支撑`
- **THEN** the academic keyword workflow does not use `named_entity_background`
- **AND** it generates historical or research-oriented retrieval keywords

#### Scenario: Academic query focuses on user subject
- **WHEN** the selected text contains a different date or long book-local sentence
- **AND** the user question contains a clear topic such as `18世纪的伦敦`
- **THEN** retrieval keywords prioritize the user topic
- **AND** they do not use the long selected sentence as the primary academic query

### Requirement: Fast background lead lookup SHALL use a short timeout
Fast background lead lookup SHALL use a short default timeout suitable for the selected-text AI fast path.

#### Scenario: Background lookup default timeout
- **WHEN** fast background lead lookup runs without an explicit timeout override
- **THEN** it uses a default timeout of 1500ms

#### Scenario: Background lookup result count
- **WHEN** fast background lead lookup returns results
- **THEN** the result count remains bounded to a small number suitable for answer prompt inclusion

