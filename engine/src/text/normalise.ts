/**
 * Text normalisation for Echo Kit.
 * Converts number words to digits, lowercases, removes punctuation (except %, ., $, £, €),
 * and collapses whitespace. Used for fact checking and entity detection.
 */

const DIGIT_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS_WORDS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/**
 * Convert number words to digits in text.
 * Handles 0-19, tens (20-90), hundreds, thousands, and "half".
 * Never merges "fifty" and "fifteen" - they remain distinct.
 */
export function numberWordsToDigits(text: string): string {
  let result = text;

  // Handle "half" -> 0.5
  result = result.replace(/\bhalf\b/gi, '0.5');

  // Handle "a hundred" -> 100, "a thousand" -> 1000
  result = result.replace(/\ba\s+hundred\b/gi, '100');
  result = result.replace(/\ba\s+thousand\b/gi, '1000');

  // Handle compound numbers with hundred/thousand
  // e.g., "five hundred" -> "500", "two thousand" -> "2000"
  for (const [word, value] of Object.entries(DIGIT_WORDS)) {
    const pattern = new RegExp(`\\b${word}\\s+hundred\\b`, 'gi');
    result = result.replace(pattern, String(value * 100));
    
    const thousandPattern = new RegExp(`\\b${word}\\s+thousand\\b`, 'gi');
    result = result.replace(thousandPattern, String(value * 1000));
  }
  
  for (const [word, value] of Object.entries(TENS_WORDS)) {
    const pattern = new RegExp(`\\b${word}\\s+thousand\\b`, 'gi');
    result = result.replace(pattern, String(value * 1000));
  }

  // Handle "hundred and <number>" patterns (e.g., "a hundred and twenty" -> "120")
  // Must happen before standalone replacements
  // Also handle cases where "and" connects adjacent numbers
  result = result.replace(/\b(\d+)\s+and\s+(\d+)\b/gi, (_, first, second) => {
    return String(parseInt(first, 10) + parseInt(second, 10));
  });

  // Handle standalone "hundred" (if any remain)
  result = result.replace(/\bhundred\b/gi, '100');
  result = result.replace(/\bthousand\b/gi, '1000');

  // Handle compound tens + digits (e.g., "twenty five" -> "25")
  for (const [tensWord, tensValue] of Object.entries(TENS_WORDS)) {
    for (const [digitWord, digitValue] of Object.entries(DIGIT_WORDS)) {
      if (digitValue === 0) continue; // Skip zero in compounds
      const pattern = new RegExp(`\\b${tensWord}\\s+${digitWord}\\b`, 'gi');
      result = result.replace(pattern, String(tensValue + digitValue));
    }
  }

  // Handle standalone tens (e.g., "twenty" -> "20")
  for (const [word, value] of Object.entries(TENS_WORDS)) {
    const pattern = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(pattern, String(value));
  }

  // Handle standalone digits and teens (e.g., "five" -> "5", "fifteen" -> "15")
  for (const [word, value] of Object.entries(DIGIT_WORDS)) {
    const pattern = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(pattern, String(value));
  }

  return result;
}

/**
 * Normalise text for entity detection and fact checking.
 * 
 * Process:
 * 1. Lowercase
 * 2. Convert number words to digits (handles "and" between numbers)
 * 3. Remove punctuation except %, ., $, £, €
 * 4. Collapse whitespace
 * 
 * Idempotent: normalising a normalised string returns it unchanged.
 */
export function normaliseText(text: string): string {
  // Step 1: Lowercase
  let result = text.toLowerCase();

  // Step 2: Convert number words to digits
  result = numberWordsToDigits(result);
  
  // Step 2.5: Handle any remaining "N and M" patterns (in case they weren't caught)
  result = result.replace(/\b(\d+)\s+and\s+(\d+)\b/gi, (_, first, second) => {
    return String(parseInt(first, 10) + parseInt(second, 10));
  });

  // Step 3: Remove punctuation except %, ., $, £, € and digits
  // Keep: alphanumeric, spaces, %, ., $, £, €
  result = result.replace(/[^a-z0-9\s%.£€$]+/g, '');

  // Step 3.5: Remove periods that are not part of decimals (i.e., not between digits)
  result = result.replace(/\.(?!\d)/g, ''); // Remove . not followed by digit
  result = result.replace(/(?<!\d)\./g, ''); // Remove . not preceded by digit

  // Step 4: Collapse whitespace
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}
