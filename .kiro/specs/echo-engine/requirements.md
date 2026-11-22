# Requirements: Echo Engine (the skeleton)

Introduction: the engine turns a consented spoken conversation into a checkable receipt. It is pure TypeScript with no DOM and no network. Source of truth: these specs, `engine/src/types.ts` and docs/BUILD-GUIDE.md (the planning PRD is not in the repo).

### Requirement 1: Consent
**User story:** As a user, I want to give or withdraw consent per purpose, so that nothing is recorded or shared without my agreement.
1. WHEN capture is requested THE SYSTEM SHALL require a consent record for purpose `record` before the microphone starts.
2. WHEN consent is withdrawn THE SYSTEM SHALL delete that session's audio, transcript and receipt.
3. THE SYSTEM SHALL store, per purpose, the timestamp and wording version, using all-party consent wording.

### Requirement 2: Segmented capture
1. WHEN audio is captured THE SYSTEM SHALL split it into segments of 3 to 8 seconds, cutting at the first silence of at least 300 ms after 3 seconds, otherwise at 8 seconds.
2. THE SYSTEM SHALL give each segment a stable id, start time and end time, with no overlaps.

### Requirement 3: Captions
1. WHEN a segment is transcribed THE SYSTEM SHALL emit its caption text and keep the original text for display.
2. THE SYSTEM SHALL normalise number words to digits for checking only.
3. WHERE the speech engine provides confidence THE SYSTEM SHALL pass it through; otherwise confidence is undefined and never guessed.

### Requirement 4: Entity guard
1. THE SYSTEM SHALL run the entity detectors named in the active schema on every caption.
2. WHEN a token matches a detector THE SYSTEM SHALL flag it; Care detectors: numbers with units, drug names, frequencies, dates; Cover detectors: money, percentages, durations, commission wording.
3. WHEN a flagged token has confidence below 0.6 THE SYSTEM SHALL mark it low confidence.
4. THE SYSTEM SHALL NOT replace a heard token with a suggestion.

### Requirement 5: Extraction with anchors
1. WHEN a schema is applied THE SYSTEM SHALL produce raw facts, each with a verbatim quote and segment ids.
2. THE SYSTEM SHALL provide a deterministic rules extractor; any model-based extractor is optional and sits behind the same interface.

### Requirement 6: Anchor validation
1. IF a fact's normalised quote is not a substring of the normalised transcript THEN THE SYSTEM SHALL reject the fact.
2. THE SYSTEM SHALL compute each accepted fact's anchor (segment ids, start, end).
3. THE SYSTEM SHALL implement this check in deterministic code with no model.

### Requirement 7: Verification and stamps
1. WHEN every field value appears in the fact's quote and no flagged token is low confidence THE SYSTEM SHALL stamp the fact `heard_clearly`; otherwise `check_this`.

### Requirement 8: Gap check
1. WHEN a checklist is applied THE SYSTEM SHALL mark each item `answered`, `unclear` or `not_discussed`, with anchors for answered items.
2. THE SYSTEM SHALL NOT claim a speaker avoided a question.

### Requirement 9: Receipt and storage
1. THE SYSTEM SHALL assemble a receipt of facts, checklist results, read-back items and label flags and store it locally.
2. THE SYSTEM SHALL NOT send audio or transcripts off the device.

### Requirement 10: Eval harness
1. THE SYSTEM SHALL run scripted consults through the full pipeline and report facts kept, dropped, invented and unanchored, flagged-token recall, checklist accuracy and runs.
2. IF invented or unanchored facts exceed 0 THEN THE RUN SHALL exit non-zero.

### Requirement 11: Schemas
1. THE SYSTEM SHALL load conversation schemas from YAML and reject any checklist item without a source URL.
2. THE SYSTEM SHALL reject the placeholder `TODO-SOURCE` in release builds.

### Requirement 12: Safety
1. THE SYSTEM SHALL NOT output advice, diagnosis, legal or financial opinions, dose calculations, seller rankings or recommendations.
