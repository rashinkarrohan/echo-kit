import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  moneyDetector,
  percentDetector,
  durationDetector,
  commissionDetector,
} from "./cover-detectors";
import { flagTokens } from "./index";
import { makeSegment } from "../segments";

describe("moneyDetector", () => {
  const testCases = [
    { input: "3800 dollars for the pair", expected: "3800 dollars" },
    { input: "$4200 total", expected: "$4200" },
    { input: "250 dollars a month", contains: "250 dollars" },
    { input: "£100", expected: "£100" },
    { input: "€500", expected: "€500" },
    { input: "rupees 1000", expected: "1000" }, // normalized "1000 rupees"
  ];

  testCases.forEach(({ input, expected, contains }) => {
    it(`detects money in "${input}"`, () => {
      const seg = makeSegment(0, 0, 3000, input);
      const tokens = moneyDetector.detect(seg);

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].kind).toBe("money");

      if (expected) {
        expect(tokens[0].value).toContain(expected);
      }
      if (contains) {
        expect(tokens[0].value).toContain(contains);
      }
    });
  });

  it("returns empty for text with no money", () => {
    const seg = makeSegment(0, 0, 3000, "hello world");
    const tokens = moneyDetector.detect(seg);

    expect(tokens).toHaveLength(0);
  });

  it("detects currency symbols", () => {
    const currencies = ["$100", "£200", "€300"];

    currencies.forEach((curr) => {
      const seg = makeSegment(0, 0, 3000, `the price is ${curr}`);
      const tokens = moneyDetector.detect(seg);

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].kind).toBe("money");
    });
  });
});

describe("percentDetector", () => {
  const testCases = [
    { input: "finance at 12 percent interest", expected: "12 percent" },
    { input: "12% APR", expected: "12%" },
    { input: "five percent down", contains: "percent" },
    { input: "3.5 per cent", expected: "3.5 per cent" },
  ];

  testCases.forEach(({ input, expected, contains }) => {
    it(`detects percent in "${input}"`, () => {
      const seg = makeSegment(0, 0, 3000, input);
      const tokens = percentDetector.detect(seg);

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].kind).toBe("percent");

      if (expected) {
        expect(tokens[0].value).toContain(expected);
      }
      if (contains) {
        expect(tokens[0].value).toContain(contains);
      }
    });
  });

  it("returns empty for text with no percent", () => {
    const seg = makeSegment(0, 0, 3000, "hello world");
    const tokens = percentDetector.detect(seg);

    expect(tokens).toHaveLength(0);
  });
});

describe("durationDetector", () => {
  const testCases = [
    { input: "30 days to return them", expected: "30 days" },
    { input: "over 3 years", expected: "3 years" },
    { input: "2 weeks trial period", expected: "2 weeks" },
    { input: "90 day warranty", contains: "day" },
    { input: "trial period included", expected: "trial period" },
    { input: "return period is generous", expected: "return period" },
    { input: "comes with warranty", expected: "warranty" },
  ];

  testCases.forEach(({ input, expected, contains }) => {
    it(`detects duration in "${input}"`, () => {
      const seg = makeSegment(0, 0, 3000, input);
      const tokens = durationDetector.detect(seg);

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].kind).toBe("duration");

      if (expected) {
        expect(tokens[0].value).toContain(expected);
      }
      if (contains) {
        expect(tokens[0].value).toContain(contains);
      }
    });
  });

  it("returns empty for text with no duration", () => {
    const seg = makeSegment(0, 0, 3000, "hello world");
    const tokens = durationDetector.detect(seg);

    expect(tokens).toHaveLength(0);
  });
});

describe("commissionDetector", () => {
  const testCases = [
    "our staff earn a commission on sales",
    "no commission here",
    "we get an incentive",
    "there is a bonus structure",
    "paid per sale",
    "no kickback involved",
  ];

  testCases.forEach((input) => {
    it(`detects commission word in "${input}"`, () => {
      const seg = makeSegment(0, 0, 3000, input);
      const tokens = commissionDetector.detect(seg);

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].kind).toBe("commission");
    });
  });

  it("returns empty for text with no commission words", () => {
    const seg = makeSegment(0, 0, 3000, "hello world");
    const tokens = commissionDetector.detect(seg);

    expect(tokens).toHaveLength(0);
  });

  it("flags the word even in negative context", () => {
    // The detector flags the word; the user decides what it means
    const seg = makeSegment(0, 0, 3000, "no commission here");
    const tokens = commissionDetector.detect(seg);

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0].value).toContain("commission");
  });
});

describe("Cover detectors integration", () => {
  it("flags multiple Cover tokens in a sales pitch", () => {
    const seg = makeSegment(
      0,
      0,
      8000,
      "The price is $4200 with 12 percent interest over 3 years, includes a 30 day trial, and no commission",
    );

    const detectors = [moneyDetector, percentDetector, durationDetector, commissionDetector];
    const tokens = flagTokens(seg, detectors);

    const kinds = tokens.map((t) => t.kind);
    expect(kinds).toContain("money");
    expect(kinds).toContain("percent");
    expect(kinds).toContain("duration");
    expect(kinds).toContain("commission");
  });
});

// Property: Cover equivalent of PB6
describe("Property: Cover token completeness", () => {
  it("flags all planted money, percent, duration, and commission tokens", () => {
    fc.assert(
      fc.property(
        fc.record({
          amount: fc.constantFrom("100", "500", "1000", "3800"),
          currency: fc.constantFrom("dollars", "pounds", "euros"),
          percent: fc.constantFrom("5", "10", "12", "15"),
          duration: fc.constantFrom("30 days", "2 weeks", "3 years", "90 days"),
          commissionWord: fc.constantFrom("commission", "incentive", "bonus"),
        }),
        (planted) => {
          const text = `price ${planted.amount} ${planted.currency} with ${planted.percent} percent over ${planted.duration} includes ${planted.commissionWord}`;
          const seg = makeSegment(0, 0, 8000, text);

          const detectors = [moneyDetector, percentDetector, durationDetector, commissionDetector];
          const tokens = flagTokens(seg, detectors);

          // Check that we found tokens of each kind
          const kinds = tokens.map((t) => t.kind);
          expect(kinds).toContain("money");
          expect(kinds).toContain("percent");
          expect(kinds).toContain("duration");
          expect(kinds).toContain("commission");

          // Check that planted values appear
          const moneyToken = tokens.find((t) => t.kind === "money");
          expect(moneyToken?.value).toContain(planted.amount);

          const percentToken = tokens.find((t) => t.kind === "percent");
          expect(percentToken?.value).toContain(planted.percent);

          const durationToken = tokens.find((t) => t.kind === "duration");
          expect(durationToken).toBeDefined();

          const commissionToken = tokens.find((t) => t.kind === "commission");
          expect(commissionToken).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });
});
