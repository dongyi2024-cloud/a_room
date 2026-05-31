## 1. Answer Parse Fallback

- [x] 1.1 Add a safe text fallback extractor for malformed grounded-answer model output.
- [x] 1.2 Keep existing strict JSON attempts before fallback.
- [x] 1.3 Return fallback answer text with an empty citation list when usable text exists.
- [x] 1.4 Return a stable insufficient-evidence answer when no usable fallback text exists.
- [x] 1.5 Log compact parse fallback metadata without exposing raw model output to users.

## 2. Tests

- [x] 2.1 Add tests for malformed model answer output degrading to fallback text.
- [x] 2.2 Add tests for malformed empty output returning insufficient evidence instead of throwing.
- [x] 2.3 Add tests proving valid JSON behavior remains unchanged.
- [x] 2.4 Add tests proving fallback citation IDs are empty and not fabricated.

## 3. Verification

- [x] 3.1 Run `npm run test:academic-recommendations`.
- [x] 3.2 Run `npx tsc --noEmit`.
- [x] 3.3 Run `npm run build`.
- [x] 3.4 Run `openspec validate harden-selection-answer-json-fallback --strict`.
