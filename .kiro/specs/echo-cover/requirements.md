# Requirements: Echo Cover (hearing-aid purchase conversations)

Introduction: Echo Cover helps the same people before a purchase. It is a distinct phone-browser app in `apps/echo-cover/` with its own look, schema, detectors, outputs and demo ending. It must never rank sellers or recommend a purchase.

### Requirement 1: Pre-purchase question card
1. BEFORE a sales conversation THE SYSTEM SHALL show a large-text card of the questions to ask, loaded from the schema checklist, each with its source link.
2. THE SYSTEM SHALL let the user tick questions during the conversation and carry the ticks into the gap check.

### Requirement 2: Recording sellers
1. THE SYSTEM SHALL let the user record two or more conversations, naming the seller for each, using the same consent flow as the engine requires.

### Requirement 3: Cover detectors
1. THE SYSTEM SHALL flag money amounts, percentages, durations and commission wording in captions.

### Requirement 4: Quote comparison
1. THE SYSTEM SHALL show confirmed fields side by side for all conversations: total price, what is included, trial and returns, financing interest and total repayment, commission disclosure.
2. THE SYSTEM SHALL show each value with its audio anchor and show Not discussed where a field is missing.
3. THE SYSTEM SHALL show differences only; it SHALL NOT rank sellers or recommend a purchase.

### Requirement 5: Gap check and confirm message
1. THE SYSTEM SHALL mark each sourced checklist item Answered, Unclear or Not discussed.
2. THE SYSTEM SHALL draft a "please confirm in writing" message listing what was promised and any items not discussed, with a copy button, and SHALL NOT send it.

### Requirement 6: Distinct product
1. THE SYSTEM SHALL use the `cover` skin (ledger and table layout, own copy) and its own demo flow, and SHALL reuse only code from `engine/` and `ui/`.

### Requirement 7: Safety and sources
1. THE SYSTEM SHALL NOT present the checklist as legal or financial advice, and every checklist item SHALL have a verified source before release. Evidence note: the strongest hearing-aid sales findings are from Australia; US applicability is unchecked.
