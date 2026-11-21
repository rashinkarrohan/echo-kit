/**
 * Entity detectors for Echo Care.
 * Detects: numbers, drugs, frequencies, dates
 */

import type { Segment, FlaggedToken, EntityDetector, DrugDictionary } from "../types";
import { normaliseText } from "../text/normalise";
import { matchDrugs, soundAlikes } from "./drug-match";

/**
 * Check if any word in the segment has low confidence (< 0.6).
 */
function hasLowConfidence(segment: Segment, value: string): boolean {
  if (!segment.words || segment.words.length === 0) {
    return false;
  }

  const normValue = normaliseText(value).toLowerCase();
  const words = normValue.split(/\s+/);

  for (const word of words) {
    const wordData = segment.words.find(
      (w) =>
        normaliseText(w.word).toLowerCase().includes(word) ||
        word.includes(normaliseText(w.word).toLowerCase()),
    );

    if (wordData && wordData.confidence < 0.6) {
      return true;
    }
  }

  return false;
}

/**
 * Number detector: digits with optional unit or bare numbers.
 * Units: mg, mcg, g, ml, units, tablet(s), capsule(s), drop(s), puff(s)
 */
export const numberDetector: EntityDetector = {
  id: "number",
  detect: (segment: Segment): FlaggedToken[] => {
    const normalized = normaliseText(segment.text);
    const tokens: FlaggedToken[] = [];

    // Pattern: digit(s) with optional decimal and optional unit
    const units = [
      "mg",
      "mcg",
      "g",
      "ml",
      "units?",
      "tablets?",
      "capsules?",
      "drops?",
      "puffs?",
      "milligrams?",
      "micrograms?",
      "millilitres?",
      "milliliters?",
      "grams?",
    ];
    const unitPattern = units.join("|");

    // A spoken range with a unit ("between 2 and 3 tablets", "1 or 2 tablets", "10 to 20 mg")
    // is one value. Taking one end of it would invent a dose (red team 12). Without a unit
    // ("in 2 to 3 weeks") the numbers stay separate.
    const num = "\\d+(?:\\.\\d+)?";
    const range = new RegExp(
      `\\b(?:between\\s+${num}\\s+and|${num}\\s+(?:to|or))\\s+${num}\\s*(?:${unitPattern})\\b`,
      "gi",
    );
    const found: Array<{ at: number; value: string }> = [];
    const covered: Array<[number, number]> = [];
    let match;
    while ((match = range.exec(normalized)) !== null) {
      covered.push([match.index, match.index + match[0].length]);
      found.push({ at: match.index, value: match[0].trim() });
    }

    // Match number with unit or bare number
    const pattern = new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})?\\b`, "gi");

    while ((match = pattern.exec(normalized)) !== null) {
      const at = match.index;
      if (covered.some(([a, b]) => at >= a && at < b)) continue;
      found.push({ at, value: match[0].trim() });
    }

    // In spoken order, so "the first dose heard" means the same as before ranges existed.
    for (const { value } of found.sort((a, b) => a.at - b.at)) {
      tokens.push({ kind: "number", value, lowConfidence: hasLowConfidence(segment, value) });
    }

    return tokens;
  },
};

/**
 * Frequency detector with canonical forms.
 */
export const frequencyDetector: EntityDetector = {
  id: "frequency",
  detect: (segment: Segment): FlaggedToken[] => {
    const normalized = normaliseText(segment.text);
    const tokens: FlaggedToken[] = [];

    const patterns = [
      // Once/twice/three/four times patterns
      { pattern: /\b(once|1 time)(\s+a)?\s+(day|daily)\b/i, canonical: "1/day" },
      { pattern: /\b(twice|2 times|two times)(\s+a)?\s+(day|daily)\b/i, canonical: "2/day" },
      { pattern: /\b(three times|3 times)(\s+a)?\s+(day|daily)\b/i, canonical: "3/day" },
      { pattern: /\b(four times|4 times)(\s+a)?\s+(day|daily)\b/i, canonical: "4/day" },

      // Every N hours
      {
        pattern: /\bevery\s+(\d+)\s+hours?\b/i,
        canonical: (match: RegExpMatchArray) => `every-${match[1]}-hours`,
      },

      // As needed
      { pattern: /\b(as needed|prn)\b/i, canonical: "prn" },

      // Food modifiers
      { pattern: /\b(after|with)\s+food\b/i, canonical: "after-food" },
      { pattern: /\bbefore\s+food\b/i, canonical: "before-food" },

      // Time of day
      { pattern: /\bin\s+the\s+morning\b/i, canonical: "morning" },
      { pattern: /\bat\s+night\b/i, canonical: "night" },
    ];

    for (const { pattern, canonical } of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        const value = match[0];
        const canonicalForm = typeof canonical === "function" ? canonical(match) : canonical;

        tokens.push({
          kind: "frequency",
          value,
          canonical: canonicalForm,
          lowConfidence: hasLowConfidence(segment, value),
        });
      }
    }

    return tokens;
  },
};

/**
 * Date detector.
 */
export const dateDetector: EntityDetector = {
  id: "date",
  detect: (segment: Segment): FlaggedToken[] => {
    const normalized = normaliseText(segment.text);
    const tokens: FlaggedToken[] = [];

    const patterns = [
      // Relative dates
      /\b(tomorrow|today)\b/i,
      /\bnext\s+(week|month|year)\b/i,
      /\bin\s+\d+\s+(days?|weeks?|months?)\b/i,
      /\b\d+\s+(days?|weeks?|months?)\s+from\s+now\b/i,

      // Weekdays
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,

      // Month names
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        const value = match[0];

        tokens.push({
          kind: "date",
          value,
          lowConfidence: hasLowConfidence(segment, value),
        });
      }
    }

    return tokens;
  },
};

/**
 * Drug detector: exact generic names, and misheard names as "sounds like" suggestions
 * (guard/drug-match.ts). Never auto-corrects the heard text. Exact names that sound like
 * another medicine carry `soundsAlike`, so the verifier stamps them Check this.
 */
export const drugDetector: EntityDetector = {
  id: "drug",
  detect: (segment: Segment, dictionary?: DrugDictionary): FlaggedToken[] => {
    if (!dictionary || !dictionary.drugs) return [];
    const words = normaliseText(segment.text)
      .split(/\s+/)
      .filter((w) => w.length > 0);
    return matchDrugs(words, dictionary.drugs).map((m) => {
      const token: FlaggedToken = {
        kind: "drug",
        value: m.heard,
        lowConfidence: hasLowConfidence(segment, m.heard),
      };
      if (m.suggestion !== undefined) token.suggestion = m.suggestion;
      if (m.unknown) token.unknownName = true;
      if (m.exact) {
        const alikes = soundAlikes(m.heard, dictionary.drugs);
        if (alikes.length > 0) token.soundsAlike = alikes;
      }
      return token;
    });
  },
};
