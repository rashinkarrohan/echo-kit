/**
 * Text normalisation for Echo Kit.
 * Lowercases, removes punctuation (except %, ., $, £, € and digits), collapses
 * whitespace and converts spoken number words to digits. Used only for checking;
 * the original text is kept elsewhere for display.
 */

const UNIT_WORDS: Record<string, number> = {
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

type Kind = "unit" | "tens" | "hundred" | "thousand" | "and" | "a" | "half" | "other";

interface Item {
  lower: string;
  start: number;
  end: number;
  /** true when only whitespace (or a hyphen inside one word) separates it from the previous item */
  joinable: boolean;
}

function kindOf(word: string): Kind {
  if (word in UNIT_WORDS) return "unit";
  if (word in TENS_WORDS) return "tens";
  if (word === "hundred") return "hundred";
  if (word === "thousand") return "thousand";
  if (word === "and") return "and";
  if (word === "a") return "a";
  if (word === "half") return "half";
  return "other";
}

function isNumberKind(k: Kind): boolean {
  return k === "unit" || k === "tens" || k === "hundred" || k === "thousand";
}

function tokenise(text: string): Item[] {
  const items: Item[] = [];
  const wordRe = /[A-Za-z]+(?:-[A-Za-z]+)*/g;
  let prevEnd = -1;
  let match: RegExpExecArray | null;
  while ((match = wordRe.exec(text)) !== null) {
    const start = match.index;
    const gap = prevEnd < 0 ? "" : text.slice(prevEnd, start);
    const joinable = prevEnd >= 0 && /^\s+$/.test(gap);
    const parts = match[0].split("-");
    const allNumberParts =
      parts.length > 1 && parts.every((p) => isNumberKind(kindOf(p.toLowerCase())));
    if (allNumberParts) {
      // "twenty-five": parts share the span of the whole word.
      parts.forEach((p, idx) => {
        items.push({
          lower: p.toLowerCase(),
          start,
          end: start + match![0].length,
          joinable: idx === 0 ? joinable : true,
        });
      });
    } else {
      items.push({ lower: match[0].toLowerCase(), start, end: start + match[0].length, joinable });
    }
    prevEnd = start + match[0].length;
  }
  return items;
}

/**
 * Parse one run of number words starting at index i.
 * Only grammatical English number phrases are combined; anything else ends the run,
 * so "fifty fifteen" stays "50 15" and "one and two" stays "1 and 2".
 */
function parseRun(items: Item[], i: number): { value: number; last: number } {
  let total = 0;
  let hundreds = 0;
  let tens = 0;
  let unit = -1;
  let hasHundreds = false;
  let hasThousand = false;
  let lastKind: Kind = "other";
  let last = i - 1;

  for (let j = i; j < items.length; j++) {
    const item = items[j];
    if (j > i && !item.joinable) break;
    const k = kindOf(item.lower);
    const next = items[j + 1];
    const nextKind = next && next.joinable ? kindOf(next.lower) : "other";

    if (k === "a") {
      if (j !== i || (nextKind !== "hundred" && nextKind !== "thousand")) break;
      unit = 1;
    } else if (k === "unit") {
      const v = UNIT_WORDS[item.lower];
      if (unit !== -1) break;
      if (tens > 0 && (v >= 10 || v === 0)) break;
      if ((hasHundreds || hasThousand) && v === 0) break;
      unit = v;
    } else if (k === "tens") {
      if (tens > 0 || unit !== -1) break;
      tens = TENS_WORDS[item.lower];
    } else if (k === "hundred") {
      if (hasHundreds || tens > 0 || unit === 0) break;
      hundreds = (unit === -1 ? 1 : unit) * 100;
      unit = -1;
      hasHundreds = true;
    } else if (k === "thousand") {
      if (hasThousand || unit === 0) break;
      const chunk = hundreds + tens + Math.max(unit, 0);
      total = (chunk === 0 ? 1 : chunk) * 1000;
      hundreds = 0;
      tens = 0;
      unit = -1;
      hasHundreds = false;
      hasThousand = true;
    } else if (k === "and") {
      if (lastKind !== "hundred" && lastKind !== "thousand") break;
      if (nextKind !== "unit" && nextKind !== "tens") break;
    } else {
      break;
    }
    lastKind = k;
    last = j;
  }

  return { value: total + hundreds + tens + Math.max(unit, 0), last };
}

/**
 * Convert number words to digits in text.
 * Handles 0-19, tens, hundreds, thousands, "a hundred", "a thousand" and "half" (0.5).
 * Never merges "fifty" and "fifteen", and never adds numbers that are only joined by "and".
 * Digits that are already present are left unchanged.
 */
export function numberWordsToDigits(text: string): string {
  const items = tokenise(text);
  const replacements: Array<{ start: number; end: number; value: string }> = [];

  let i = 0;
  while (i < items.length) {
    const k = kindOf(items[i].lower);
    const next = items[i + 1];
    const startsWithA =
      k === "a" &&
      next !== undefined &&
      next.joinable &&
      ["hundred", "thousand"].includes(kindOf(next.lower));

    if (k === "half") {
      replacements.push({ start: items[i].start, end: items[i].end, value: "0.5" });
      i += 1;
    } else if (isNumberKind(k) || startsWithA) {
      const { value, last } = parseRun(items, i);
      replacements.push({ start: items[i].start, end: items[last].end, value: String(value) });
      i = last + 1;
    } else {
      i += 1;
    }
  }

  let result = "";
  let cursor = 0;
  for (const r of replacements) {
    if (r.start < cursor) continue; // parts of one hyphenated word share a span
    result += text.slice(cursor, r.start) + r.value;
    cursor = r.end;
  }
  return result + text.slice(cursor);
}

/**
 * Normalise text for entity detection and fact checking.
 *
 * Process:
 * 1. Lowercase
 * 2. Hyphens and dashes become spaces ("follow-up" -> "follow up")
 * 3. Remove punctuation except %, ., $, £, € (periods are kept only inside decimals)
 * 4. Collapse whitespace
 * 5. Convert number words to digits
 *
 * Idempotent: normalising a normalised string returns it unchanged.
 */
export function normaliseText(text: string): string {
  let result = text.toLowerCase();

  result = result.replace(/[-\u2010-\u2015]/g, " ");
  result = result.replace(/[^a-z0-9\s%.£€$]+/g, "");
  result = result.replace(/\.(?!\d)/g, "");
  result = result.replace(/(?<!\d)\./g, "");
  result = result.replace(/\s+/g, " ").trim();

  // Pure disfluencies carry no content and must never split or create a number.
  // ("mm" is deliberately not here: it can mean millimetres.)
  result = result.replace(/\b(?:um+|uh+|uhm|er|erm|hmm+)\b/g, " ");
  result = result.replace(/\s+/g, " ").trim();

  result = numberWordsToDigits(result);

  // Spoken decimals: "9 point 9" -> "9.9", "2 point 2 5" -> "2.25" (single digits after "point").
  result = result.replace(
    /\b(\d+) point ((?:\d )*\d)\b(?!\.)/g,
    (_, whole: string, frac: string) => `${whole}.${frac.replace(/ /g, "")}`,
  );

  return result.replace(/\s+/g, " ").trim();
}
