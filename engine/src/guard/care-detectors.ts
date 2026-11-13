/**
 * Entity detectors for Echo Care.
 * Detects: numbers, drugs, frequencies, dates
 */

import type { Segment, FlaggedToken, EntityDetector, DrugDictionary } from "../types";
import { normaliseText } from "../text/normalise";

/**
 * Calculate edit distance (Levenshtein distance) between two strings.
 */
function editDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

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

    // Match number with unit or bare number
    const pattern = new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})?\\b`, "gi");

    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      const value = match[0].trim();

      tokens.push({
        kind: "number",
        value,
        lowConfidence: hasLowConfidence(segment, value),
      });
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
 * Largest edit distance accepted for a near match. Short names allow 1; names of 8 or
 * more letters allow about 30% of their length, but only if the first letter matches
 * (speech engines usually keep the first sound). Tested against common English words.
 */
function allowedDistance(heard: string, drug: string): number {
  const longest = Math.max(heard.length, drug.length);
  if (longest < 8 || heard[0] !== drug[0]) return 1;
  return Math.floor(longest * 0.3);
}

/** Closest dictionary drug within the allowed distance, or undefined. */
function closestDrug(
  heard: string,
  drugs: readonly string[],
): { drug: string; distance: number } | undefined {
  if (!/^[a-z]{4,}$/.test(heard)) return undefined;
  let best: { drug: string; distance: number } | undefined;
  for (const drug of drugs) {
    const distance = editDistance(heard, drug);
    if (distance === 0 || distance > allowedDistance(heard, drug)) continue;
    if (!best || distance < best.distance) best = { drug, distance };
  }
  return best;
}

/**
 * Drug detector with edit distance suggestions.
 * Never auto-corrects the heard text.
 */
export const drugDetector: EntityDetector = {
  id: "drug",
  detect: (segment: Segment, dictionary?: DrugDictionary): FlaggedToken[] => {
    if (!dictionary || !dictionary.drugs) {
      return [];
    }

    const normalized = normaliseText(segment.text);
    const words = normalized.split(/\s+/);
    const tokens: FlaggedToken[] = [];
    const drugList: readonly string[] = dictionary.drugs;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Check for exact match
      if (drugList.includes(word)) {
        tokens.push({
          kind: "drug",
          value: word,
          lowConfidence: hasLowConfidence(segment, word),
        });
        continue;
      }

      // Near match on the word, or on the word joined with the next one
      // (speech engines split names: "merform in" for "metformin").
      const single = closestDrug(word, drugList);
      const next = words[i + 1];
      const joined =
        next !== undefined && /^[a-z]{2,}$/.test(next) && !drugList.includes(next)
          ? closestDrug(word + next, drugList)
          : undefined;
      const useJoined =
        joined !== undefined && (single === undefined || joined.distance < single.distance);
      const match = useJoined ? joined : single;
      if (!match) continue;

      const value = useJoined ? `${word} ${next}` : word; // the heard text, never auto-corrected
      tokens.push({
        kind: "drug",
        value,
        suggestion: match.drug,
        lowConfidence: hasLowConfidence(segment, value),
      });
      if (useJoined) i += 1;
    }

    return tokens;
  },
};
