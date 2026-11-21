import { describe, it, expect } from "vitest";
import { buildMedicinePrompt, buildWordsPrompt } from "./prompt";

const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;

describe("buildMedicinePrompt", () => {
  it("puts the user's own medicines first and skips repeats", () => {
    expect(buildMedicinePrompt(["metformin", "warfarin"], words, { priority: ["Warfarin"] })).toBe(
      " Medicines: warfarin, metformin.",
    );
  });
  it("stops at the token budget", () => {
    const p = buildMedicinePrompt(["a", "b", "c", "d"], words, { maxTokens: 3 });
    expect(p).toBe(" Medicines: a, b.");
  });
});

describe("buildWordsPrompt (plain words, no sentence)", () => {
  it("lists the words, so Whisper is not handed a sentence it could repeat", () => {
    expect(buildWordsPrompt(["hearing aids", "pair", "commission"], words)).toBe(
      " Words: hearing aids, pair, commission.",
    );
  });
  it("stops at the token budget and is empty with no words", () => {
    expect(buildWordsPrompt(["pair", "trial", "refund"], words, 3)).toBe(" Words: pair, trial.");
    expect(buildWordsPrompt([], words)).toBe("");
  });
});
