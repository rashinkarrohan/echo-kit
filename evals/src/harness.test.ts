import { describe, it, expect } from "vitest";
import { RulesExtractor } from "@echo/engine";
import type { ConversationSchema } from "@echo/engine";
import { factMatches, runConsult, valuesAgree } from "./harness";
import type { Consult } from "./harness";

describe("valuesAgree (what counts as invented)", () => {
  it("a number that is not in the planted value is never agreement", () => {
    expect(valuesAgree("dose", "50 milligrams", "15 milligrams")).toBe(false);
    expect(valuesAgree("dose", "500 mg", "5 mg")).toBe(false);
    expect(valuesAgree("description", "take 2 together", "take it when you remember")).toBe(false);
  });

  it("same value in other wording agrees", () => {
    expect(valuesAgree("dose", "five hundred milligrams", "500 milligrams")).toBe(true);
    expect(valuesAgree("period", "60 day", "60 days")).toBe(true);
    expect(valuesAgree("frequency", "twice a day", "twice daily")).toBe(true);
  });

  it("different frequencies disagree", () => {
    expect(valuesAgree("frequency", "once daily", "twice daily")).toBe(false);
  });

  // Speech engines write units as symbols and abbreviations (real-voice check, Nov 21, 2026).
  it("the same amount written with a symbol or abbreviation agrees", () => {
    expect(valuesAgree("dose", "500mg", "500 milligrams")).toBe(true);
    expect(valuesAgree("strength", "500mg", "500 milligram")).toBe(true);
    expect(valuesAgree("amount", "$3800", "3800 dollars")).toBe(true);
    expect(valuesAgree("amount", "$3,800", "3800 dollars")).toBe(true);
    expect(valuesAgree("rate", "12%", "12 percent")).toBe(true);
    expect(valuesAgree("rate", "9.9%", "9.9 percent")).toBe(true);
  });

  it("a different amount or unit still disagrees", () => {
    expect(valuesAgree("dose", "500mcg", "500 milligrams")).toBe(false);
    expect(valuesAgree("dose", "50mg", "500 milligrams")).toBe(false);
    expect(valuesAgree("amount", "$380", "3800 dollars")).toBe(false);
    expect(valuesAgree("rate", "12%", "21 percent")).toBe(false);
    expect(valuesAgree("amount", "3800 pounds", "3800 dollars")).toBe(false);
  });

  it("a description must cover most of the planted content words", () => {
    expect(
      valuesAgree(
        "description",
        "If you feel very dizzy or you are sick for more than a day, call the clinic straight away",
        "very dizzy or sick for more than a day",
      ),
    ).toBe(true);
    expect(
      valuesAgree(
        "description",
        "Please come back on Tuesday",
        "very dizzy or sick for more than a day",
      ),
    ).toBe(false);
  });
});

describe("factMatches", () => {
  const planted = {
    key: "medicine",
    fields: { name: "metformin", dose: "500 milligrams" },
    quote: "q",
  };

  it("a field the planted fact does not have makes the fact invented", () => {
    expect(
      factMatches(
        { key: "medicine", fields: { name: "metformin", frequency: "twice daily" } },
        planted,
      ),
    ).toBe(false);
  });

  it("fewer fields than planted still matches (counted in field recall)", () => {
    expect(factMatches({ key: "medicine", fields: { name: "metformin" } }, planted)).toBe(true);
  });

  it("a different key never matches", () => {
    expect(factMatches({ key: "follow_up", fields: { name: "metformin" } }, planted)).toBe(false);
  });
});

describe("runConsult expectations", () => {
  const schema = (detectors: string[], key: string, fields: string[]): ConversationSchema => ({
    id: "s",
    skin: detectors.includes("drug") ? "care" : "cover",
    detectors,
    disclaimer: "d",
    facts: [{ key, fields, cues: { any: ["includes"] } }],
    checklist: [
      { id: "q-a", text: "A?", sourceUrl: "user-planned", cues: { any: ["includes"] } },
      { id: "q-b", text: "B?", sourceUrl: "user-planned", cues: { any: ["warranty"] } },
      { id: "q-c", text: "C?", sourceUrl: "user-planned", cues: { any: ["trial"] } },
    ],
    nextSteps: [],
  });
  const consult = (extra: Partial<Consult> = {}): Consult => ({
    id: "c",
    app: "echo-cover",
    schemaId: "s",
    segments: [
      {
        id: "seg-0001",
        startMs: 0,
        endMs: 4000,
        text: "That includes the fitting and two follow up visits.",
      },
    ],
    planted: [
      {
        key: "inclusions",
        fields: { description: "That includes the fitting and two follow up visits" },
        quote: "That includes the fitting and two follow up visits",
      },
    ],
    plantedGapItemIds: ["q-c"],
    ...extra,
  });
  const cover = schema(["money", "percent", "duration", "commission"], "inclusions", [
    "description",
  ]);

  it("a consult can state that more than its planted gap was not discussed", () => {
    const naive = runConsult(consult(), cover, new RulesExtractor());
    expect(naive.checklistCorrect).toBe(2); // q-b is expected Answered, but was not discussed
    const exact = runConsult(
      consult({ expectedChecklist: { "q-b": "Not discussed" } }),
      cover,
      new RulesExtractor(),
    );
    expect(exact.checklistCorrect).toBe(3);
  });

  it("a count inside a description is only expected flagged when the schema flags numbers", () => {
    expect(runConsult(consult(), cover, new RulesExtractor()).details.missedTokens).toEqual([]);
    const withNumbers = schema(["number", "money"], "inclusions", ["description"]);
    const r = runConsult(consult(), withNumbers, new RulesExtractor());
    expect(r.tokensExpected).toBe(1);
    expect(r.details.missedTokens).toEqual([]);
  });
});
