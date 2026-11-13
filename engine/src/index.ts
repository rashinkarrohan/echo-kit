// @echo/engine — pure TypeScript, no DOM, no network

// Types
export type * from "./types";

// Schema
export { loadSchema, validateSchema } from "./schema/loadSchema";
export type { ValidateOptions } from "./schema/loadSchema";

// Text normalisation
export { normaliseText, numberWordsToDigits } from "./text/normalise";

// Segments
export { makeSegment, assertOrdered, segmentsText, rangeOf } from "./segments";

// Guard (entity detection)
export {
  flagTokens,
  numberDetector,
  frequencyDetector,
  dateDetector,
  drugDetector,
  moneyDetector,
  percentDetector,
  durationDetector,
  commissionDetector,
  DETECTORS,
  DRUG_DICTIONARY,
  getDetector,
  detectorsFor,
  matchesCue,
} from "./guard/index";

// Extraction
export { RulesExtractor } from "./extract/rules-extractor";

// Validation
export { validateFact, validateFacts, containsPhrase, numbersIn } from "./validate/validate-fact";

// Verification
export { verifyFacts } from "./verify/verify";

// Gap check
export { runGapCheck } from "./gap/gap-check";

// Label comparison
export { canonicalFrequency, canonicalDose, compareLabel } from "./label/compare";

// Quote comparison (Echo Cover)
export { compareQuotes, quoteRecordFromFacts } from "./compare/compare-quotes";

// Read-back
export { buildReadBack, applyMark, scoreReadBack, unexpectedNumbers } from "./readback/readback";

// Consent ledger and local store
export {
  ConsentLedger,
  ConsentRequiredError,
  CONSENT_WORDING,
  CONSENT_WORDING_VERSION,
} from "./consent/ledger";
export type { LedgerOptions } from "./consent/ledger";
export { MemoryStore } from "./store/store";
export type { EchoStore } from "./store/store";
export { runStoreContract } from "./store/store-contract";
export type { ContractRunner, ContractSamples } from "./store/store-contract";

// Audio (pure): segmenter and resampler
export { Segmenter } from "./audio/segmenter";
export type { AudioSegment, SegmenterOptions } from "./audio/segmenter";
export { resample } from "./audio/resample";

// Speech adapters
export { MockAdapter } from "./asr/mock-adapter";
export { WhisperAdapter, cleanWhisperText, DEFAULT_WHISPER_MODEL } from "./asr/whisper-adapter";
export type {
  AsrDevice,
  AsrTransport,
  WhisperOptions,
  WorkerReply,
  WorkerRequest,
} from "./asr/whisper-adapter";

// Shared post-recording pipeline
export { runPipeline, flagSegment } from "./pipeline";
export type { PipelineOutput } from "./pipeline";

// Live session
export { ConversationSession } from "./session/session";
export type {
  SessionEvents,
  SessionErrorCode,
  SessionOptions,
  SessionState,
} from "./session/session";
export { decodeWav } from "./audio/wav";
export type { DecodedWav } from "./audio/wav";
