// Core data model for Echo Kit

/** Consent record stored per purpose */
export interface ConsentRecord {
  id: string;
  purpose: string;
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
  kind: 'number' | 'drug' | 'frequency' | 'date' | 'money' | 'percent' | 'duration' | 'commission';
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
export type Stamp = 'Answered' | 'Not discussed' | 'Unclear';

/** Validated fact extracted from transcript */
export interface Fact {
  key: string;
  fields: Record<string, string>;
  anchor: Anchor;
}

/** Checklist item definition */
export interface ChecklistItem {
  id: string;
  text: string;
  sourceUrl: string;
  verified?: boolean;
  cues?: Record<string, any>;
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
  skin: 'care' | 'cover';
  detectors: string[];
  disclaimer: string;
  facts: Array<{
    key: string;
    fields: string[];
    cues?: Record<string, any>;
  }>;
  checklist: ChecklistItem[];
  nextSteps: Array<{ label: string }>;
}

/** Read-back item for verification */
export interface ReadBackItem {
  field: string;
  heard: string;
  confirmed: boolean;
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
  field: 'medicine' | 'dose' | 'frequency';
  /** What was said, as heard */
  said: string;
  /** What is printed on the label, as confirmed by the user */
  printed: string;
  /** Anchors of every spoken fact that gave the `said` value */
  anchors: Anchor[];
}

/** Receipt: collection of facts and checklist results */
export interface Receipt {
  conversationId: string;
  schemaId: string;
  timestamp: number;
  facts: Fact[];
  checklist: ChecklistResult[];
  disclaimer: string;
  nextSteps: Array<{ label: string }>;
}

/** Quote record for comparison across conversations */
export interface QuoteRecord {
  conversationId: string;
  sellerId?: string;
  fields: Record<string, { value: string; anchor: Anchor }>;
  missing: string[];
}

/** Entity detector definition */
export interface EntityDetector {
  id: string;
  detect: (segment: Segment, dictionary?: any) => FlaggedToken[];
}

/** ASR adapter interface */
export interface AsrAdapter {
  transcribe: (audioData: ArrayBuffer) => Promise<Segment[]>;
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
