import { describe, it, expect } from "vitest";
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

describe("soundAlikes (look-alike, sound-alike medicines)", () => {
  it("prednisone and prednisolone are sound-alikes of each other", () => {
    expect(soundAlikes("prednisone", list)).toContain("prednisolone");
    expect(soundAlikes("prednisolone", list)).toContain("prednisone");
  });

  it("metformin has none", () => {
    expect(soundAlikes("metformin", list)).toEqual([]);
  });
});
