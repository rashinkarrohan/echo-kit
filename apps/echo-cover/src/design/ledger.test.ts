import { describe, expect, it } from "vitest";
import type { QuoteCell, QuoteComparisonRow } from "@echo/engine";
import { captionPx, joinNames, plannedCount, questionChip, rowNote } from "./ledger";

const cell = (seller: string, value: string | null): QuoteCell => ({
  conversationId: `c-${seller}`,
  seller,
  value,
});
const row = (field: string, cells: QuoteCell[], differs = false): QuoteComparisonRow => ({
  field,
  cells,
  differs,
});

describe("joinNames", () => {
  it("joins names in plain words", () => {
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B"])).toBe("A and B");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("rowNote: what the ledger says about one topic, never which seller is better", () => {
  it("says the amounts differ when both said a price and the values differ", () => {
    expect(rowNote(row("price", [cell("A", "3800"), cell("B", "4200")], true))).toEqual({
      tone: "differ",
      text: "The amounts differ",
    });
  });

  it("uses a word that fits the topic", () => {
    expect(rowNote(row("trial_returns", [cell("A", "x"), cell("B", "y")], true)).text).toBe(
      "The terms differ",
    );
    expect(rowNote(row("inclusions", [cell("A", "x"), cell("B", "y")], true)).text).toBe(
      "The details differ",
    );
  });

  it("names the one seller who said it", () => {
    expect(
      rowNote(row("financing", [cell("Seller A", "12 percent"), cell("Seller B", null)])),
    ).toEqual({ tone: "only", text: "Only Seller A said this" });
  });

  it("names the sellers who said it when some of three did", () => {
    expect(rowNote(row("financing", [cell("A", "x"), cell("B", null), cell("C", "y")]))).toEqual({
      tone: "only",
      text: "Only A and C said this",
    });
  });

  it("says neither seller said it when nobody did", () => {
    expect(rowNote(row("commission", [cell("A", null), cell("B", null)]))).toEqual({
      tone: "none",
      text: "Neither seller said",
    });
    expect(
      rowNote(row("commission", [cell("A", null), cell("B", null), cell("C", null)])).text,
    ).toBe("No seller said this");
  });

  it("says the same on each when everyone said the same", () => {
    expect(rowNote(row("price", [cell("A", "x"), cell("B", "x")]))).toEqual({
      tone: "same",
      text: "The same on each",
    });
  });

  it("has no note for fewer than two sellers", () => {
    expect(rowNote(row("price", [cell("A", "x")]))).toEqual({ tone: "same", text: "" });
  });
});

describe("questionChip", () => {
  it("maps the checklist stamps to the design's chips", () => {
    expect(questionChip("Answered")).toEqual({ tone: "said", word: "Said" });
    expect(questionChip("Unclear")).toEqual({ tone: "check", word: "Check this" });
    expect(questionChip("Not discussed")).toEqual({ tone: "none", word: "Not discussed" });
  });
});

describe("plannedCount", () => {
  it("counts only ids that are real questions", () => {
    expect(plannedCount(["a", "b", "zzz"], ["a", "b", "c"])).toBe(2);
  });
});

describe("Echo Cover caption sizes", () => {
  it("is 26 px on a phone at the default size, as in the design pack", () => {
    expect(captionPx("medium", false)).toBe(26);
  });
  it("grows with the chosen size", () => {
    expect(captionPx("small", false)).toBeLessThan(captionPx("medium", false));
    expect(captionPx("large", false)).toBeGreaterThan(captionPx("medium", false));
    expect(captionPx("medium", true)).toBeGreaterThan(captionPx("medium", false));
  });
});
