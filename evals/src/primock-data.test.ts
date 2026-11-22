import { describe, it, expect } from "vitest";
import { cleanTranscript, parseTextGrid } from "./primock-data";

const grid = `File type = "ooTextFile"
Object class = "TextGrid"
xmin = 0
xmax = 20
tiers? <exists>
size = 1
item []:
    item [1]:
        class = "IntervalTier"
        name = "Doctor"
        intervals: size = 3
        intervals [1]:
            xmin = 0
            xmax = 2.5
            text = ""
        intervals [2]:
            xmin = 2.5
            xmax = 12.25
            text = "Hello? <UNSURE>Hello how</UNSURE> um. Take ""two"" tablets."
        intervals [3]:
            xmin = 12.25
            xmax = 13
            text = "<UNIN/>"
`;

describe("PriMock57 transcripts", () => {
  it("keeps the spoken words and drops transcription marks", () => {
    expect(cleanTranscript("<UNIN/> Sorry to hear that. <UNSURE>Hello how</UNSURE> um.")).toBe(
      "Sorry to hear that. Hello how um.",
    );
  });

  it("reads non-empty intervals with times in ms, skipping silence and unintelligible-only", () => {
    expect(parseTextGrid(grid)).toEqual([
      { startMs: 2500, endMs: 12250, text: 'Hello? Hello how um. Take "two" tablets.' },
    ]);
  });
});
