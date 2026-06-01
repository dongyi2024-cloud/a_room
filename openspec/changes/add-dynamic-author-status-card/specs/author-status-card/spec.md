## ADDED Requirements

### Requirement: Author status card uses deterministic timeMood
The system SHALL determine the author status card time period in backend code before any AI generation, and the AI MUST receive the resulting `period`, `mood`, `scene`, and `cta` as fixed input.

#### Scenario: 清晨 period is selected
- **WHEN** the effective current hour is between 05:00 and 08:59
- **THEN** the system uses `period: 清晨`, `mood: 清醒、克制、重新开始`, `scene: 窗边、薄光、刚打开的书页`, and `cta: 开始今日阅读`

#### Scenario: 上午 period is selected
- **WHEN** the effective current hour is between 09:00 and 11:59
- **THEN** the system uses `period: 上午`, `mood: 专注、理性、适合进入文本`, `scene: 书桌、笔记、逐渐展开的问题`, and `cta: 继续阅读`

#### Scenario: 中午 period is selected
- **WHEN** the effective current hour is between 12:00 and 13:59
- **THEN** the system uses `period: 中午`, `mood: 短暂停顿、从现实事务中抽身`, `scene: 午后的间隙、半页书、未完成的思考`, and `cta: 读一小段`

#### Scenario: 下午 period is selected
- **WHEN** the effective current hour is between 14:00 and 17:59
- **THEN** the system uses `period: 下午`, `mood: 缓慢、沉入、适合细读`, `scene: 斜照的光、纸面阴影、逐渐深入的句子`, and `cta: 进入阅读`

#### Scenario: 夜晚 period is selected
- **WHEN** the effective current hour is between 18:00 and 21:59
- **THEN** the system uses `period: 夜晚`, `mood: 回望、自省、适合对话`, `scene: 灯光、房间、一天之后重新面对自己`, and `cta: Ask Woolf`

#### Scenario: 深夜 period is selected
- **WHEN** the effective current hour is between 22:00 and 04:59
- **THEN** the system uses `period: 深夜`, `mood: 敏感、安静、诚实、适合写下想法`, `scene: 安静的房间、未眠的意识、压低声音的思考`, and `cta: 记录感想`

### Requirement: Author status card API returns cached dynamic content
The system SHALL provide `GET /api/author-status` for authenticated users and SHALL cache generated card content by `user_id`, `card_date`, and `time_period`.

#### Scenario: Cache miss generates card content
- **WHEN** an authenticated user requests `/api/author-status` and no cache exists for the same user, card date, and time period
- **THEN** the system determines timeMood, loads available reading context, generates or selects card content, stores the result, and returns `from_cache: false`

#### Scenario: Cache hit avoids repeated AI generation
- **WHEN** an authenticated user requests `/api/author-status` and a cache row exists for the same user, card date, and time period
- **THEN** the system returns the cached `period`, `woolf_status`, `thought_title`, `thought_body`, and `cta_hint` with `from_cache: true` without calling AI

#### Scenario: New time period can generate new card
- **WHEN** the same user enters a different time period on the same date
- **THEN** the system treats it as a different cache key and can return a newly generated card for the new period

### Requirement: Author status card uses reading context safely
The system SHALL include the current authenticated user's latest available reading context in AI input when such context exists, and MUST NOT fabricate reading records, books, chapters, highlights, or notes that were not provided by backend data.

#### Scenario: Reading context exists
- **WHEN** the user has a recent ready-book reading record
- **THEN** the AI input includes `user_id`, timeMood, `book_title`, `chapter_title` when available, `progress` when computable, and `last_read_at`

#### Scenario: Optional context is unavailable
- **WHEN** recent highlights, recent notes, chapter summary, or user memory are unavailable
- **THEN** the AI input uses empty or omitted optional fields and the generated content does not claim those records exist

#### Scenario: No reading record exists
- **WHEN** the user has no reading record
- **THEN** the API returns safe period-based default content and the homepage does not error

### Requirement: Author status card AI output keeps two distinct voices
The system SHALL accept AI-generated card content only when `woolf_status` and `thought_body` keep distinct required voices.

#### Scenario: Woolf status uses objective third person
- **WHEN** card content is generated
- **THEN** `woolf_status` is one concise sentence, starts with `她`, uses third person, does not use `我`, and does not directly advise the user

#### Scenario: Thought body uses first person Woolf voice
- **WHEN** card content is generated
- **THEN** `thought_body` uses first person Woolf-style subjective reflection, may use `我`, may raise a light question, and does not read like an AI assistant or teacher

#### Scenario: Invalid mixed voice falls back
- **WHEN** generated content makes `woolf_status` first-person, makes `thought_body` third-person, or otherwise mixes the required voices
- **THEN** the system rejects that output and returns safe fallback content for the current period

### Requirement: Author status card fails safely
The system SHALL return period-appropriate fallback content when AI generation, JSON parsing, validation, cache lookup, or cache write fails in a way that would otherwise block homepage rendering.

#### Scenario: AI generation fails
- **WHEN** the AI provider is unavailable or returns invalid output
- **THEN** `/api/author-status` returns fallback `woolf_status`, `thought_title`, `thought_body`, and `cta_hint` for the current period without crashing the homepage

#### Scenario: Cache table is unavailable
- **WHEN** the author status cache table has not been migrated in the current environment
- **THEN** `/api/author-status` still returns fallback or generated content without preventing the homepage from loading

## MODIFIED Requirements

### Requirement: Bookshelf page displays one author status card
The system SHALL display one author status card on the logged-in user's homepage when a featured ready book can be determined, and the card SHALL remain usable even when no ready book or reading context exists.

#### Scenario: Recent ready book shows author status card
- **WHEN** a logged-in user opens `/` and has a recent ready book they own
- **THEN** the homepage shows one author status card that can route to that book's reader and Ask Woolf entry

#### Scenario: No recent reading progress falls back safely
- **WHEN** a logged-in user opens `/` with ready books but no recent reading progress is available
- **THEN** the homepage shows one author status card using safe time-period fallback or newest ready-book context

#### Scenario: Unready bookshelf book does not show active author status card
- **WHEN** a logged-in user has a book that is still processing or failed
- **THEN** the homepage does not bind the author status card reading actions to that non-ready book

### Requirement: Author status card is related to the current book
The system SHALL generate author status card content using the current user's latest available reading context when available and MUST avoid unrelated generic copy when book or chapter context is available.

#### Scenario: Card uses current book context
- **WHEN** the current reading context includes a book title, chapter title, reading progress, or last reading time
- **THEN** the author status card generation input includes those fields and the returned thought can respond to that reading context

#### Scenario: Missing metadata uses safe fallback
- **WHEN** the current user lacks reading context or specific book metadata
- **THEN** the system shows a safe period-aware fallback that does not invent unsupported author, book, chapter, note, or highlight facts

### Requirement: Author status card contains required display fields
The author status card SHALL include a Woolf status sentence, a thought title, a thought body, a reading entry action, and an Ask Woolf action.

#### Scenario: Required fields are visible
- **WHEN** the author status card is rendered
- **THEN** the user can see the Woolf status sentence, thought title, thought body, reading entry action, and Ask Woolf action

### Requirement: Author status card does not fabricate real author speech
The system MUST NOT present author status card content as a verified real quote or factual statement from Virginia Woolf unless the source is explicitly verified.

#### Scenario: Interpretive copy is not shown as quotation
- **WHEN** the card displays generated status or thought text
- **THEN** the UI and API treat it as product-generated interpretive copy and do not label it as a verified quotation

### Requirement: Author status card supports reading and AI entry actions
The author status card SHALL provide an action to enter reading and an action to enter or open the existing Ask Woolf dialogue experience for the same ready book when a ready book is available.

#### Scenario: User starts reading from the card
- **WHEN** the user activates the reading action on the author status card and the card has a ready book target
- **THEN** the system opens the reader for the same book

#### Scenario: User starts AI dialogue from the card
- **WHEN** the user activates the Ask Woolf action on the author status card and the card has a ready book target
- **THEN** the system opens the AI dialogue path for the same book without switching to another book

#### Scenario: No ready book target exists
- **WHEN** the user activates a card action and no ready book target exists
- **THEN** the system routes to a safe bookshelf or upload path instead of failing

### Requirement: Author status card is responsive
The author status card SHALL render correctly on both PC and mobile homepage layouts.

#### Scenario: PC display is usable
- **WHEN** the user opens the homepage on a PC-sized viewport
- **THEN** the author status card remains readable, visually consistent with the current homepage, and its actions are reachable

#### Scenario: Mobile display is usable
- **WHEN** the user opens the homepage on a mobile-sized viewport
- **THEN** the author status card fits the screen, preserves the current visual style, and does not break homepage navigation

## REMOVED Requirements

### Requirement: Author status card preserves base book information
**Reason**: The card has moved into the homepage composition and no longer serves as a bookshelf book-detail wrapper.
**Migration**: Base book information remains available in the bookshelf and reader surfaces; the homepage card only needs dynamic Woolf status, thought, and actions.
