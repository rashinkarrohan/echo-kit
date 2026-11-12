import type {
  ChecklistResult,
  ConversationSchema,
  Fact,
  Segment,
  ChecklistItem,
} from '../types';
import { normaliseText } from '../text/normalise';
import { rangeOf } from '../segments';
import {
  numberDetector,
  drugDetector,
  frequencyDetector,
  dateDetector,
  moneyDetector,
  percentDetector,
  durationDetector,
  commissionDetector,
} from '../guard/index';
import drugsData from '../../data/drugs.sample.json';

/**
 * Run gap check: for each checklist item, determine if it was answered,
 * unclear, or not discussed based on cue matching.
 *
 * Rules:
 * - `any`: matches if any alternative matches in any segment
 * - `all`: list of groups; matches when every group has at least one alternative
 *   matching within a window of at most 3 consecutive segments
 * - `Answered`: all groups match within window
 * - `Unclear`: some but not all groups match
 * - `Not discussed`: no groups match
 *
 * Never claims a speaker avoided a question.
 */
export function runGapCheck(
  _facts: Fact[],
  schema: ConversationSchema,
  segments: Segment[]
): ChecklistResult[] {
  return schema.checklist.map((item) =>
    checkItem(item, segments, schema.detectors)
  );
}

interface MatchedGroup {
  groupIndex: number;
  segmentIndices: number[];
}

function checkItem(
  item: ChecklistItem,
  segments: Segment[],
  enabledDetectors: string[]
): ChecklistResult {
  if (segments.length === 0) {
    return {
      item,
      stamp: 'Not discussed',
    };
  }

  const cues = item.cues;

  if (!cues) {
    return {
      item,
      stamp: 'Not discussed',
    };
  }

  // Handle "any" style cues
  if ('any' in cues && cues.any) {
    const matchedSegmentIndices = new Set<number>();

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const normalized = normaliseText(segment.text);

      for (const alt of cues.any) {
        if (matchesAlternative(alt, normalized, segment, enabledDetectors)) {
          matchedSegmentIndices.add(i);
          break;
        }
      }
    }

    if (matchedSegmentIndices.size > 0) {
      const segmentIds = Array.from(matchedSegmentIndices)
        .sort((a, b) => a - b)
        .map((i) => segments[i].id);

      const range = rangeOf(segmentIds, segments);
      if (!range.ok) {
        return {
          item,
          stamp: 'Not discussed',
        };
      }

      return {
        item,
        stamp: 'Answered',
        anchor: {
          segmentIds,
          startMs: range.value.startMs,
          endMs: range.value.endMs,
          quote: '', // Gap check doesn't extract quotes
        },
      };
    } else {
      return {
        item,
        stamp: 'Not discussed',
      };
    }
  }

  // Handle "all" style cues
  if ('all' in cues && cues.all) {
    const groups = cues.all;
    const matchedGroups: MatchedGroup[] = [];

    // For each group, find all segments where at least one alternative matches
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      const segmentIndices: number[] = [];

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const normalized = normaliseText(segment.text);

        for (const alt of group) {
          if (matchesAlternative(alt, normalized, segment, enabledDetectors)) {
            segmentIndices.push(i);
            break; // At least one alternative matched in this segment
          }
        }
      }

      if (segmentIndices.length > 0) {
        matchedGroups.push({ groupIndex, segmentIndices });
      }
    }

    // Check if all groups matched
    if (matchedGroups.length === groups.length) {
      // Check if they are within 3 consecutive segments
      const withinWindow = checkWithinWindow(matchedGroups, segments);

      if (withinWindow.inWindow) {
        const range = rangeOf(withinWindow.segmentIds, segments);
        if (!range.ok) {
          return {
            item,
            stamp: 'Unclear',
          };
        }

        return {
          item,
          stamp: 'Answered',
          anchor: {
            segmentIds: withinWindow.segmentIds,
            startMs: range.value.startMs,
            endMs: range.value.endMs,
            quote: '', // Gap check doesn't extract quotes
          },
        };
      } else {
        // All groups matched but not within window = unclear
        const allMatchedIndices = new Set<number>();
        matchedGroups.forEach((g) =>
          g.segmentIndices.forEach((i) => allMatchedIndices.add(i))
        );
        const segmentIds = Array.from(allMatchedIndices)
          .sort((a, b) => a - b)
          .map((i) => segments[i].id);

        const range = rangeOf(segmentIds, segments);
        if (!range.ok) {
          return {
            item,
            stamp: 'Unclear',
          };
        }

        return {
          item,
          stamp: 'Unclear',
          anchor: {
            segmentIds,
            startMs: range.value.startMs,
            endMs: range.value.endMs,
            quote: '',
          },
        };
      }
    } else if (matchedGroups.length > 0) {
      // Some but not all groups matched = unclear
      const allMatchedIndices = new Set<number>();
      matchedGroups.forEach((g) =>
        g.segmentIndices.forEach((i) => allMatchedIndices.add(i))
      );
      const segmentIds = Array.from(allMatchedIndices)
        .sort((a, b) => a - b)
        .map((i) => segments[i].id);

      const range = rangeOf(segmentIds, segments);
      if (!range.ok) {
        return {
          item,
          stamp: 'Unclear',
        };
      }

      return {
        item,
        stamp: 'Unclear',
        anchor: {
          segmentIds,
          startMs: range.value.startMs,
          endMs: range.value.endMs,
          quote: '',
        },
      };
    } else {
      // No groups matched
      return {
        item,
        stamp: 'Not discussed',
      };
    }
  }

  // No cues defined
  return {
    item,
    stamp: 'Not discussed',
  };
}

/**
 * Check if all groups have at least one match within a window of 3 consecutive segments.
 * Returns the segment IDs that form the matching window if found.
 */
function checkWithinWindow(
  matchedGroups: MatchedGroup[],
  segments: Segment[]
): { inWindow: boolean; segmentIds: string[] } {
  // Try all possible 3-segment windows
  for (let start = 0; start < segments.length; start++) {
    const end = Math.min(start + 3, segments.length);
    const windowIndices = new Set<number>();

    for (let i = start; i < end; i++) {
      windowIndices.add(i);
    }

    // Check if every group has at least one match in this window
    const allGroupsInWindow = matchedGroups.every((group) =>
      group.segmentIndices.some((idx) => windowIndices.has(idx))
    );

    if (allGroupsInWindow) {
      // Collect the actual matched segment indices in this window
      const matchedInWindow = new Set<number>();
      matchedGroups.forEach((group) => {
        group.segmentIndices.forEach((idx) => {
          if (windowIndices.has(idx)) {
            matchedInWindow.add(idx);
          }
        });
      });

      const segmentIds = Array.from(matchedInWindow)
        .sort((a, b) => a - b)
        .map((i) => segments[i].id);

      return { inWindow: true, segmentIds };
    }
  }

  return { inWindow: false, segmentIds: [] };
}

/**
 * Check if an alternative (regex or detector reference) matches the normalized text.
 */
function matchesAlternative(
  alternative: string,
  normalizedText: string,
  segment: Segment,
  enabledDetectors: string[]
): boolean {
  // Detector reference
  if (alternative.startsWith('@')) {
    const detectorId = alternative.slice(1);

    if (!enabledDetectors.includes(detectorId)) {
      return false;
    }

    const detector = getDetector(detectorId);
    if (!detector) {
      return false;
    }

    // Drug detector needs the dictionary
    const tokens =
      detectorId === 'drug' ? detector.detect(segment, drugsData) : detector.detect(segment);
    return tokens.length > 0;
  }

  // Regular expression (case-insensitive)
  try {
    const regex = new RegExp(alternative, 'i');
    return regex.test(normalizedText);
  } catch {
    // Invalid regex, treat as literal string match
    return normalizedText.includes(alternative.toLowerCase());
  }
}

/**
 * Get detector by ID
 */
function getDetector(id: string) {
  const detectors = {
    number: numberDetector,
    drug: drugDetector,
    frequency: frequencyDetector,
    date: dateDetector,
    money: moneyDetector,
    percent: percentDetector,
    duration: durationDetector,
    commission: commissionDetector,
  };

  return detectors[id as keyof typeof detectors];
}
