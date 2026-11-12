import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { makeSegment, assertOrdered, segmentsText, rangeOf } from "./segments";
import type { Segment } from "./types";

describe("makeSegment", () => {
  it("creates segment with correct id format", () => {
    const seg = makeSegment(0, 0, 3000, "hello world");
    expect(seg.id).toBe("seg-0001");
    expect(seg.index).toBe(0);
    expect(seg.startMs).toBe(0);
    expect(seg.endMs).toBe(3000);
    expect(seg.text).toBe("hello world");
  });

  it("pads index to 4 digits", () => {
    expect(makeSegment(0, 0, 1000, "a").id).toBe("seg-0001");
    expect(makeSegment(9, 0, 1000, "a").id).toBe("seg-0010");
    expect(makeSegment(99, 0, 1000, "a").id).toBe("seg-0100");
    expect(makeSegment(999, 0, 1000, "a").id).toBe("seg-1000");
  });
});

describe("assertOrdered", () => {
  // Property PB9: generated ordered segments always pass assertOrdered
  it("accepts properly ordered non-overlapping segments", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            startMs: fc.integer({ min: 0, max: 100000 }),
            durationMs: fc.integer({ min: 3000, max: 8000 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (specs) => {
          // Build ordered segments from specs
          const segments: Segment[] = [];
          let currentTime = 0;

          specs.forEach((spec, index) => {
            const startMs = currentTime;
            const endMs = startMs + spec.durationMs;
            segments.push(makeSegment(index, startMs, endMs, `segment ${index}`));
            currentTime = endMs; // Next segment starts where this one ends
          });

          const result = assertOrdered(segments);
          expect(result.ok).toBe(true);
        },
      ),
    );
  });

  // Property PB9: any overlap fails
  it("rejects overlapping segments", () => {
    const seg1 = makeSegment(0, 0, 5000, "first");
    const seg2 = makeSegment(1, 4000, 8000, "second"); // Overlaps with seg1

    const result = assertOrdered([seg1, seg2]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("overlap");
    }
  });

  it("rejects segments with decreasing times", () => {
    const seg1 = makeSegment(0, 5000, 8000, "first");
    const seg2 = makeSegment(1, 2000, 4000, "second"); // Earlier than seg1

    const result = assertOrdered([seg1, seg2]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("order");
    }
  });

  it("accepts adjacent segments (no gap)", () => {
    const seg1 = makeSegment(0, 0, 3000, "first");
    const seg2 = makeSegment(1, 3000, 6000, "second");
    const seg3 = makeSegment(2, 6000, 9000, "third");

    const result = assertOrdered([seg1, seg2, seg3]);
    expect(result.ok).toBe(true);
  });

  it("accepts segments with gaps", () => {
    const seg1 = makeSegment(0, 0, 3000, "first");
    const seg2 = makeSegment(1, 4000, 7000, "second"); // 1 second gap

    const result = assertOrdered([seg1, seg2]);
    expect(result.ok).toBe(true);
  });

  it("rejects segment where endMs < startMs", () => {
    const seg = makeSegment(0, 5000, 3000, "invalid");

    const result = assertOrdered([seg]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("end");
    }
  });

  it("accepts empty array", () => {
    const result = assertOrdered([]);
    expect(result.ok).toBe(true);
  });

  it("accepts single segment", () => {
    const seg = makeSegment(0, 0, 3000, "only");
    const result = assertOrdered([seg]);
    expect(result.ok).toBe(true);
  });
});

describe("segmentsText", () => {
  it("joins normalised text with single spaces", () => {
    const seg1 = makeSegment(0, 0, 3000, "Take FIFTY milligrams");
    const seg2 = makeSegment(1, 3000, 6000, "twice daily");

    const result = segmentsText([seg1, seg2]);
    expect(result).toBe("take 50 milligrams twice daily");
  });

  it("handles empty array", () => {
    expect(segmentsText([])).toBe("");
  });

  it("handles single segment", () => {
    const seg = makeSegment(0, 0, 3000, "hello world");
    expect(segmentsText([seg])).toBe("hello world");
  });

  it("collapses multiple spaces", () => {
    const seg1 = makeSegment(0, 0, 3000, "word1   word2");
    const seg2 = makeSegment(1, 3000, 6000, "word3");

    const result = segmentsText([seg1, seg2]);
    expect(result).not.toContain("  ");
  });
});

describe("rangeOf", () => {
  const segments = [
    makeSegment(0, 0, 3000, "first"),
    makeSegment(1, 3000, 6000, "second"),
    makeSegment(2, 6000, 9000, "third"),
    makeSegment(3, 9000, 12000, "fourth"),
  ];

  it("returns range for single segment", () => {
    const result = rangeOf(["seg-0001"], segments);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ startMs: 0, endMs: 3000 });
    }
  });

  it("returns range for multiple contiguous segments", () => {
    const result = rangeOf(["seg-0002", "seg-0003"], segments);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ startMs: 3000, endMs: 9000 });
    }
  });

  it("returns range for all segments", () => {
    const result = rangeOf(["seg-0001", "seg-0002", "seg-0003", "seg-0004"], segments);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ startMs: 0, endMs: 12000 });
    }
  });

  it("returns error for unknown segment id", () => {
    const result = rangeOf(["seg-9999"], segments);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("seg-9999");
    }
  });

  it("returns error for empty segment ids", () => {
    const result = rangeOf([], segments);
    expect(result.ok).toBe(false);
  });

  it("handles non-contiguous segment ids", () => {
    const result = rangeOf(["seg-0001", "seg-0003"], segments);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ startMs: 0, endMs: 9000 });
    }
  });
});
