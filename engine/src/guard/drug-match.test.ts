import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { matchDrugs, soundKey, soundAlikes } from "./drug-match";
import drugs from "../../data/drugs.json";

const list = drugs.drugs;
const found = (text: string) => matchDrugs(text.toLowerCase().split(/\s+/), list);

describe("soundKey", () => {
  it.each([
    ["paracetamol", "perocetumol"],
    ["cetirizine", "setirisine"],
    ["chlorphenamine", "clorfenamine"],
    ["furosemide", "furosomide"],
  ])("%s sounds like %s", (a, b) => {
    expect(soundKey(a)).toBe(soundKey(b));
  });

  it("keeps different medicines apart", () => {
    expect(soundKey("metformin")).not.toBe(soundKey("metoprolol"));
  });
});

describe("matchDrugs on real speech-engine output (S16 bench)", () => {
  it.each([
    ["take meriforming 500 milligrams", "meriforming", "metformin"],
    ["take merform in 500 milligrams", "merform in", "metformin"],
    ["clorfenamine 4 mg every 6 hours", "clorfenamine", "chlorphenamine"],
    ["furosomide 40 milligrams", "furosomide", "furosemide"],
    ["setirisine 10 milligrams at night", "setirisine", "cetirizine"],
    ["perocetumol 1 gram", "perocetumol", "paracetamol"],
    ["use the cell butimal inhaler", "cell butimal", "salbutamol"],
    ["hydro chlorothiazide 12.5 milligrams", "hydro chlorothiazide", "hydrochlorothiazide"],
    ["ferrosimide 40 milligrams", "ferrosimide", "furosemide"],
  ])("%s -> %s sounds like %s", (text, heard, drug) => {
    const m = found(text).find((x) => x.heard === heard);
    expect(m?.suggestion).toBe(drug);
  });

  it("exact names are found with no suggestion", () => {
    expect(found("start metformin today")).toEqual([
      expect.objectContaining({ heard: "metformin", exact: true }),
    ]);
  });
});

describe("matchDrugs does not flag ordinary speech", () => {
  it("never joins a function word into a name ('a medicine')", () => {
    expect(found("i want to take a medicine which is")).toEqual([]);
  });

  it.each([
    "please come back and see me in three months on a tuesday if you can",
    "your blood pressure is fine but the cough is from the tablets",
    "if you feel very dizzy or you are sick for more than a day call the clinic straight away",
    "my grandson is an aspiring chef he brought biscuits",
    "these are our premium devices and the price is high for the pair",
    "keep the tablets in a cool dry place away from heat and light",
    "you can try them for thirty days and return them for a full refund",
    "good morning please sit down how are you getting on",
    "i am so sorry i was performing the reforming information",
  ])("%s", (text) => {
    expect(found(text).map((m) => m.heard)).toEqual([]);
  });
});

describe("an unknown word just before a dose", () => {
  it.each([
    ["take paramet 500 mg", "paramet"],
    ["take baramet 500 milligrams twice a day", "baramet"],
    ["calpol 5 ml three times a day", "calpol"],
    ["rousatan 50mg once a day", "rousatan"],
    ["lantus 10 units at night", "lantus"],
  ])("%s -> %s is kept as a medicine name Echo does not know", (text, heard) => {
    expect(found(text)).toEqual([
      expect.objectContaining({ heard, exact: false, unknown: true, length: 1 }),
    ]);
    expect(found(text)[0].suggestion).toBeUndefined();
  });
  it.each([
    "start lisinopril 50 sorry 15 milligrams once a day",
    "take 10 milligrams sorry i mean 5 milligrams once a day",
    "not 10 milligrams like your old tablets just 5 milligrams once a day",
    "use paracetamol instead 2 tablets every 6 hours",
    "my grandson brought 500 grams of biscuits",
    "take 500 milligrams twice daily",
    "use the inhaler 2 puffs when you need it",
    "about 5 ml at night",
    "maybe 10 mg at bedtime 10 mg",
    "after breakfast 2 tablets and after dinner 2 tablets",
    "the maximum 8 tablets in a day",
    "you have 15 minutes",
    "for the pain 500 milligrams three times a day",
    "for your knee 2 tablets at night",
    "for the fever 10 ml every 6 hours",
    "with water 2 tablets",
  ])("does not flag ordinary words: %s", (text) => {
    expect(found(text).filter((m) => m.unknown)).toEqual([]);
  });
});
describe("soundAlikes (look-alike, sound-alike medicines)", () => {
  it("prednisone and prednisolone are sound-alikes of each other", () => {
    expect(soundAlikes("prednisone", list)).toContain("prednisolone");
    expect(soundAlikes("prednisolone", list)).toContain("prednisone");
  });

  it("metformin has none", () => {
    expect(soundAlikes("metformin", list)).toEqual([]);
  });
});

describe("matchDrugs with the user's own medicines list", () => {
  const mine = (text: string, personal: string[]) =>
    matchDrugs(text.toLowerCase().split(/\s+/), list, personal);

  // Bench misses (S16, base.en with the medicine prompt) that only a personal list recovers.
  it.each([
    ["blamepiride 2 milligrams with breakfast", "blamepiride", "glimepiride"],
    ["take a dovastatin 20mg at night", "dovastatin", "atorvastatin"],
  ])("'%s': '%s' sounds like %s only when the user listed it", (text, heard, name) => {
    expect(found(text).some((m) => m.suggestion === name)).toBe(false);
    const m = mine(text, [name, "metformin"]).find((x) => x.heard === heard);
    expect(m).toMatchObject({ exact: false, suggestion: name });
  });

  it("never replaces what was heard: a listed name is only a suggestion", () => {
    const m = mine("blamepiride 2 milligrams", ["glimepiride"])[0];
    expect(m.heard).toBe("blamepiride");
    expect(m.exact).toBe(false);
  });

  it("treats a listed name heard exactly as exact, even when it is not in the FDA list", () => {
    expect(found("calpol 5 ml")).toMatchObject([{ heard: "calpol", unknown: true }]);
    expect(mine("calpol 5 ml", ["Calpol"])).toMatchObject([{ heard: "calpol", exact: true }]);
  });

  it("matches a listed name with spaces or hyphens as typed", () => {
    expect(mine("co codamol 2 tablets", ["Co-codamol"])).toMatchObject([
      { heard: "co codamol", suggestion: "co-codamol" },
    ]);
  });

  it("does not take ordinary words for a listed medicine", () => {
    for (const text of [
      "the blame is not yours",
      "take a break first",
      "drink plenty of water",
      "a dove sat in the garden",
    ]) {
      const ms = mine(text, ["glimepiride", "atorvastatin", "warfarin"]);
      expect(ms.filter((m) => m.suggestion !== undefined)).toEqual([]);
    }
  });

  it("does not pull a clearly different heard medicine onto a listed one", () => {
    // metoprolol is exact; a misheard metoprolol stays nearer metoprolol than listed metformin
    expect(mine("metoprolol 25 mg", ["metformin"])).toMatchObject([
      { heard: "metoprolol", exact: true },
    ]);
    expect(mine("metaprylol 25 mg", ["metformin"])[0].suggestion).toBe("metoprolol");
  });

  it("an empty list changes nothing", () => {
    const text = "take meriforming 500 milligrams";
    expect(mine(text, [])).toEqual(found(text));
  });
});

describe("property: a personal list only adds suggestions", () => {
  const vocab = [
    "take",
    "metformin",
    "blamepiride",
    "dovastatin",
    "the",
    "water",
    "500",
    "mg",
    "twice",
    "daily",
    "dove",
    "sat",
    "in",
    "garden",
    "aspirin",
    "meriforming",
    "with",
    "breakfast",
  ];
  it("keeps heard words as heard and never drops an exact name", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...vocab), { minLength: 1, maxLength: 10 }),
        fc.subarray(["glimepiride", "atorvastatin", "warfarin", "Calpol", "co-codamol"]),
        (words, personal) => {
          const withList = matchDrugs(words, list, personal);
          for (const m of withList) {
            expect(m.heard).toBe(words.slice(m.at, m.at + m.length).join(" "));
          }
          for (const m of matchDrugs(words, list).filter((x) => x.exact)) {
            expect(withList).toContainEqual(m);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe("the medicine list itself", () => {
  // Real-speech check on PriMock57 (Nov 22, 2026): "treated" and "dehydrated" were in the
  // list (from FDA substance names such as "dehydrated alcohol"), so a doctor saying
  // "you're dehydrated" was flagged as naming a medicine.
  it("has no everyday English word, or an -ed / -ing / -s form of one", async () => {
    const common = new Set((await import("../../data/common-english.json")).words.split(" "));
    const stems = (w: string): string[] => [
      w,
      w.replace(/ied$/, "y"),
      w.replace(/ed$/, ""),
      w.replace(/d$/, ""),
      w.replace(/ing$/, ""),
      w.replace(/ing$/, "e"),
      w.replace(/s$/, ""),
    ];
    expect(list.filter((name) => stems(name).some((s) => s !== "" && common.has(s)))).toEqual([]);
  });
});
