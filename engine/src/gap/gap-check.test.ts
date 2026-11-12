import { describe, it, expect } from "vitest";
import { runGapCheck } from "./gap-check";
import type { ConversationSchema, Segment } from "../types";
import { makeSegment } from "../segments";

describe("runGapCheck", () => {
  const mockSegments: Segment[] = [
    makeSegment(0, 0, 3000, "start metformin 500 milligrams twice daily"),
    makeSegment(1, 3000, 6000, "come back in three months for review"),
    makeSegment(2, 6000, 9000, "if you feel dizzy call the clinic"),
    makeSegment(3, 9000, 12000, "any side effects like upset stomach"),
  ];

  const mockSchema: ConversationSchema = {
    id: "test-schema",
    skin: "care",
    detectors: ["number", "drug", "frequency", "date"],
    disclaimer: "Test disclaimer",
    facts: [],
    checklist: [
      {
        id: "q-medicine",
        text: "What medicine was prescribed?",
        sourceUrl: "user-planned",
        cues: {
          all: [["metformin"], ["500"]],
        },
      },
      {
        id: "q-follow-up",
        text: "When is the follow-up?",
        sourceUrl: "user-planned",
        cues: {
          all: [
            ["come back", "follow up", "review"],
            ["@date", "months"],
          ],
        },
      },
      {
        id: "q-warning",
        text: "What warning signs were mentioned?",
        sourceUrl: "user-planned",
        cues: {
          any: ["if you", "call the clinic", "emergency"],
        },
      },
      {
        id: "q-cost",
        text: "What is the cost?",
        sourceUrl: "user-planned",
        cues: {
          any: ["cost", "price", "dollars"],
        },
      },
      {
        id: "q-unclear",
        text: "Was nutrition discussed?",
        sourceUrl: "user-planned",
        cues: {
          all: [["nutrition", "diet", "stomach"], ["exercise"]],
        },
      },
    ],
    nextSteps: [],
  };

  it("marks item as answered when all groups match within 3 segments", () => {
    const results = runGapCheck([], mockSchema, mockSegments);

    const medicine = results.find((r) => r.item.id === "q-medicine");
    expect(medicine?.stamp).toBe("Answered");
    expect(medicine?.anchor).toBeDefined();
    expect(medicine?.anchor?.segmentIds).toContain("seg-0001");
  });

  it("marks item as answered for any-style cues", () => {
    const results = runGapCheck([], mockSchema, mockSegments);

    const warning = results.find((r) => r.item.id === "q-warning");
    expect(warning?.stamp).toBe("Answered");
    expect(warning?.anchor?.segmentIds).toContain("seg-0003");
  });

  it("marks item as not_discussed when no groups match", () => {
    const results = runGapCheck([], mockSchema, mockSegments);

    const cost = results.find((r) => r.item.id === "q-cost");
    expect(cost?.stamp).toBe("Not discussed");
    expect(cost?.anchor).toBeUndefined();
  });

  it("marks item as unclear when some but not all groups match", () => {
    const results = runGapCheck([], mockSchema, mockSegments);

    const unclear = results.find((r) => r.item.id === "q-unclear");
    expect(unclear?.stamp).toBe("Unclear");
    // Should have anchor for the partial match
    expect(unclear?.anchor).toBeDefined();
  });

  it("a scripted consult missing one item yields exactly that item as not_discussed", () => {
    const schema: ConversationSchema = {
      id: "missing-test",
      skin: "care",
      detectors: ["drug"],
      disclaimer: "Test",
      facts: [],
      checklist: [
        {
          id: "discussed-item",
          text: "Was medicine discussed?",
          sourceUrl: "user-planned",
          cues: { any: ["metformin"] },
        },
        {
          id: "missing-item",
          text: "Was cost discussed?",
          sourceUrl: "user-planned",
          cues: { any: ["cost", "price", "dollars"] },
        },
      ],
      nextSteps: [],
    };

    const results = runGapCheck([], schema, mockSegments);

    const discussed = results.find((r) => r.item.id === "discussed-item");
    expect(discussed?.stamp).toBe("Answered");

    const missing = results.find((r) => r.item.id === "missing-item");
    expect(missing?.stamp).toBe("Not discussed");
    expect(missing?.anchor).toBeUndefined();
  });

  it("respects 3-segment window for all-style cues", () => {
    const wideSegments: Segment[] = [
      makeSegment(0, 0, 3000, "metformin prescribed"),
      makeSegment(1, 3000, 6000, "something else entirely"),
      makeSegment(2, 6000, 9000, "more unrelated content"),
      makeSegment(3, 9000, 12000, "more unrelated stuff"),
      makeSegment(4, 12000, 15000, "take 500 milligrams"),
    ];

    const schema: ConversationSchema = {
      id: "window-test",
      skin: "care",
      detectors: [],
      disclaimer: "Test",
      facts: [],
      checklist: [
        {
          id: "q-window",
          text: "Medicine and dose?",
          sourceUrl: "user-planned",
          cues: {
            all: [["metformin"], ["500"]],
          },
        },
      ],
      nextSteps: [],
    };

    const results = runGapCheck([], schema, wideSegments);
    const item = results.find((r) => r.item.id === "q-window");

    // metformin in seg-0001, 500 in seg-0005, separated by 4 segments (>3)
    // Should be unclear (one group matches) or not_discussed
    expect(item?.stamp).not.toBe("Answered");
  });

  it("handles detector references in cues", () => {
    const schema: ConversationSchema = {
      id: "detector-ref-test",
      skin: "care",
      detectors: ["number", "drug"],
      disclaimer: "Test",
      facts: [],
      checklist: [
        {
          id: "q-detector",
          text: "Drug and dose?",
          sourceUrl: "user-planned",
          cues: {
            all: [["@drug"], ["@number"]],
          },
        },
      ],
      nextSteps: [],
    };

    const results = runGapCheck([], schema, mockSegments);
    const item = results.find((r) => r.item.id === "q-detector");

    expect(item?.stamp).toBe("Answered");
  });

  it('handles a detector reference mixed with regex alternatives ("@frequency|morning")', () => {
    const schema: ConversationSchema = {
      id: "mixed",
      skin: "care",
      detectors: ["frequency"],
      disclaimer: "Test",
      facts: [],
      checklist: [
        {
          id: "q-how-when",
          text: "How and when?",
          sourceUrl: "user-planned",
          cues: { all: [["@frequency|morning|evening|night"], ["food|meal"]] },
        },
      ],
      nextSteps: [],
    };
    const segs = [makeSegment(0, 0, 4000, "Take one tablet in the evening, with food.")];
    expect(runGapCheck([], schema, segs)[0].stamp).toBe("Answered");
  });

  it("matches cues written with apostrophes against the original wording", () => {
    const schema: ConversationSchema = {
      ...mockSchema,
      detectors: [],
      checklist: [
        {
          id: "q-avoid",
          text: "Avoid?",
          sourceUrl: "user-planned",
          cues: { any: ["don't drink"] },
        },
      ],
    };
    const segs = [makeSegment(0, 0, 4000, "Please don't drink alcohol with these.")];
    expect(runGapCheck([], schema, segs)[0].stamp).toBe("Answered");
  });

  it("answered anchors carry the verbatim text of the matched segments", () => {
    const results = runGapCheck([], mockSchema, mockSegments);
    const warning = results.find((r) => r.item.id === "q-warning");
    expect(warning?.anchor?.quote).toBe("if you feel dizzy call the clinic");
  });

  it("empty checklist returns empty results", () => {
    const schema: ConversationSchema = {
      ...mockSchema,
      checklist: [],
    };

    const results = runGapCheck([], schema, mockSegments);
    expect(results).toEqual([]);
  });

  it("empty segments mark all items as not_discussed", () => {
    const results = runGapCheck([], mockSchema, []);

    expect(results).toHaveLength(mockSchema.checklist.length);
    results.forEach((r) => {
      expect(r.stamp).toBe("Not discussed");
      expect(r.anchor).toBeUndefined();
    });
  });
});
