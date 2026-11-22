import { describe, expect, it } from "vitest";
import { SKINS, SHARED, contrastRatio } from "@echo/ui";
import { PALETTE } from "./palette";

/** Text pairs from the design pack (DESIGN-SPEC.md colour table): [name, text, background, minimum]. */
const PAIRS: Array<[string, string, string, number]> = [
  ["ink on page", PALETTE.ink, PALETTE.page, 4.5],
  ["ink on card", PALETTE.ink, PALETTE.card, 4.5],
  ["text2 on page", PALETTE.text2, PALETTE.page, 4.5],
  ["text2 on card", PALETTE.text2, PALETTE.card, 4.5],
  ["text2 on hero end", PALETTE.text2, "#C8E6DE", 4.5],
  ["white on teal 700", "#FFFFFF", PALETTE.teal700, 4.5],
  ["white on button gradient start", "#FFFFFF", "#0F7A6B", 4.5],
  ["teal 900 on white (outline buttons)", PALETTE.teal900, "#FFFFFF", 4.5],
  ["teal 900 on teal 100 (chips)", PALETTE.teal900, PALETTE.teal100, 4.5],
  ["amber 700 on amber 100", PALETTE.amber700, PALETTE.amber100, 4.5],
  ["ink on highlight yellow", PALETTE.ink, PALETTE.highlight, 4.5],
  ["danger on danger tint", PALETTE.danger, PALETTE.dangerTint, 4.5],
  ["danger on white", PALETTE.danger, "#FFFFFF", 4.5],
  ["white on logo green", "#FFFFFF", PALETTE.logoGreen, 4.5],
  ["white on teal 900 (dark screen)", "#FFFFFF", PALETTE.teal900, 4.5],
  ["highlight yellow on teal 900 (dark screen)", PALETTE.highlight, PALETTE.teal900, 4.5],
  ["ink on tile", PALETTE.ink, "#C9E5DE", 4.5],
  ["small control border on page (3:1 for UI)", PALETTE.border, PALETTE.page, 3],
  ["input border on white (3:1 for UI)", PALETTE.inputBorder, "#FFFFFF", 3],
  ["toggle on state on white (3:1 for UI)", PALETTE.teal700, "#FFFFFF", 3],
  ["focus ring on page (3:1)", SHARED.focus, PALETTE.page, 3],
];

describe("Echo Care design pack colours meet WCAG contrast", () => {
  it.each(PAIRS)("%s", (_name, fg, bg, min) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it("the shared care skin uses the design pack colours", () => {
    const care = SKINS.care;
    expect(care.bg).toBe(PALETTE.page);
    expect(care.ink).toBe(PALETTE.ink);
    expect(care.inkSoft).toBe(PALETTE.text2);
    expect(care.accent).toBe(PALETTE.teal700);
    expect(care.check).toBe(PALETTE.amber700);
    expect(care.flagBg).toBe(PALETTE.highlight);
  });
});
