/**
 * Anchor validator for Echo Kit.
 * Implements the core "no anchor, no claim" guarantee.
 * 
 * A fact is only accepted if its quote is a verbatim substring of the transcript.
 */

import type { RawFact, Fact, Rejected, Segment, Anchor } from '../types';
import { normaliseText } from '../text/normalise';
import { rangeOf } from '../segments';

/**
 * Validate a raw fact by checking that its quote appears verbatim in the transcript.
 * 
 * Process:
 * 1. Normalize both the quote and transcript
 * 2. Check quote is substring of transcript
 * 3. Compute anchor (segment IDs, time range)
 * 4. Verify segments exist and are valid
 * 
 * Properties guaranteed:
 * - PB1: Anchor soundness - quote occurs in transcript
 * - PB2: No-anchor-no-claim - altering quote invalidates fact
 * - PB3: Noise invariance - filler words don't affect validation
 * - PB4: Idempotence - same input gives same output
 * - PB5: Numeric faithfulness - numbers in quote match transcript
 * 
 * @param raw - Raw fact to validate
 * @param segments - All segments from the conversation
 * @returns Validated Fact or Rejected with reason
 */
export function validateFact(
  raw: RawFact,
  segments: Segment[]
): { ok: true; value: Fact } | { ok: false; error: Rejected } {
  // Normalize the quote and build full transcript
  const normalizedQuote = normaliseText(raw.quote);
  const fullTranscript = segments.map(s => s.text).join(' ');
  const normalizedTranscript = normaliseText(fullTranscript);

  // Check 1: Quote must be a substring of the normalized transcript
  if (!normalizedTranscript.includes(normalizedQuote)) {
    return {
      ok: false,
      error: {
        raw,
        reason: `Quote not found in transcript. Quote: "${normalizedQuote}"`
      }
    };
  }

  // Check 2: Verify all segment IDs exist
  const referencedSegments: Segment[] = [];
  for (const segId of raw.segmentIds) {
    const segment = segments.find(s => s.id === segId);
    if (!segment) {
      return {
        ok: false,
        error: {
          raw,
          reason: `Segment ${segId} not found`
        }
      };
    }
    referencedSegments.push(segment);
  }

  // Check 3: Compute time range
  const rangeResult = rangeOf(raw.segmentIds, segments);
  if (!rangeResult.ok) {
    return {
      ok: false,
      error: {
        raw,
        reason: `Invalid segment range: ${rangeResult.error}`
      }
    };
  }

  // Build the anchor
  const anchor: Anchor = {
    segmentIds: raw.segmentIds,
    startMs: rangeResult.value.startMs,
    endMs: rangeResult.value.endMs,
    quote: normalizedQuote // Store normalized quote for checking
  };

  // Create validated fact
  const fact: Fact = {
    key: raw.key,
    fields: raw.fields,
    anchor
  };

  return {
    ok: true,
    value: fact
  };
}

/**
 * Validate multiple facts, returning accepted and rejected separately.
 */
export function validateFacts(
  rawFacts: RawFact[],
  segments: Segment[]
): { accepted: Fact[]; rejected: Rejected[] } {
  const accepted: Fact[] = [];
  const rejected: Rejected[] = [];

  for (const raw of rawFacts) {
    const result = validateFact(raw, segments);
    
    if (result.ok) {
      accepted.push(result.value);
    } else {
      rejected.push(result.error);
    }
  }

  return { accepted, rejected };
}
