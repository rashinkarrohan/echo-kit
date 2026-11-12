/**
 * Fact verifier for Echo Kit.
 * Assigns stamps: heard_clearly or check_this.
 * 
 * A fact gets heard_clearly if:
 * - Every field value appears in its quote (normalized)
 * - No word in the quote has low confidence (< 0.6)
 * 
 * Otherwise it gets check_this.
 */

import type { Fact, Segment, VerifiedFact } from '../types';
import { normaliseText } from '../text/normalise';
import { drugDetector } from '../guard/care-detectors';
import { DRUG_DICTIONARY } from '../guard/registry';

export type { VerifiedFact } from '../types';

/**
 * Check if any word in the segment's quote region has low confidence.
 */
function hasLowConfidenceInQuote(
  quote: string,
  segment: Segment
): boolean {
  if (!segment.words || segment.words.length === 0) {
    return false;
  }

  const normalizedQuote = normaliseText(quote).toLowerCase();
  
  // Check all words in the segment
  for (const wordData of segment.words) {
    const normalizedWord = normaliseText(wordData.word).toLowerCase();
    
    // If this word appears in the quote and has low confidence, flag it
    if (normalizedQuote.includes(normalizedWord) && wordData.confidence < 0.6) {
      return true;
    }
    
    // Also check if the original word (before normalization) appears in original quote
    const originalWord = wordData.word.toLowerCase();
    const originalQuote = quote.toLowerCase();
    if (originalQuote.includes(originalWord) && wordData.confidence < 0.6) {
      return true;
    }
  }

  return false;
}

/**
 * Verify facts and assign stamps.
 * 
 * Stamp logic:
 * - heard_clearly: all field values in quote, no low confidence
 * - check_this: otherwise
 * 
 * @param facts - Validated facts to verify
 * @param segments - All segments from conversation
 * @returns Facts with stamps assigned
 */
export function verifyFacts(
  facts: Fact[],
  segments: Segment[]
): VerifiedFact[] {
  const verified: VerifiedFact[] = [];

  for (const fact of facts) {
    let stamp: 'heard_clearly' | 'check_this' = 'heard_clearly';

    // Check 1: All field values must appear in the normalized quote
    const normalizedQuote = normaliseText(fact.anchor.quote);
    
    for (const [_key, value] of Object.entries(fact.fields)) {
      const normalizedValue = normaliseText(String(value));
      
      // Check if the value appears in the quote
      if (!normalizedQuote.includes(normalizedValue)) {
        // Value not found in quote - needs checking
        stamp = 'check_this';
        break;
      }
    }

    // Check 2: a drug name that is only a near match to the dictionary is unsure
    if (stamp === 'heard_clearly' && fact.fields['name'] !== undefined) {
      const probe: Segment = { id: 'probe', index: 0, startMs: 0, endMs: 0, text: fact.fields['name'] };
      if (drugDetector.detect(probe, DRUG_DICTIONARY).some((t) => t.suggestion !== undefined)) {
        stamp = 'check_this';
      }
    }

    // Check 3: No low confidence tokens in the quote
    if (stamp === 'heard_clearly') {
      // Check all segments referenced by this fact
      for (const segId of fact.anchor.segmentIds) {
        const segment = segments.find(s => s.id === segId);
        if (segment && hasLowConfidenceInQuote(fact.anchor.quote, segment)) {
          stamp = 'check_this';
          break;
        }
      }
    }

    verified.push({
      ...fact,
      stamp
    });
  }

  return verified;
}
