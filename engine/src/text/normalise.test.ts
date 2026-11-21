import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { normaliseText, numberWordsToDigits } from "./normalise";

describe("normaliseText", () => {
  // Property PB: idempotence
  it("is idempotent (normalising twice gives same result)", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const once = normaliseText(text);
        const twice = normaliseText(once);
        expect(once).toBe(twice);
      }),
    );
  });

  // Test vectors from DETECTOR-SPEC
  it('converts "fifty" to 50', () => {
    expect(normaliseText("Take FIFTY milligrams.")).toBe("take 50 milligrams");
  });

  it('converts "fifteen" to 15', () => {
    expect(normaliseText("fifteen tablets")).toBe("15 tablets");
  });

  it('converts "five hundred" to 500', () => {
    expect(normaliseText("five hundred milligrams")).toBe("500 milligrams");
  });

  it('converts "a hundred and twenty" to 120', () => {
    expect(normaliseText("a hundred and twenty")).toBe("120");
  });

  it('converts "two thousand dollars" to 2000', () => {
    expect(normaliseText("two thousand dollars")).toBe("2000 dollars");
  });

  it('converts "twelve percent" to 12', () => {
    expect(normaliseText("twelve percent")).toBe("12 percent");
  });

  it('converts "half a tablet" to 0.5', () => {
    expect(normaliseText("half a tablet")).toBe("0.5 a tablet");
  });

  it("keeps fifty and fifteen distinct", () => {
    const fifty = normaliseText("fifty");
    const fifteen = normaliseText("fifteen");
    expect(fifty).toBe("50");
    expect(fifteen).toBe("15");
    expect(fifty).not.toBe(fifteen);
  });

  it("preserves digits that are already present", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), (num) => {
        const text = `take ${num} mg`;
        const normalised = normaliseText(text);
        expect(normalised).toContain(String(num));
      }),
    );
  });

  it("lowercases text", () => {
    expect(normaliseText("METFORMIN")).toBe("metformin");
    expect(normaliseText("TwIcE DaIlY")).toBe("twice daily");
  });

  it("preserves important punctuation (%, ., $, £, €)", () => {
    expect(normaliseText("12%")).toContain("%");
    expect(normaliseText("$50")).toContain("$");
    expect(normaliseText("£100")).toContain("£");
    expect(normaliseText("€25")).toContain("€");
    expect(normaliseText("0.5 mg")).toContain(".");
  });

  it("removes other punctuation", () => {
    const result = normaliseText("Take it, okay? Yes!");
    expect(result).not.toContain(",");
    expect(result).not.toContain("?");
    expect(result).not.toContain("!");
  });

  it("collapses whitespace", () => {
    expect(normaliseText("take   twice    daily")).toBe("take twice daily");
    expect(normaliseText("take\t\ndaily")).toBe("take daily");
  });

  it("handles number word combinations", () => {
    expect(normaliseText("twenty five")).toBe("25");
    expect(normaliseText("thirty seven")).toBe("37");
    expect(normaliseText("ninety nine")).toBe("99");
  });

  it("handles hundreds", () => {
    expect(normaliseText("one hundred")).toBe("100");
    expect(normaliseText("three hundred")).toBe("300");
    expect(normaliseText("nine hundred")).toBe("900");
  });

  it("handles thousands", () => {
    expect(normaliseText("one thousand")).toBe("1000");
    expect(normaliseText("five thousand")).toBe("5000");
    expect(normaliseText("fifteen thousand")).toBe("15000");
  });

  it("combines thousands with hundreds (spoken prices)", () => {
    expect(normaliseText("three thousand eight hundred dollars")).toBe("3800 dollars");
    expect(normaliseText("four thousand two hundred")).toBe("4200");
    expect(normaliseText("one thousand two hundred and thirty four")).toBe("1234");
    expect(normaliseText("two hundred and fifty")).toBe("250");
  });

  it('never adds separate numbers joined by "and" (dose safety)', () => {
    expect(normaliseText("between 2 and 3 tablets")).toBe("between 2 and 3 tablets");
    expect(normaliseText("one and two")).toBe("1 and 2");
    expect(normaliseText("take five and then ten")).toBe("take 5 and then 10");
  });

  it("keeps adjacent numbers that cannot combine apart", () => {
    expect(normaliseText("fifty fifteen")).toBe("50 15");
    expect(normaliseText("twenty twenty")).toBe("20 20");
    expect(normaliseText("one one")).toBe("1 1");
  });

  it('reads "and a half" after a number as .5 (red team 11, 21)', () => {
    expect(normaliseText("one and a half tablets")).toBe("1.5 tablets");
    expect(normaliseText("Take two and a half milligrams")).toBe("take 2.5 milligrams");
    expect(normaliseText("for one and a half weeks")).toBe("for 1.5 weeks");
    expect(normaliseText(normaliseText("one and a half tablets"))).toBe("1.5 tablets");
    // Only directly after a number: other "and a half" phrases are left alone.
    expect(normaliseText("an hour and a half")).toBe("an hour and a 0.5");
    expect(normaliseText("one and two")).toBe("1 and 2");
  });

  it('reads spoken decimals ("nine point nine" -> 9.9)', () => {
    expect(normaliseText("nine point nine percent")).toBe("9.9 percent");
    expect(normaliseText("zero point five milligrams")).toBe("0.5 milligrams");
    expect(normaliseText("two point two five")).toBe("2.25");
    expect(normaliseText("the main point is this")).toBe("the main point is this");
  });

  it("drops pure disfluencies so they cannot split or create numbers", () => {
    expect(normaliseText("five, um, hundred milligrams")).toBe("500 milligrams");
    expect(normaliseText("uh take it er twice daily")).toBe("take it twice daily");
    expect(normaliseText("I like the summer")).toBe("i like the summer");
  });

  it("handles hyphenated tens and punctuation after number words", () => {
    expect(normaliseText("twenty-five")).toBe("25");
    expect(normaliseText("metformin, five hundred milligrams, twice daily")).toBe(
      "metformin 500 milligrams twice daily",
    );
    expect(normaliseText("sixty day trial")).toBe("60 day trial");
  });
});

describe("numberWordsToDigits", () => {
  it("converts single digit words", () => {
    expect(numberWordsToDigits("zero")).toBe("0");
    expect(numberWordsToDigits("one")).toBe("1");
    expect(numberWordsToDigits("five")).toBe("5");
    expect(numberWordsToDigits("nine")).toBe("9");
  });

  it("converts teens", () => {
    expect(numberWordsToDigits("ten")).toBe("10");
    expect(numberWordsToDigits("eleven")).toBe("11");
    expect(numberWordsToDigits("fifteen")).toBe("15");
    expect(numberWordsToDigits("nineteen")).toBe("19");
  });

  it("converts tens", () => {
    expect(numberWordsToDigits("twenty")).toBe("20");
    expect(numberWordsToDigits("thirty")).toBe("30");
    expect(numberWordsToDigits("fifty")).toBe("50");
    expect(numberWordsToDigits("ninety")).toBe("90");
  });

  it('converts "a hundred" to 100', () => {
    expect(numberWordsToDigits("a hundred")).toBe("100");
  });

  it('converts "half" to 0.5', () => {
    expect(numberWordsToDigits("half")).toBe("0.5");
  });

  it("leaves non-number words unchanged", () => {
    expect(numberWordsToDigits("hello world")).toBe("hello world");
  });
});
