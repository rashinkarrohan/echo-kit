import { describe, it, expect } from "vitest";
import { repeatPrompts } from "./prompts";
import { flagTokens } from "./index";
import { detectorsFor, DRUG_DICTIONARY } from "./registry";
import { makeSegment } from "../segments";

const care = detectorsFor(["number", "drug", "frequency", "date"]);
const seg = (i: number, text: string) => makeSegment(i, i * 5000, (i + 1) * 5000, text);
const flagged = (i: number, text: string) => {
  const segment = seg(i, text);
  return { segment, tokens: flagTokens(segment, care, DRUG_DICTIONARY) };
};

describe("repeatPrompts", () => {
  it("asks for the medicine name when a dose is heard with no drug name nearby", () => {
    const now = flagged(1, "take five hundred milligrams twice daily");
    const before = flagged(0, "your sugar is a bit high");
    expect(repeatPrompts(now, before)).toEqual([
      { kind: "missing-medicine-name", segmentId: "seg-0002" },
    ]);
  });

  it("does not ask when the drug was named in this or the previous segment", () => {
    expect(repeatPrompts(flagged(0, "metformin 500 milligrams"))).toEqual([]);
    expect(
      repeatPrompts(
        flagged(1, "five hundred milligrams twice daily"),
        flagged(0, "start metformin"),
      ),
    ).toEqual([]);
  });

  it('does not ask for counts without a dose unit ("take two tablets")', () => {
    expect(
      repeatPrompts(flagged(1, "take two tablets in the evening"), flagged(0, "hello")),
    ).toEqual([]);
  });

  it("asks to repeat a drug name that only sounds like a known one, saying what it sounds like", () => {
    expect(repeatPrompts(flagged(0, "Take meriforming 500 milligrams."))).toEqual([
      {
        kind: "unclear-medicine-name",
        segmentId: "seg-0001",
        heard: "meriforming",
        suggestion: "metformin",
      },
    ]);
  });

  it("is silent for segments with nothing to check", () => {
    expect(repeatPrompts(flagged(0, "come back in three months"))).toEqual([]);
  });
});
