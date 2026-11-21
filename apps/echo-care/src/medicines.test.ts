import { describe, it, expect } from "vitest";
import { addMedicine, MAX_MEDICINES, removeMedicine } from "./medicines";

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
