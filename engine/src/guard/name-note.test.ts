import { describe, it, expect } from "vitest";
import { medicineNameNote } from "./name-note";
import { DRUG_DICTIONARY } from "./registry";

describe("medicineNameNote (why a heard medicine name needs checking)", () => {
  it("is undefined for an exact name with no sound-alikes", () => {
    expect(medicineNameNote("metformin")).toBeUndefined();
    expect(medicineNameNote("paracetamol")).toBeUndefined();
  });
  it("says what a near match sounds like", () => {
    expect(medicineNameNote("meriforming")).toEqual({ kind: "sounds-like", name: "metformin" });
    expect(medicineNameNote("merform in")).toEqual({ kind: "sounds-like", name: "metformin" });
  });
  it("lists real medicines an exact name could be mixed up with", () => {
    const note = medicineNameNote("prednisone");
    expect(note?.kind).toBe("could-also-be");
    expect(note?.kind === "could-also-be" && note.names).toContain("prednisolone");
  });
  it("says when the name is not one Echo knows", () => {
    expect(medicineNameNote("paramet")).toEqual({ kind: "unknown" });
    expect(medicineNameNote("baramet")).toEqual({ kind: "unknown" });
  });
  it("uses the user's own medicines list when given", () => {
    const mine = { drugs: DRUG_DICTIONARY.drugs, personal: ["Calpol", "glimepiride"] };
    expect(medicineNameNote("calpol")).toEqual({ kind: "unknown" });
    expect(medicineNameNote("calpol", mine)).toBeUndefined();
    expect(medicineNameNote("blamepiride", mine)).toEqual({
      kind: "sounds-like",
      name: "glimepiride",
    });
  });
});
