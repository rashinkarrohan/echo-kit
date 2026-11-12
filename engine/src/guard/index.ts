/**
 * Entity detection framework for Echo Kit.
 * Flags tokens by kind: number, drug, frequency, date, money, percent, duration, commission.
 */

import type { Segment, FlaggedToken, EntityDetector } from '../types';

/**
 * Flag tokens in a segment using the specified detectors.
 * 
 * @param segment - The segment to analyze
 * @param detectors - Array of entity detectors to apply
 * @param dictionary - Optional dictionary for detectors that need it (e.g., drug list)
 * @returns Array of flagged tokens
 */
export function flagTokens(
  segment: Segment,
  detectors: EntityDetector[],
  dictionary?: any
): FlaggedToken[] {
  const tokens: FlaggedToken[] = [];

  for (const detector of detectors) {
    const detectedTokens = detector.detect(segment, dictionary);
    tokens.push(...detectedTokens);
  }

  return tokens;
}

// Re-export Care detectors
export { numberDetector, frequencyDetector, dateDetector, drugDetector } from './care-detectors';

// Re-export Cover detectors
export { moneyDetector, percentDetector, durationDetector, commissionDetector } from './cover-detectors';
