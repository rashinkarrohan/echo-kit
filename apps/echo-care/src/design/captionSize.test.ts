import { describe, expect, it } from "vitest";
import { TEXT_SIZES } from "@echo/ui";
import { captionPx, earlierLinePx, lineHeightPx } from "./captionSize";

describe("Echo Care caption sizes (design pack: mobile 28/34/40, desktop 44/52/60)", () => {
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
});
