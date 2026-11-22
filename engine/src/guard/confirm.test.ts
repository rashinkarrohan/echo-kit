import { describe, it, expect } from "vitest";
import { exactMedicineNames, promptOnlyNames } from "./confirm";

describe("exactMedicineNames", () => {
  it("lists exact names only, not 'sounds like' words", () => {
    expect(exactMedicineNames("Paracetamol or even meriforming, and ibuprofen.")).toEqual([
      "paracetamol",
      "ibuprofen",
    ]);
    expect(exactMedicineNames("come back in two weeks")).toEqual([]);
  });
});

describe("promptOnlyNames (PriMock57, Nov 22, 2026)", () => {
  it("returns a name the unprompted hearing did not back up", () => {
    expect(
      promptOnlyNames(
        "So, do you use antistamins like acetaminophen?",
        "No. Okay, right. And so do you use anti-stemins like set?",
      ),
    ).toEqual(["acetaminophen"]);
  });

  it("returns nothing when the unprompted hearing backs the names up, even misspelled", () => {
    expect(
      promptOnlyNames(
        "In the interim, increase your brown inhaler to four puffs twice a day and your salbutamol inhalers",
        "In the interim increase your brown inhaler to fall past twice a day and your cell-beautiful inhalers",
      ),
    ).toEqual([]);
  });
});
