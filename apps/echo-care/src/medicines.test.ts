import { describe, it, expect } from "vitest";
import {
  addMedicine,
  MAX_MEDICINES,
  removeMedicine,
  insertMedicine,
  capitaliseName,
} from "./medicines";

describe("addMedicine (the user's own medicines list)", () => {
  it("adds a typed name, tidied, keeping how it was written", () => {
    expect(addMedicine([], "  Glimepiride ")).toEqual({ ok: true, value: ["Glimepiride"] });
    expect(addMedicine(["warfarin"], "co-codamol")).toEqual({
      ok: true,
      value: ["warfarin", "co-codamol"],
    });
    expect(addMedicine([], "insulin   glargine")).toEqual({
      ok: true,
      value: ["insulin glargine"],
    });
  });

  it("refuses an empty entry", () => {
    expect(addMedicine([], "   ")).toEqual({ ok: false, error: "empty" });
  });

  it("refuses a dose or other text: names only", () => {
    for (const input of ["metformin 500mg", "x", "<script>", "a".repeat(41), "take 2"]) {
      expect(addMedicine([], input)).toEqual({ ok: false, error: "invalid" });
    }
  });

  it("refuses the same name twice, whatever the case or hyphens", () => {
    expect(addMedicine(["Co-codamol"], "co codamol")).toEqual({ ok: false, error: "duplicate" });
    expect(addMedicine(["warfarin"], "WARFARIN")).toEqual({ ok: false, error: "duplicate" });
  });

  it(`keeps the list to ${MAX_MEDICINES} names`, () => {
    const full = Array.from(
      { length: MAX_MEDICINES },
      (_, i) => `medicine${"abcdefghijklmnopqrstu"[i]}`,
    );
    expect(addMedicine(full, "warfarin")).toEqual({ ok: false, error: "full" });
  });

  it("does not change the list it was given", () => {
    const list = ["warfarin"];
    addMedicine(list, "metformin");
    expect(list).toEqual(["warfarin"]);
  });
});

describe("removeMedicine", () => {
  it("removes one name and leaves the rest in order", () => {
    expect(removeMedicine(["a1", "warfarin", "metformin"], "warfarin")).toEqual([
      "a1",
      "metformin",
    ]);
  });
});

describe("insertMedicine (Undo)", () => {
  it("puts a removed name back where it was", () => {
    expect(insertMedicine(["a1", "metformin"], "warfarin", 1)).toEqual([
      "a1",
      "warfarin",
      "metformin",
    ]);
  });
  it("puts it at the end when the place no longer exists", () => {
    expect(insertMedicine(["a1"], "warfarin", 9)).toEqual(["a1", "warfarin"]);
    expect(insertMedicine(["a1"], "warfarin", -3)).toEqual(["warfarin", "a1"]);
  });
  it("does not add a name twice", () => {
    expect(insertMedicine(["Warfarin"], "warfarin", 0)).toEqual(["Warfarin"]);
  });
  it("does not change the list it was given", () => {
    const list = ["a1"];
    insertMedicine(list, "warfarin", 0);
    expect(list).toEqual(["a1"]);
  });
});
describe("capitaliseName", () => {
  it("capitalises the first letter, as the design does", () => {
    expect(capitaliseName("  metformin ")).toBe("Metformin");
    expect(capitaliseName("co-codamol")).toBe("Co-codamol");
    expect(capitaliseName("")).toBe("");
  });
});
