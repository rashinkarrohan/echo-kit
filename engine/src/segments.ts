/**
 * Segment and time utilities for Echo Kit.
 * Segments are 3-8 second audio chunks with time ranges.
 */

import type { Segment, Result } from "./types";
import { normaliseText } from "./text/normalise";

/**
 * Create a segment with a formatted ID (seg-0001, seg-0002, etc.)
 *
 * @param index - Zero-based segment index
 * @param startMs - Start time in milliseconds
 * @param endMs - End time in milliseconds
 * @param text - Transcribed text
 */
export function makeSegment(index: number, startMs: number, endMs: number, text: string): Segment {
  // Format index as 4-digit padded number (index 0 -> "0001")
  const paddedIndex = String(index + 1).padStart(4, "0");
  const id = `seg-${paddedIndex}`;

  return {
    id,
    index,
    startMs,
    endMs,
    text,
  };
}

/**
 * Assert that segments are properly ordered with no overlaps.
 *
 * Checks:
 * - Each segment's endMs >= startMs
 * - Segments are in increasing time order
 * - No overlaps between segments
 *
 * @param segments - Array of segments to validate
 * @returns Result indicating success or error message
 */
export function assertOrdered(segments: Segment[]): Result<void> {
  if (segments.length === 0) {
    return { ok: true, value: undefined };
  }

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    // Check that end >= start
    if (segment.endMs < segment.startMs) {
      return {
        ok: false,
        error: `Segment ${segment.id} has end time (${segment.endMs}ms) before start time (${segment.startMs}ms)`,
      };
    }

    // Check ordering and overlaps with next segment
    if (i < segments.length - 1) {
      const nextSegment = segments[i + 1];

      // Check time ordering
      if (nextSegment.startMs < segment.startMs) {
        return {
          ok: false,
          error: `Segments out of order: ${segment.id} starts at ${segment.startMs}ms but ${nextSegment.id} starts at ${nextSegment.startMs}ms`,
        };
      }

      // Check for overlap
      if (nextSegment.startMs < segment.endMs) {
        return {
          ok: false,
          error: `Segments overlap: ${segment.id} ends at ${segment.endMs}ms but ${nextSegment.id} starts at ${nextSegment.startMs}ms`,
        };
      }
    }
  }

  return { ok: true, value: undefined };
}

/**
 * Join normalised text from all segments with single spaces.
 * Used for fact checking and entity detection.
 *
 * @param segments - Array of segments
 * @returns Normalised joined text
 */
export function segmentsText(segments: Segment[]): string {
  if (segments.length === 0) {
    return "";
  }

  return segments.map((seg) => normaliseText(seg.text)).join(" ");
}

/**
 * Get the time range (start and end) for a set of segment IDs.
 *
 * @param segmentIds - Array of segment IDs
 * @param segments - All available segments
 * @returns Result with { startMs, endMs } or error
 */
export function rangeOf(
  segmentIds: string[],
  segments: Segment[],
): Result<{ startMs: number; endMs: number }> {
  if (segmentIds.length === 0) {
    return { ok: false, error: "Cannot get range of empty segment list" };
  }

  // Find all referenced segments
  const referencedSegments: Segment[] = [];
  for (const id of segmentIds) {
    const segment = segments.find((s) => s.id === id);
    if (!segment) {
      return { ok: false, error: `Segment ${id} not found` };
    }
    referencedSegments.push(segment);
  }

  // Find min start and max end
  const startMs = Math.min(...referencedSegments.map((s) => s.startMs));
  const endMs = Math.max(...referencedSegments.map((s) => s.endMs));

  return {
    ok: true,
    value: { startMs, endMs },
  };
}
