/**
 * Gap check: was each checklist item discussed?
 *
 * Cue rules (docs/appendix/DETECTOR-SPEC.md):
 * - `any: [alt, ...]` matches if any alternative matches in a segment.
 * - `all: [[alt, ...], ...]` matches when every group has a matching alternative
 *   within a window of at most 3 consecutive segments.
 * - Answered: the whole cue matches (anchor = the matched segments).
 * - Unclear: at least one but not every group matches.
 * - Not discussed: nothing matches.
 *
 * The result only says whether the topic was heard. It never claims that a speaker
 * avoided a question.
 */

import type {
  Anchor,
  ChecklistItem,
  ChecklistResult,
  ConversationSchema,
  Fact,
  Segment,
} from "../types";
import { matchesCue } from "../guard/registry";

const WINDOW_SEGMENTS = 3;

export function runGapCheck(
  _facts: Fact[],
  schema: ConversationSchema,
  segments: Segment[],
): ChecklistResult[] {
  return schema.checklist.map((item) => checkItem(item, segments, schema.detectors));
}

/** Build an anchor over a contiguous run of segments, quoting their original text verbatim. */
function anchorFor(segments: Segment[], from: number, to: number): Anchor {
  const span = segments.slice(from, to + 1);
  return {
    segmentIds: span.map((s) => s.id),
    startMs: span[0].startMs,
    endMs: span[span.length - 1].endMs,
    quote: span.map((s) => s.text).join(" "),
  };
}

function toGroups(cues: ChecklistItem["cues"]): string[][] | null {
  if (!cues) return null;
  const all: unknown = cues["all"];
  const any: unknown = cues["any"];
  if (Array.isArray(all) && all.length > 0) {
    return all.map((g: unknown) => (Array.isArray(g) ? g.map(String) : [String(g)]));
  }
  if (Array.isArray(any) && any.length > 0) {
    return [any.map(String)];
  }
  return null;
}

function checkItem(item: ChecklistItem, segments: Segment[], enabled: string[]): ChecklistResult {
  const groups = toGroups(item.cues);
  if (!groups || segments.length === 0) {
    return { item, stamp: "Not discussed" };
  }

  // hits[g][i] = group g matches segment i
  const hits = groups.map((group) =>
    segments.map((segment) => group.some((alt) => matchesCue(alt, segment, enabled))),
  );

  // Answered: earliest window of <= 3 consecutive segments where every group matches.
  for (let start = 0; start < segments.length; start++) {
    const end = Math.min(start + WINDOW_SEGMENTS, segments.length) - 1;
    const matchedIdx: number[] = [];
    const everyGroup = hits.every((row) => {
      let found = false;
      for (let i = start; i <= end; i++) {
        if (row[i]) {
          found = true;
          matchedIdx.push(i);
        }
      }
      return found;
    });
    if (everyGroup) {
      return {
        item,
        stamp: "Answered",
        anchor: anchorFor(segments, Math.min(...matchedIdx), Math.max(...matchedIdx)),
      };
    }
  }

  // Unclear: some group matched somewhere; anchor the first segment that matched.
  const firstHit = segments.findIndex((_, i) => hits.some((row) => row[i]));
  if (firstHit >= 0) {
    return { item, stamp: "Unclear", anchor: anchorFor(segments, firstHit, firstHit) };
  }

  return { item, stamp: "Not discussed" };
}
