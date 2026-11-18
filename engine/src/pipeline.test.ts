import { describe, it, expect } from "vitest";
import { runPipeline } from "./pipeline";
import { makeSegment } from "./segments";
import type { ConversationSchema } from "./types";

const doctor: ConversationSchema = {
  id: "doctor-visit",
  skin: "care",
  detectors: ["number", "drug", "frequency", "date"],
  disclaimer: "d",
  facts: [
    {
      key: "medicine",
      fields: ["name", "dose", "frequency", "duration"],
      cues: { anchor: "@drug", windowWords: 25 },
    },
  ],
  checklist: [],
  nextSteps: [],
};

describe("runPipeline on real speech-engine output (S16 actor clip)", () => {
  it.each([
    ["whisper-tiny.en (browser)", "Take meriforming 500 milligrams.", "meriforming"],
    ["whisper-base.en (split word)", "take merform in 500 milligrams", "merform in"],
  ])("%s: keeps the medicine, as heard, stamped Check this", (_label, first, heard) => {
    const segments = [
      makeSegment(0, 0, 4860, first),
      makeSegment(1, 4860, 12540, "twice daily after food. Come back and see me in three months."),
    ];
    const { facts } = runPipeline(segments, doctor);
    const medicine = facts.find((f) => f.key === "medicine");
    expect(medicine?.fields).toEqual({
      name: heard,
      dose: "500 milligrams",
      frequency: "twice daily",
    });
    expect(medicine?.stamp).toBe("check_this");
  });

  it("keeps an unknown word heard just before a dose as the medicine, stamped Check this", () => {
    const segments = [makeSegment(0, 0, 5000, "Take paramet, 500 mg twice daily after food.")];
    const { facts } = runPipeline(segments, doctor);
    const medicine = facts.find((f) => f.key === "medicine");
    expect(medicine?.fields).toEqual({ name: "paramet", dose: "500 mg", frequency: "twice daily" });
    expect(medicine?.stamp).toBe("check_this");
  });
});
