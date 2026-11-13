/**
 * Map flagged tokens (normalised values such as "500 milligrams") back onto the
 * original caption wording ("five hundred milligrams") so they can be highlighted.
 * The original text is shown unchanged; nothing is replaced.
 */

import { normaliseText } from "@echo/engine";
import type { FlaggedToken } from "@echo/engine";

export interface TextPart {
  text: string;
  token?: FlaggedToken;
}

const MAX_WORDS = 8;
const TRAILING = /[.,;:!?)"'\]]+$/;
const LEADING = /^[("'[]+/;

interface Range {
  start: number;
  end: number;
  token: FlaggedToken;
}

export function highlightParts(text: string, tokens: FlaggedToken[]): TextPart[] {
  const words = [...text.matchAll(/\S+/g)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }));
  const ranges: Range[] = [];
  const overlaps = (s: number, e: number) => ranges.some((r) => s < r.end && e > r.start);

  // Longer tokens first, so "1 tablet" claims "one tablet" before "1" does.
  const ordered = [...tokens].sort(
    (a, b) => normaliseText(b.value).length - normaliseText(a.value).length,
  );

  for (const token of ordered) {
    const target = normaliseText(token.value);
    if (target.length === 0) continue;
    let found: { start: number; end: number } | undefined;
    for (let i = 0; i < words.length && !found; i++) {
      for (let n = 1; n <= MAX_WORDS && i + n <= words.length; n++) {
        let start = words[i].start;
        let end = words[i + n - 1].end;
        const slice = text.slice(start, end);
        if (normaliseText(slice) !== target) continue;
        start += slice.length - slice.replace(LEADING, "").length;
        end -= slice.length - slice.replace(TRAILING, "").length;
        if (start < end && !overlaps(start, end)) found = { start, end };
        break;
      }
    }
    if (found) ranges.push({ ...found, token });
  }

  ranges.sort((a, b) => a.start - b.start);
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) parts.push({ text: text.slice(cursor, r.start) });
    parts.push({ text: text.slice(r.start, r.end), token: r.token });
    cursor = r.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts.length > 0 ? parts : [{ text }];
}
