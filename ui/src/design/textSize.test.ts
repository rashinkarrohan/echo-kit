import { describe, expect, it } from "vitest";
import { TEXT_SIZES, TEXT_SIZE_LABELS, readTextSize, saveTextSize } from "./textSize";

function memory(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set("echo:text-size", initial);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe("caption text size preference", () => {
  it("has three sizes with spoken labels", () => {
    expect(TEXT_SIZES).toEqual(["small", "medium", "large"]);
    expect(TEXT_SIZE_LABELS).toEqual({
      small: "Smaller text",
      medium: "Large text",
      large: "Largest text",
    });
  });

  it("defaults to medium when nothing, or something unknown, is stored", () => {
    expect(readTextSize(memory())).toBe("medium");
    expect(readTextSize(memory("huge"))).toBe("medium");
    expect(readTextSize(undefined)).toBe("medium");
  });

  it("reads a saved size", () => {
    expect(readTextSize(memory("large"))).toBe("large");
  });

  it("saves a size, and survives storage that throws", () => {
    const store = memory();
    saveTextSize(store, "small");
    expect(store.data.get("echo:text-size")).toBe("small");
    expect(() =>
      saveTextSize(
        {
          setItem: () => {
            throw new Error("blocked");
          },
        },
        "large",
      ),
    ).not.toThrow();
    expect(
      readTextSize({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe("medium");
  });
});
