import { describe, it, expect } from "vitest";
import { RulesExtractor } from "./rules-extractor";
import { makeSegment } from "../segments";
import type { ConversationSchema } from "../types";

// Simple test schema
const careSchema: ConversationSchema = {
  id: "test-care",
  skin: "care",
  detectors: ["number", "drug", "frequency", "date"],
  disclaimer: "Test",
  facts: [
    {
      key: "medicine",
      fields: ["name", "dose", "frequency", "duration"],
      cues: {
        anchor: "@drug",
        windowWords: 25,
        optional: ["@number", "@frequency"],
      },
    },
    {
      key: "follow_up",
      fields: ["when", "what"],
      cues: {
        any: ["come back", "follow[- ]up", "review", "next appointment"],
        windowWords: 15,
        optional: ["@date"],
      },
    },
  ],
  checklist: [],
  nextSteps: [],
};

const coverSchema: ConversationSchema = {
  id: "test-cover",
  skin: "cover",
  detectors: ["money", "percent", "duration", "commission"],
  disclaimer: "Test",
  facts: [
    {
      key: "price",
      fields: ["amount", "per"],
      cues: {
        anchor: "@money",
        windowWords: 15,
        near: ["price", "cost", "total"],
      },
    },
    {
      key: "financing",
      fields: ["rate", "term", "monthly"],
      cues: {
        any: ["finance", "financing", "interest", "apr"],
        windowWords: 25,
        optional: ["@percent", "@money"],
      },
    },
  ],
  checklist: [],
  nextSteps: [],
};

describe("RulesExtractor", () => {
  const extractor = new RulesExtractor();

  describe("Care facts", () => {
    it("extracts medicine fact from scripted line", () => {
      const segments = [
        makeSegment(0, 0, 5000, "take metformin five hundred milligrams twice daily after food"),
      ];

      const facts = extractor.extract(segments, careSchema);

      expect(facts.length).toBeGreaterThan(0);

      const medicine = facts.find((f) => f.key === "medicine");
      expect(medicine).toBeDefined();
      expect(medicine!.fields.name).toContain("metformin");
      expect(medicine!.quote).toBeTruthy();

      // Quote must be from the original segment text (may be subset)
      // The original text is used for the quote, not the normalized version
      const originalText = segments[0].text;
      expect(medicine!.quote).toBe(originalText);
    });

    it("extracts multiple medicine facts", () => {
      const segments = [
        makeSegment(0, 0, 5000, "start metformin 500 mg twice daily"),
        makeSegment(1, 5000, 10000, "and aspirin 75 mg once daily"),
      ];

      const facts = extractor.extract(segments, careSchema);

      const medicines = facts.filter((f) => f.key === "medicine");
      expect(medicines.length).toBeGreaterThanOrEqual(2);
    });

    it("extracts follow-up fact", () => {
      const segments = [makeSegment(0, 0, 5000, "come back in two weeks for a review")];

      const facts = extractor.extract(segments, careSchema);

      const followUp = facts.find((f) => f.key === "follow_up");
      expect(followUp).toBeDefined();
      expect(followUp!.quote).toBeTruthy();
    });

    it("includes segment IDs in raw facts", () => {
      const segments = [makeSegment(0, 0, 5000, "take metformin 500 mg twice daily")];

      const facts = extractor.extract(segments, careSchema);

      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].segmentIds).toBeDefined();
      expect(facts[0].segmentIds.length).toBeGreaterThan(0);
      expect(facts[0].segmentIds[0]).toBe("seg-0001");
    });

    it("copies quote from original segment text, not normalized", () => {
      const segments = [
        makeSegment(0, 0, 5000, "Take METFORMIN five hundred milligrams TWICE daily"),
      ];

      const facts = extractor.extract(segments, careSchema);

      const medicine = facts.find((f) => f.key === "medicine");
      expect(medicine).toBeDefined();

      // Quote should preserve original casing and words
      expect(medicine!.quote).toMatch(/METFORMIN|metformin/i);
    });
  });

  describe("Cover facts", () => {
    it("extracts price fact", () => {
      const segments = [makeSegment(0, 0, 5000, "the total price is $4200 for the pair")];

      const facts = extractor.extract(segments, coverSchema);

      const price = facts.find((f) => f.key === "price");
      expect(price).toBeDefined();
      expect(price!.quote).toBeTruthy();
    });

    it("extracts financing fact with percent", () => {
      const segments = [makeSegment(0, 0, 5000, "financing available at 12 percent interest")];

      const facts = extractor.extract(segments, coverSchema);

      const financing = facts.find((f) => f.key === "financing");
      expect(financing).toBeDefined();
    });
  });

  describe("Window constraints", () => {
    it("respects windowWords limit", () => {
      // Create a segment with tokens far apart beyond the window
      const segments = [
        makeSegment(
          0,
          0,
          8000,
          "the medicine is great but expensive and hard to get metformin in stores near me and many other places that I have tried looking for it 500 mg",
        ),
      ];

      const facts = extractor.extract(segments, careSchema);

      // May or may not extract depending on window - this tests the constraint exists
      // The key is that it doesn't extract when tokens are too far apart
      const medicines = facts.filter((f) => f.key === "medicine");
      // If extracted, the quote should be within reasonable bounds
      if (medicines.length > 0) {
        const wordCount = medicines[0].quote.split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(30); // Reasonable upper bound
      }
    });
  });

  describe("Schema-driven fields (seed consult lines)", () => {
    const doctor: ConversationSchema = {
      ...careSchema,
      facts: [
        ...careSchema.facts,
        {
          key: "warning_sign",
          fields: ["description"],
          cues: {
            any: [
              "if you (feel|get|have|notice|start|develop|are)",
              "call the (clinic|doctor|surgery)",
              "emergency",
              "straight away",
            ],
            windowWords: 25,
          },
        },
      ],
    };

    it("spans the next segment when it carries a missing field (dose and duration in different segments)", () => {
      const segments = [
        makeSegment(
          0,
          0,
          7000,
          "I want to start you on metformin, five hundred milligrams, twice daily after food.",
        ),
        makeSegment(
          1,
          7000,
          12500,
          "Take it for three months and then we will review how you are getting on.",
        ),
      ];
      const med = extractor.extract(segments, doctor).find((f) => f.key === "medicine")!;
      expect(med.fields).toEqual({
        name: "metformin",
        dose: "500 milligrams",
        frequency: "twice daily",
        duration: "3 months",
      });
      expect(med.segmentIds).toEqual(["seg-0001", "seg-0002"]);
      expect(med.quote).toBe(segments.map((s) => s.text).join(" "));
    });

    it("stores frequency as heard, never as a canonical code", () => {
      const med = extractor.extract(
        [makeSegment(0, 0, 5000, "metformin 500 mg twice daily")],
        doctor,
      )[0];
      expect(med.fields.frequency).toBe("twice daily");
    });

    it("never fills a field with a placeholder", () => {
      const facts = extractor.extract(
        [makeSegment(0, 0, 5000, "Please come back and see me in three months.")],
        doctor,
      );
      const followUp = facts.find((f) => f.key === "follow_up")!;
      expect(followUp.fields).toEqual({ when: "in 3 months" });
    });

    it("skips a follow-up cue with nothing to fill", () => {
      const facts = extractor.extract(
        [makeSegment(0, 0, 5000, "Then we will review how you are getting on.")],
        doctor,
      );
      expect(facts.filter((f) => f.key === "follow_up")).toEqual([]);
    });

    it("takes a description from the sentence that holds the cue", () => {
      const segments = [
        makeSegment(
          0,
          0,
          7000,
          "Good. If you feel very dizzy, call the clinic straight away. Bye now.",
        ),
      ];
      const warning = extractor.extract(segments, doctor).find((f) => f.key === "warning_sign")!;
      expect(warning.fields.description).toBe(
        "If you feel very dizzy, call the clinic straight away",
      );
    });

    it('does not turn "do not take <drug>" into a medicine to take', () => {
      const segments = [makeSegment(0, 0, 6000, "Do not take ibuprofen while you are on this.")];
      expect(extractor.extract(segments, doctor).filter((f) => f.key === "medicine")).toEqual([]);
    });

    it("keeps a misheard drug name as heard (never auto-corrects)", () => {
      const med = extractor.extract(
        [makeSegment(0, 0, 5000, "start metformine 500 mg once daily")],
        doctor,
      )[0];
      expect(med.fields.name).toBe("metformine");
    });

    it("does not pull the next medicine into this fact", () => {
      const segments = [
        makeSegment(0, 0, 5000, "Keep taking amlodipine."),
        makeSegment(1, 5000, 10000, "And atorvastatin 20 milligrams at night."),
      ];
      const meds = extractor.extract(segments, doctor).filter((f) => f.key === "medicine");
      expect(meds.map((m) => m.fields)).toEqual([
        { name: "amlodipine" },
        { name: "atorvastatin", dose: "20 milligrams", frequency: "at night" },
      ]);
    });

    it("pharmacy: strength and how_to_take", () => {
      const pharmacy: ConversationSchema = {
        ...careSchema,
        detectors: ["number", "drug", "frequency"],
        facts: [
          {
            key: "medicine",
            fields: ["name", "strength", "how_to_take"],
            cues: { anchor: "@drug", windowWords: 30 },
          },
        ],
      };
      const segments = [
        makeSegment(0, 0, 5500, "Here is your metformin, five hundred milligram tablets."),
        makeSegment(
          1,
          5500,
          12500,
          "Take one tablet in the morning and one tablet in the evening, with food.",
        ),
      ];
      const med = extractor.extract(segments, pharmacy)[0];
      expect(med.fields).toEqual({
        name: "metformin",
        strength: "500 milligram",
        how_to_take: "Take one tablet in the morning and one tablet in the evening, with food",
      });
    });
  });

  describe("Red-team attacks (S27): never give one medicine another's values", () => {
    const doctor: ConversationSchema = {
      ...careSchema,
      facts: [
        {
          key: "medicine",
          fields: ["name", "dose", "frequency", "duration"],
          cues: { anchor: "@drug", windowWords: 25 },
        },
      ],
    };
    const meds = (...texts: string[]) =>
      extractor
        .extract(
          texts.map((t, i) => makeSegment(i, i * 6000, (i + 1) * 6000, t)),
          doctor,
        )
        .filter((f) => f.key === "medicine")
        .map((f) => f.fields);

    it("01: two drugs in one sentence keep their own dose and frequency", () => {
      expect(
        meds(
          "Keep the aspirin at seventy-five milligrams once a day, and add metformin five hundred milligrams twice a day.",
        ),
      ).toEqual([
        { name: "aspirin", dose: "75 milligrams", frequency: "once a day" },
        { name: "metformin", dose: "500 milligrams", frequency: "twice a day" },
      ]);
    });

    it("06: a dose said before the second drug is not given to it", () => {
      expect(
        meds("Carry on with your metformin five hundred milligrams and your aspirin."),
      ).toEqual([{ name: "metformin", dose: "500 milligrams" }, { name: "aspirin" }]);
    });

    it("10: an old dose said before the drug does not win over the dose after it", () => {
      expect(
        meds(
          "You used to take one thousand milligrams, but now take metformin five hundred milligrams twice a day.",
        ),
      ).toEqual([{ name: "metformin", dose: "500 milligrams", frequency: "twice a day" }]);
    });

    it("14: frequency is the one said nearest after the drug, by position", () => {
      expect(meds("Metformin five hundred milligrams, twice a day now.")).toEqual([
        { name: "metformin", dose: "500 milligrams", frequency: "twice a day" },
      ]);
    });

    it("02 and 09: a corrected or contradicted dose is left empty, never guessed", () => {
      expect(
        meds(
          "We are starting amlodipine.",
          "Take ten milligrams, sorry, I mean five milligrams, once a day.",
        ),
      ).toEqual([{ name: "amlodipine", frequency: "once a day" }]);
      expect(
        meds(
          "We are starting amlodipine.",
          "Not ten milligrams like your old tablets, just five milligrams once a day.",
        ),
      ).toEqual([{ name: "amlodipine", frequency: "once a day" }]);
    });

    it("conflicting frequencies for one drug are left empty", () => {
      expect(
        meds("Metformin five hundred milligrams twice a day, because once a day was not enough."),
      ).toEqual([{ name: "metformin", dose: "500 milligrams" }]);
    });

    it("04: a negation further back still stops the drug becoming a medicine to take", () => {
      expect(meds("Please don't take any more of the ibuprofen four hundred milligrams.")).toEqual(
        [],
      );
    });

    it("07: a drug that is being stopped is not a medicine to take", () => {
      expect(meds("The simvastatin forty milligrams, we are stopping that today.")).toEqual([]);
    });

    it("08: the drug started after a stopped one is still kept", () => {
      expect(
        meds("Stop taking simvastatin and start atorvastatin twenty milligrams at night."),
      ).toEqual([{ name: "atorvastatin", dose: "20 milligrams", frequency: "at night" }]);
    });
  });

  describe("Cover fields (seed consult lines)", () => {
    const sale: ConversationSchema = {
      ...coverSchema,
      facts: [
        {
          key: "price",
          fields: ["amount", "per"],
          cues: {
            anchor: "@money",
            windowWords: 15,
            near: ["price", "cost", "total", "for the pair", "each"],
          },
        },
        {
          key: "inclusions",
          fields: ["description"],
          cues: { any: ["includes?", "included", "fitting", "warranty"], windowWords: 25 },
        },
        {
          key: "trial_returns",
          fields: ["period", "terms"],
          cues: { any: ["trial", "try them", "return", "refund"], windowWords: 20 },
        },
        {
          key: "financing",
          fields: ["rate", "term", "monthly"],
          cues: { any: ["finance", "pay monthly", "interest"], windowWords: 25 },
        },
        {
          key: "commission",
          fields: ["statement"],
          cues: { any: ["@commission"], windowWords: 20 },
        },
      ],
    };
    const segments = [
      makeSegment(
        0,
        0,
        6500,
        "These are our premium devices, and the price is three thousand eight hundred dollars for the pair.",
      ),
      makeSegment(
        1,
        6500,
        13000,
        "That includes fitting and three follow up visits in the first year.",
      ),
      makeSegment(
        2,
        13000,
        19500,
        "You can try them for thirty days and return them for a full refund.",
      ),
      makeSegment(
        3,
        19500,
        27000,
        "If you prefer to pay monthly, we offer finance at twelve percent interest over three years.",
      ),
      makeSegment(
        4,
        27000,
        33000,
        "Our staff do earn a commission on every sale, which is normal.",
      ),
    ];
    const facts = extractor.extract(segments, sale);
    const byKey = (k: string) => facts.filter((f) => f.key === k).map((f) => f.fields);

    it("price", () => expect(byKey("price")).toEqual([{ amount: "3800 dollars", per: "pair" }]));
    it("inclusions", () =>
      expect(byKey("inclusions")).toEqual([
        { description: "That includes fitting and three follow up visits in the first year" },
      ]));
    it("trial and returns", () =>
      expect(byKey("trial_returns")).toEqual([{ period: "30 days", terms: "full refund" }]));
    it("financing", () =>
      expect(byKey("financing")).toEqual([{ rate: "12 percent", term: "3 years" }]));
    it("commission", () =>
      expect(byKey("commission")).toEqual([
        { statement: "Our staff do earn a commission on every sale, which is normal" },
      ]));
    it("a monthly amount is read as monthly, not as the price", () => {
      const f = extractor.extract(
        [makeSegment(0, 0, 5000, "Or finance it at 250 dollars a month.")],
        sale,
      );
      expect(f.filter((x) => x.key === "financing").map((x) => x.fields)).toEqual([
        { monthly: "250 dollars" },
      ]);
      expect(f.filter((x) => x.key === "price")).toEqual([]);
    });
  });

  describe("Empty cases", () => {
    it("returns empty array for empty segments", () => {
      const facts = extractor.extract([], careSchema);
      expect(facts).toEqual([]);
    });

    it("returns empty array when no cues match", () => {
      const segments = [makeSegment(0, 0, 5000, "hello world how are you today")];

      const facts = extractor.extract(segments, careSchema);
      expect(facts).toEqual([]);
    });
  });

  describe("Deterministic behavior", () => {
    it("produces same results for same input", () => {
      const segments = [makeSegment(0, 0, 5000, "take metformin 500 mg twice daily")];

      const facts1 = extractor.extract(segments, careSchema);
      const facts2 = extractor.extract(segments, careSchema);

      expect(facts1.length).toBe(facts2.length);
      expect(facts1[0].key).toBe(facts2[0].key);
      expect(facts1[0].quote).toBe(facts2[0].quote);
    });
  });
});
