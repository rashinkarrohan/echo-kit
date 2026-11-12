// Core data model for Echo Kit

/** Separate consent per purpose. `cloud` covers the optional capped proxy. */
export type ConsentPurpose = "record" | "transcribe" | "share" | "cloud";

/**
 * One entry in the append-only consent ledger. A grant and a later withdrawal are
 * two entries; the latest entry for a purpose decides.
 */
export interface ConsentRecord {
  id: string;
  purpose: ConsentPurpose;
  /** Version of the (all-party) wording the user saw */
  wordingVersion: string;
  timestamp: number;
  granted: boolean;
}

/** Word with confidence score */
export interface WordConf {
  word: string;
  confidence: number;
}

/** Audio segment with time range */
export interface Segment {
  id: string;
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  words?: WordConf[];
}

/** Token flagged by entity detector */
export interface FlaggedToken {
  kind: "number" | "drug" | "frequency" | "date" | "money" | "percent" | "duration" | "commission";
  value: string;
  canonical?: string;
  lowConfidence: boolean;
  suggestion?: string;
}

/** Anchor: quote location in transcript */
export interface Anchor {
  segmentIds: string[];
  startMs: number;
  endMs: number;
  quote: string;
}

/** Stamp for checklist item status */
export type Stamp = "Answered" | "Not discussed" | "Unclear";

/** Validated fact extracted from transcript */
export interface Fact {
  key: string;
  fields: Record<string, string>;
  anchor: Anchor;
}

/** Stamp on a fact after verification */
export type FactStamp = "heard_clearly" | "check_this";

/** A validated fact with its verification stamp */
export interface VerifiedFact extends Fact {
  stamp: FactStamp;
}

/** Checklist item definition */
export interface ChecklistItem {
  id: string;
  text: string;
  sourceUrl: string;
  verified?: boolean;
  cues?: Record<string, unknown>;
}

/** Checklist item result */
export interface ChecklistResult {
  item: ChecklistItem;
  stamp: Stamp;
  anchor?: Anchor;
}

/** Conversation schema defining facts and checklist */
export interface ConversationSchema {
  id: string;
  skin: "care" | "cover";
  detectors: string[];
  disclaimer: string;
  facts: Array<{
    key: string;
    fields: string[];
    cues?: Record<string, unknown>;
  }>;
  checklist: ChecklistItem[];
  nextSteps: Array<{ label: string }>;
}

/** The user's mark on a read-back item. Only an explicit tap changes it from "unmarked". */
export type ReadBackMark = "unmarked" | "right" | "not_right";

/** One "I heard: ..." line read back to the speaker. */
export interface ReadBackItem {
  /** Unique per fact in this receipt, e.g. "medicine-1" */
  factKey: string;
  /** Schema fact key, e.g. "medicine" */
  key: string;
  /** Heard text, e.g. "metformin, 500 milligrams, twice daily" */
  heard: string;
  /** Names to listen for in the user's answer (e.g. the medicine name) */
  names: string[];
  mark: ReadBackMark;
  anchor: Anchor;
}

/** How a spoken or typed answer compares with one read-back item. Never marks the item. */
export interface ReadBackScore {
  factKey: string;
  match: "full" | "partial" | "none";
  /** Numbers and names from the item that the answer contained */
  found: string[];
  /** Numbers and names from the item that the answer did not contain */
  missing: string[];
}

/** The three fields the user confirms from a medicine label (typed or read on device). */
export interface LabelFields {
  medicine: string;
  dose: string;
  frequency: string;
}

/**
 * A difference between what was said and what is printed.
 * Shows both values and the audio anchors; never says which one is right.
 */
export interface LabelFlag {
  field: "medicine" | "dose" | "frequency";
  /** What was said, as heard */
  said: string;
  /** What is printed on the label, as confirmed by the user */
  printed: string;
  /** Anchors of every spoken fact that gave the `said` value */
  anchors: Anchor[];
}

/** Receipt: what was said, stamped and anchored, for one conversation */
export interface Receipt {
  /** Same as the session id; deleting the session deletes the receipt */
  conversationId: string;
  schemaId: string;
  timestamp: number;
  /** Echo Cover: the seller name the user typed */
  seller?: string;
  facts: VerifiedFact[];
  checklist: ChecklistResult[];
  readBack: ReadBackItem[];
  labelFlags: LabelFlag[];
  disclaimer: string;
  nextSteps: Array<{ label: string }>;
}

/** A conversation's transcript as stored on the device (audio is stored separately, only by opt-in). */
export interface StoredSession {
  id: string;
  schemaId: string;
  createdAt: number;
  segments: Segment[];
}

/** What one seller said in one conversation, by fact key (Echo Cover). */
export interface QuoteRecord {
  conversationId: string;
  /** Name the user typed for this seller */
  seller: string;
  /** Fact key -> value as heard, with its anchor. A missing key means "Not discussed". */
  fields: Record<string, { value: string; anchor: Anchor }>;
}

/** One cell of the comparison table: a seller's value, or null for "Not discussed". */
export interface QuoteCell {
  conversationId: string;
  seller: string;
  value: string | null;
  anchor?: Anchor;
}

/** One row of the comparison table. Neutral by design: no ranking, no recommendation. */
export interface QuoteComparisonRow {
  field: string;
  cells: QuoteCell[];
  /** true when at least two sellers discussed this field and their values differ */
  differs: boolean;
}

/** Drug-name dictionary used by the drug detector */
export interface DrugDictionary {
  drugs: readonly string[];
}

/** Entity detector definition */
export interface EntityDetector {
  id: string;
  detect: (segment: Segment, dictionary?: DrugDictionary) => FlaggedToken[];
}

/** What a speech engine heard in one segment. `words` only when the engine really provides confidence. */
export interface AsrTranscript {
  text: string;
  words?: WordConf[];
}

/**
 * Speech adapter: on-device speech engines (and test doubles) sit behind this interface.
 * One call per 3 to 8 s segment of mono audio. Errors are Result values.
 */
export interface AsrAdapter {
  /** e.g. "mock" or "whisper:Xenova/whisper-tiny.en" */
  readonly id: string;
  transcribe: (samples: Float32Array, sampleRate: number) => Promise<Result<AsrTranscript>>;
}

/** Extractor interface for fact extraction */
export interface Extractor {
  extract: (segments: Segment[], schema: ConversationSchema) => RawFact[];
}

/** Unvalidated fact before anchor check */
export interface RawFact {
  key: string;
  fields: Record<string, string>;
  quote: string;
  segmentIds: string[];
}

/** Rejected fact with reason */
export interface Rejected {
  raw: RawFact;
  reason: string;
}

/** Result type for error handling without exceptions */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
