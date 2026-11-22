import { describe, expect, it } from "vitest";
import {
  TEXT_SIZES,
  captionPx,
  earlierLinePx,
  lineHeightPx,
  readTextSize,
  saveTextSize,
} from "./textSize";

function memory(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set("echo-care:text-size", initial);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe("caption text size (design pack: mobile 28/34/40, desktop 44/52/60)", () => {
  it("maps each size to the design pixel values", () => {
    expect(TEXT_SIZES.map((s) => captionPx(s, false))).toEqual([28, 34, 40]);
    expect(TEXT_SIZES.map((s) => captionPx(s, true))).toEqual([44, 52, 60]);
  });

  it("uses the design line heights (mobile 1.28, desktop 1.22)", () => {
    expect(lineHeightPx("medium", false)).toBe(Math.round(34 * 1.28));
    expect(lineHeightPx("medium", true)).toBe(Math.round(52 * 1.22));
  });

  it("sizes earlier lines from the design pack", () => {
    expect(TEXT_SIZES.map((s) => earlierLinePx(s, false))).toEqual([20, 20, 24]);
    expect(TEXT_SIZES.map((s) => earlierLinePx(s, true))).toEqual([26, 28, 30]);
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
    expect(store.data.get("echo-care:text-size")).toBe("small");
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
