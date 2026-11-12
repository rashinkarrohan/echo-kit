// @echo/engine — pure TypeScript, no DOM, no network

// Types
export type * from './types';

// Schema
export { loadSchema, validateSchema } from './schema/loadSchema';
export type { ValidateOptions } from './schema/loadSchema';

// Text normalisation
export { normaliseText, numberWordsToDigits } from './text/normalise';

// Segments
export { makeSegment, assertOrdered, segmentsText, rangeOf } from './segments';

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
  matchesCue
} from './guard/index';

// Extraction
export { RulesExtractor } from './extract/rules-extractor';

// Validation
export { validateFact, validateFacts, containsPhrase, numbersIn } from './validate/validate-fact';

// Verification
export { verifyFacts } from './verify/verify';

// Gap check
export { runGapCheck } from './gap/gap-check';

// Label comparison
export { canonicalFrequency, canonicalDose, compareLabel } from './label/compare';

// Quote comparison (Echo Cover)
export { compareQuotes, quoteRecordFromFacts } from './compare/compare-quotes';

// Read-back
export { buildReadBack, applyMark, scoreReadBack, unexpectedNumbers } from './readback/readback';
