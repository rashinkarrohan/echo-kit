import { describe, expect, it } from "vitest";
import type { Anchor, ChecklistResult, Receipt, Stamp, VerifiedFact } from "@echo/engine";
import {
  answeredCount,
  askTopic,
  dayLabel,
  glance,
  hasExactDate,
  lastVisitTitle,
  medicineRows,
  nextVisit,
  sentenceCase,
  warningSigns,
} from "./visitView";

const anchor = (quote: string): Anchor => ({ segmentIds: ["s1"], startMs: 0, endMs: 4000, quote });

const fact = (
  key: string,
  fields: Record<string, string>,
  stamp: VerifiedFact["stamp"] = "heard_clearly",
  quote = "quote",
): VerifiedFact => ({ key, fields, stamp, anchor: anchor(quote) });

const item = (id: string, stamp: Stamp): ChecklistResult => ({
  item: { id, text: `Question ${id}`, sourceUrl: "user-planned" },
  stamp,
});

const receipt = (over: Partial<Receipt>): Receipt => ({
  conversationId: "c1",
  schemaId: "doctor-visit",
  timestamp: 0,
  facts: [],
  checklist: [],
  readBack: [],
  labelFlags: [],
  disclaimer: "",
  nextSteps: [],
  ...over,
});

describe("glance counts", () => {
  it("counts heard clearly facts, check-this facts plus unclear questions, and not-said questions", () => {
    const r = receipt({
      facts: [
        fact("medicine", {}, "heard_clearly"),
        fact("medicine", {}, "check_this"),
        fact("follow_up", {}, "heard_clearly"),
      ],
      checklist: [item("a", "Answered"), item("b", "Unclear"), item("c", "Not discussed")],
    });
    expect(glance(r)).toEqual({ heard: 2, check: 2, notSaid: 1, total: 5 });
  });

  it("is all zeros for an empty receipt", () => {
    expect(glance(receipt({}))).toEqual({ heard: 0, check: 0, notSaid: 0, total: 0 });
  });
});

describe("answeredCount", () => {
  it("counts answered questions out of all questions", () => {
    expect(
      answeredCount([item("a", "Answered"), item("b", "Unclear"), item("c", "Answered")]),
    ).toEqual({ answered: 2, total: 3 });
  });
});

describe("medicineRows", () => {
  it("names the doctor-visit rows and leaves missing ones undefined (never guessed)", () => {
    const rows = medicineRows(
      fact("medicine", { name: "metformin", dose: "500 milligrams", frequency: "twice a day" }),
      "doctor",
    );
    expect(rows).toEqual([
      { label: "Amount", value: "500 milligrams" },
      { label: "How often", value: "twice a day" },
      { label: "For how long", value: undefined },
    ]);
  });

  it("names the pharmacy rows", () => {
    const rows = medicineRows(
      fact("medicine", { name: "metformin", strength: "500 mg", how_to_take: "with food" }),
      "pharmacy",
    );
    expect(rows).toEqual([
      { label: "Amount", value: "500 mg" },
      { label: "How to take it", value: "with food" },
    ]);
  });

  it("treats blank values as not said", () => {
    const rows = medicineRows(fact("medicine", { dose: "  " }), "doctor");
    expect(rows[0]).toEqual({ label: "Amount", value: undefined });
  });
});

describe("hasExactDate", () => {
  it.each([
    ["on the 5th of March", true],
    ["on 12 November", true],
    ["on 3/12", true],
    ["next Tuesday", false],
    ["in 3 months", false],
    ["come back in three months", false],
    ["see me in may if you can", false],
    ["see me on May 4", true],
  ])("%s -> %s", (text, expected) => {
    expect(hasExactDate(text)).toBe(expected);
  });
});

describe("nextVisit", () => {
  it("is not said when no follow-up was heard", () => {
    expect(nextVisit(receipt({}))).toEqual({ heard: false, exactDate: false });
  });

  it("uses the heard 'when', keeps the quote, and says the date was not said", () => {
    const r = receipt({
      facts: [
        fact(
          "follow_up",
          { when: "in three months" },
          "heard_clearly",
          "come back in three months",
        ),
      ],
    });
    expect(nextVisit(r)).toEqual({
      heard: true,
      text: "in three months",
      quote: "come back in three months",
      anchor: anchor("come back in three months"),
      stamp: "heard_clearly",
      exactDate: false,
    });
  });

  it("falls back to the quote when there is no 'when' field", () => {
    const r = receipt({
      facts: [fact("follow_up", {}, "check_this", "review on the 5th of March")],
    });
    expect(nextVisit(r)).toMatchObject({
      text: "review on the 5th of March",
      stamp: "check_this",
      exactDate: true,
    });
  });
});

describe("warningSigns", () => {
  it("returns the words that were said, never invented ones", () => {
    const r = receipt({
      facts: [
        fact(
          "warning_sign",
          { description: "if you feel dizzy call" },
          "heard_clearly",
          "if you feel dizzy call the clinic",
        ),
        fact("medicine", {}),
      ],
    });
    expect(warningSigns(r)).toEqual([
      {
        quote: "if you feel dizzy call the clinic",
        anchor: anchor("if you feel dizzy call the clinic"),
        stamp: "heard_clearly",
      },
    ]);
  });
});

describe("askTopic", () => {
  it("maps known checklist ids to a short topic", () => {
    expect(askTopic("q-side-effects")).toBe("side effects");
  });
  it("returns undefined for an unknown id", () => {
    expect(askTopic("q-unknown")).toBeUndefined();
  });
});

describe("dayLabel", () => {
  const now = new Date(2026, 10, 12, 15, 0).getTime();
  it("says today and yesterday", () => {
    expect(dayLabel(new Date(2026, 10, 12, 9, 0).getTime(), now)).toBe("today");
    expect(dayLabel(new Date(2026, 10, 11, 23, 0).getTime(), now)).toBe("yesterday");
  });
  it("gives a date otherwise", () => {
    expect(dayLabel(new Date(2026, 9, 1, 9, 0).getTime(), now)).toMatch(/1/);
  });
});

describe("lastVisitTitle", () => {
  it("names the first medicine and its amount", () => {
    const r = receipt({
      facts: [fact("medicine", { name: "metformin", dose: "500 milligrams" })],
    });
    expect(lastVisitTitle(r, "doctor")).toBe("Metformin, 500 milligrams");
  });
  it("falls back to the visit kind", () => {
    expect(lastVisitTitle(receipt({}), "doctor")).toBe("Doctor visit");
    expect(lastVisitTitle(receipt({}), "pharmacy")).toBe("Pharmacy");
  });
});

describe("sentenceCase", () => {
  it("capitalises the first letter only", () => {
    expect(sentenceCase("metformin")).toBe("Metformin");
    expect(sentenceCase("")).toBe("");
  });
});
