# Requirements: Echo Care (doctor and pharmacy)

Introduction: Echo Care helps older adults with unaided hearing loss, and their families, during and after a doctor visit or at the pharmacy counter. It is a phone-browser web app in `apps/echo-care/` built on the engine and UI kit.

### Requirement 1: Doctor card and consent
1. WHEN the user opens the app THE SYSTEM SHALL show the consent sheet per purpose before anything else.
2. WHEN the user opens the doctor card THE SYSTEM SHALL show a large-text notice of hearing loss, a request to face the patient and speak slowly, and a request to record.

### Requirement 2: Hearing Mode captions
1. WHEN recording THE SYSTEM SHALL show captions in large text as each segment completes.
2. THE SYSTEM SHALL highlight flagged tokens with an icon and not by colour alone.
3. THE SYSTEM SHALL show uncertainty and never present captions as certain.

### Requirement 3: Please repeat and read-back
1. WHEN the user taps Please repeat THE SYSTEM SHALL show the speaker a large-text card asking them to repeat the medicine name and dose.
2. WHEN the user starts read-back THE SYSTEM SHALL show what was heard with Right and Not right buttons and a speaker-facing view; items are confirmed only by a user action.

### Requirement 4: Receipt
1. THE SYSTEM SHALL list facts in large text (base 20 px) with a stamp per fact and the original quote beside each value.
2. THE SYSTEM SHALL give each fact a chip that plays the 5 seconds around its anchor at normal and slow speed.

### Requirement 5: Pharmacy stage and label check
1. THE SYSTEM SHALL provide a pharmacist card and reuse the recording flow with the pharmacy-counter schema.
2. WHEN the user confirms label fields THE SYSTEM SHALL flag differences from the spoken instruction without saying which is right, and SHALL NOT keep the photo unless the user opts in.

### Requirement 6: Family share
1. THE SYSTEM SHALL keep sharing off by default; the patient chooses receipt, sections and recipient.
2. THE SYSTEM SHALL export without audio by default through the share sheet and warn that a sent file cannot be recalled.

### Requirement 7: Trust and samples
1. THE SYSTEM SHALL offer a sample consult that needs no model download, and a trust page showing the latest eval numbers.

### Requirement 8: Safety and accessibility
1. THE SYSTEM SHALL show a disclaimer where text could read as advice and SHALL say it is not an interpreter.
2. THE SYSTEM SHALL meet WCAG AA, support 200% zoom and respect reduced motion.
