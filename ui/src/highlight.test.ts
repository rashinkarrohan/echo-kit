import { describe, it, expect } from "vitest";
import { highlightParts } from "./highlight";
import type { FlaggedToken } from "@echo/engine";

const tok = (
  kind: FlaggedToken["kind"],
  value: string,
  extra: Partial<FlaggedToken> = {},
): FlaggedToken => ({
  kind,
  value,
  lowConfidence: false,
  ...extra,
});

const marked = (text: string, tokens: FlaggedToken[]) =>
  highlightParts(text, tokens)
    .filter((p) => p.token)
    .map((p) => p.text);

describe("highlightParts", () => {
  it("finds normalised token values in the original wording", () => {
    const text =
      "I want to start you on metformin, five hundred milligrams, twice daily after food.";
    const tokens = [
      tok("drug", "metformin"),
      tok("number", "500 milligrams"),
      tok("frequency", "twice daily"),
      tok("frequency", "after food"),
    ];
    expect(marked(text, tokens)).toEqual([
      "metformin",
      "five hundred milligrams",
      "twice daily",
      "after food",
    ]);
  });

  it("keeps every character of the original text, in order", () => {
    const text = "Take it, er, for three months.";
    const parts = highlightParts(text, [tok("date", "3 months")]);
    expect(parts.map((p) => p.text).join("")).toBe(text);
    expect(marked(text, [tok("date", "3 months")])).toEqual(["three months"]);
  });

  it("highlights a near-match drug as heard, with its suggestion kept on the token", () => {
    const parts = highlightParts("Take meriforming 500 milligrams.", [
      tok("drug", "meriforming", { suggestion: "metformin" }),
    ]);
    expect(parts.find((p) => p.token)?.token?.suggestion).toBe("metformin");
  });

  it("never overlaps two highlights; the longer match wins", () => {
    const text = "Take one tablet twice a day";
    const out = marked(text, [
      tok("number", "1 tablet"),
      tok("number", "1"),
      tok("frequency", "twice a day"),
    ]);
    expect(out).toEqual(["one tablet", "twice a day"]);
  });

  it("ignores a token it cannot find, without hiding text", () => {
    const text = "hello there";
    expect(highlightParts(text, [tok("drug", "aspirin")])).toEqual([{ text }]);
  });
});
