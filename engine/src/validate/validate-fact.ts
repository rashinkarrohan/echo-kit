/**
 * Anchor validator for Echo Kit.
 * Implements the core "no anchor, no claim" guarantee in plain deterministic code.
 *
 * A fact is accepted only if:
 * - its quote is non-empty and, after normalisation, a whole-word substring of the
 *   normalised text of the segments it points at (and so of the transcript);
 * - those segments exist and are contiguous;
 * - every number in its fields appears as a whole number in its normalised quote (PB5).
 */

import type { RawFact, Fact, Rejected, Segment, Anchor } from '../types';
import { normaliseText } from '../text/normalise';
import { rangeOf } from '../segments';

/** Whole-word containment on normalised text: "5" never matches inside "500". */
export function containsPhrase(normalisedHaystack: string, normalisedNeedle: string): boolean {
  if (normalisedNeedle.length === 0) return false;
  return ` ${normalisedHaystack} `.includes(` ${normalisedNeedle} `);
}

/** Numbers (integers or decimals) in a normalised string. */
export function numbersIn(normalised: string): string[] {
  return normalised.match(/\d+(?:\.\d+)?/g) ?? [];
}

function reject(raw: RawFact, reason: string): { ok: false; error: Rejected } {
  return { ok: false, error: { raw, reason } };
}

/**
 * Validate a raw fact against the conversation's segments.
 *
 * Properties: PB1 anchor soundness, PB2 no anchor no claim, PB3 noise invariance,
 * PB4 idempotence, PB5 numeric faithfulness.
 */
export function validateFact(
  raw: RawFact,
  segments: Segment[]
): { ok: true; value: Fact } | { ok: false; error: Rejected } {
  const normalisedQuote = normaliseText(raw.quote);
  if (normalisedQuote.length === 0) {
    return reject(raw, 'Quote is empty');
  }
  if (raw.segmentIds.length === 0) {
    return reject(raw, 'Fact has no segment ids');
  }

  // Segments must exist and be contiguous, in order.
  const indices: number[] = [];
  for (const segId of raw.segmentIds) {
    const idx = segments.findIndex((s) => s.id === segId);
    if (idx < 0) {
      return reject(raw, `Segment ${segId} not found`);
    }
    indices.push(idx);
  }
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) {
      return reject(raw, `Segments are not contiguous: ${raw.segmentIds.join(', ')}`);
    }
  }

  // The quote must be in the whole transcript and in the segments it points at.
  const normalisedTranscript = normaliseText(segments.map((s) => s.text).join(' '));
  if (!containsPhrase(normalisedTranscript, normalisedQuote)) {
    return reject(raw, `Quote not found in transcript. Quote: "${normalisedQuote}"`);
  }
  const referenced = indices.map((i) => segments[i]);
  const normalisedReferenced = normaliseText(referenced.map((s) => s.text).join(' '));
  if (!containsPhrase(normalisedReferenced, normalisedQuote)) {
    return reject(raw, `Quote not found in the referenced segments ${raw.segmentIds.join(', ')}`);
  }

  // PB5: every number in the fields must appear in the quote.
  const quoteNumbers = new Set(numbersIn(normalisedQuote));
  for (const [field, value] of Object.entries(raw.fields)) {
    for (const n of numbersIn(normaliseText(String(value)))) {
      if (!quoteNumbers.has(n)) {
        return reject(raw, `Field "${field}" has number ${n} that is not in the quote`);
      }
    }
  }

  const rangeResult = rangeOf(raw.segmentIds, segments);
  if (!rangeResult.ok) {
    return reject(raw, `Invalid segment range: ${rangeResult.error}`);
  }

  const anchor: Anchor = {
    segmentIds: [...raw.segmentIds],
    startMs: rangeResult.value.startMs,
    endMs: rangeResult.value.endMs,
    quote: raw.quote, // original wording, verbatim, for display
  };

  return {
    ok: true,
    value: { key: raw.key, fields: { ...raw.fields }, anchor },
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
