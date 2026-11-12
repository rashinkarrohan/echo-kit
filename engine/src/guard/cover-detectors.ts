/**
 * Entity detectors for Echo Cover.
 * Detects: money, percent, duration, commission
 */

import type { Segment, FlaggedToken, EntityDetector } from "../types";
import { normaliseText } from "../text/normalise";

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
 * Money detector: currency symbols or words with amounts.
 * Currencies: dollar(s), pound(s), euro(s), rupee(s), $, £, €
 * Also detects "per month", "a month", "monthly" patterns
 */
export const moneyDetector: EntityDetector = {
  id: "money",
  detect: (segment: Segment): FlaggedToken[] => {
    const normalized = normaliseText(segment.text);
    const tokens: FlaggedToken[] = [];

    // Pattern 1: Currency symbols with amounts: $100, £200, €300
    // Note: normalisation preserves $, £, € symbols
    const symbolPattern = /\b([$£€])\s*(\d+(?:\.\d+)?)\b/gi;
    let match;
    while ((match = symbolPattern.exec(normalized)) !== null) {
      const value = match[0].trim();
      tokens.push({
        kind: "money",
        value,
        lowConfidence: hasLowConfidence(segment, value),
      });
    }

    // Also check for standalone amounts with currency symbols (without word boundary before)
    const symbolPattern2 = /([$£€])\s*(\d+(?:\.\d+)?)\b/gi;
    while ((match = symbolPattern2.exec(normalized)) !== null) {
      const value = match[0].trim();
      // Only add if not already found
      if (!tokens.some((t) => t.value === value)) {
        tokens.push({
          kind: "money",
          value,
          lowConfidence: hasLowConfidence(segment, value),
        });
      }
    }

    // Pattern 2: Amount with currency words: 100 dollars, 500 pounds, 1000 rupees
    // Also handle reversed order: rupees 1000
    const wordPattern = /\b(\d+(?:\.\d+)?)\s+(dollars?|pounds?|euros?|rupees?)\b/gi;
    while ((match = wordPattern.exec(normalized)) !== null) {
      const value = match[0].trim();
      tokens.push({
        kind: "money",
        value,
        lowConfidence: hasLowConfidence(segment, value),
      });
    }

    // Pattern 3: Reversed order - currency word before amount: rupees 1000
    const reversedPattern = /\b(dollars?|pounds?|euros?|rupees?)\s+(\d+(?:\.\d+)?)\b/gi;
    while ((match = reversedPattern.exec(normalized)) !== null) {
      const value = match[0].trim();
      tokens.push({
        kind: "money",
        value,
        lowConfidence: hasLowConfidence(segment, value),
      });
    }

    return tokens;
  },
};

/**
 * Percent detector: %, "percent", "per cent".
 */
export const percentDetector: EntityDetector = {
  id: "percent",
  detect: (segment: Segment): FlaggedToken[] => {
    const normalized = normaliseText(segment.text);
    const tokens: FlaggedToken[] = [];

    // Pattern 1: Number with % symbol: 12%
    // Note: normalisation preserves % symbol
    const symbolPattern = /(\d+(?:\.\d+)?)\s*%/gi;
    let match;
    while ((match = symbolPattern.exec(normalized)) !== null) {
      const value = match[0].trim();
      tokens.push({
        kind: "percent",
        value,
        lowConfidence: hasLowConfidence(segment, value),
      });
    }

    // Pattern 2: Number with "percent" or "per cent": 12 percent, 5.5 per cent
    const wordPattern = /\b(\d+(?:\.\d+)?)\s+(percent|per\s+cent)\b/gi;
    while ((match = wordPattern.exec(normalized)) !== null) {
      const value = match[0].trim();
      tokens.push({
        kind: "percent",
        value,
        lowConfidence: hasLowConfidence(segment, value),
      });
    }

    return tokens;
  },
};

/**
 * Duration detector: N + days/weeks/months/years, or keywords like "trial period", "warranty".
 */
export const durationDetector: EntityDetector = {
  id: "duration",
  detect: (segment: Segment): FlaggedToken[] => {
    const normalized = normaliseText(segment.text);
    const tokens: FlaggedToken[] = [];

    // Pattern 1: Number + time unit: 30 days, 2 weeks, 3 years
    const numberPattern = /\b(\d+)\s+(days?|weeks?|months?|years?)\b/gi;
    let match;
    while ((match = numberPattern.exec(normalized)) !== null) {
      const value = match[0].trim();
      tokens.push({
        kind: "duration",
        value,
        lowConfidence: hasLowConfidence(segment, value),
      });
    }

    // Pattern 2: Keywords: trial period, return period, warranty
    const keywordPattern = /\b(trial\s+period|return\s+period|warranty)\b/gi;
    while ((match = keywordPattern.exec(normalized)) !== null) {
      const value = match[0].trim();
      tokens.push({
        kind: "duration",
        value,
        lowConfidence: hasLowConfidence(segment, value),
      });
    }

    return tokens;
  },
};

/**
 * Commission detector: flags commission-related words.
 * Words: commission, incentive, bonus, "paid per sale", kickback
 *
 * Note: The detector flags the word; the user decides what it means.
 * This includes negative contexts like "no commission".
 */
export const commissionDetector: EntityDetector = {
  id: "commission",
  detect: (segment: Segment): FlaggedToken[] => {
    const normalized = normaliseText(segment.text);
    const tokens: FlaggedToken[] = [];

    const patterns = [
      /\bcommissions?\b/i,
      /\bincentives?\b/i,
      /\bbonus(?:es)?\b/i,
      /\bpaid\s+per\s+sale\b/i,
      /\bkickbacks?\b/i,
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        const value = match[0];
        tokens.push({
          kind: "commission",
          value,
          lowConfidence: hasLowConfidence(segment, value),
        });
      }
    }

    return tokens;
  },
};
