import { describe, expect, it } from "vitest";
import { REPEAT_PHRASES, REPEAT_TILES, tileForPrompt } from "./repeat";

describe("Please repeat tiles", () => {
  it("has the four tiles and phrases from the design pack", () => {
    expect(REPEAT_TILES).toEqual(["name", "amount", "often", "all"]);
    expect(REPEAT_PHRASES.name).toBe("Please say the medicine name again.");
    expect(REPEAT_PHRASES.amount).toBe("Please say the amount again.");
    expect(REPEAT_PHRASES.often).toBe("Please say how often again.");
    expect(REPEAT_PHRASES.all).toBe("Please say all of that again.");
  });

  it("preselects the tile that matches what Echo wanted checked", () => {
    expect(tileForPrompt("missing-medicine-name")).toBe("name");
    expect(tileForPrompt("unclear-medicine-name")).toBe("name");
    expect(tileForPrompt("unknown-medicine-name")).toBe("name");
    expect(tileForPrompt("unconfirmed-medicine-name")).toBe("name");
    expect(tileForPrompt("unclear-dose")).toBe("amount");
  });

  it("asks for all of it when there is no specific prompt", () => {
    expect(tileForPrompt(undefined)).toBe("all");
    expect(tileForPrompt("something-else")).toBe("all");
  });
});
