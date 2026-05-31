## Why

P1 already lets readers save AI answers, selected text, reflections, and dialogue summaries as private notes, while the community feed only accepts paragraph-bound reflections written directly from the reader. F34 closes that gap by letting a reader turn an already curated private note or dialogue summary into a public community reflection card after an explicit review step.

## What Changes

- Add a share-to-community flow from the personal notes page for eligible notes and dialogue summaries.
- Generate a share draft from the saved note content while keeping the full original AI dialogue private by default.
- Let the user edit, cancel, or confirm the share before anything is published.
- Publish confirmed shares into the existing paragraph-bound community reflection card feed.
- Preserve book, chapter, and paragraph bindings on the published card.
- Enforce authentication, note ownership, and source-context validation on the server.

## Capabilities

### New Capabilities
- `community-share-from-notes`: Allows owned private notes and dialogue summary notes to be reviewed, edited, and published as paragraph-bound community cards.

### Modified Capabilities
- `reflection-card-feed`: Expands the existing paragraph-bound reflection feed to accept cards published from private notes or dialogue summaries, while keeping the no-context-free-post rule.

## Impact

- Personal notes page UI: add a restrained “分享到社区” entry and confirmation/editing state.
- Reflection APIs/data layer: add a server path for creating reflection cards from owned notes, or extend the existing create path with source-note validation.
- Supabase schema/types: may need metadata fields or optional source-note linkage for reflection cards, depending on existing table shape.
- Privacy: full dialogue turn history and private note metadata must not be copied into public card content unless the user explicitly edits it into the public draft.
- Tests: add source-note sharing, ownership rejection, cancel, privacy, and community-feed visibility coverage.
