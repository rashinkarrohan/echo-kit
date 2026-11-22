import { describe, expect, it } from "vitest";
import { SHARED, SKINS, contrastRatio } from "@echo/ui";
import { PALETTE } from "./palette";

/** Text pairs from the design pack: [name, text, background, minimum]. UI parts need 3:1. */
const PAIRS: Array<[string, string, string, number]> = [
  ["ink on page", PALETTE.ink, PALETTE.page, 4.5],
  ["ink on card", PALETTE.ink, PALETTE.card, 4.5],
  ["text2 on page", PALETTE.text2, PALETTE.page, 4.5],
  ["text2 on card", PALETTE.text2, PALETTE.card, 4.5],
  ["text2 on sample chip", PALETTE.text2, PALETTE.sampleBg, 4.5],
  ["text3 on card", PALETTE.text3, PALETTE.card, 4.5],
  ["text3 on sample chip", PALETTE.text3, PALETTE.sampleBg, 4.5],
  ["blue on card", PALETTE.blue, PALETTE.card, 4.5],
  ["white on blue", "#FFFFFF", PALETTE.blue, 4.5],
  ["white on button gradient start", "#FFFFFF", PALETTE.blueTop, 4.5],
  ["navy on blue 100 (Said chip)", PALETTE.navy, PALETTE.blue100, 4.5],
  ["navy on white (outline buttons)", PALETTE.navy, PALETTE.card, 4.5],
  ["text3 on not-discussed chip", PALETTE.text3, PALETTE.notDiscussedBg, 4.5],
  ["amber 700 on amber 100 (Check this)", PALETTE.amber700, PALETTE.amber100, 4.5],
  ["navy on amber 100 (Only X said this)", PALETTE.navy, PALETTE.amber100, 4.5],
  ["navy on blue 100 (differs note)", PALETTE.navy, PALETTE.blue100, 4.5],
  ["navy on sample chip (neither said)", PALETTE.navy, PALETTE.sampleBg, 4.5],
  ["ink on highlight yellow", PALETTE.ink, PALETTE.highlight, 4.5],
  ["blue 100 on hero start", PALETTE.blue100, PALETTE.blue, 4.5],
  ["white on hero start", "#FFFFFF", PALETTE.blue, 4.5],
  ["blue 100 on hero end", PALETTE.blue100, PALETTE.navy, 4.5],
  ["danger on danger tint", PALETTE.danger, PALETTE.dangerTint, 4.5],
  ["danger on white", PALETTE.danger, PALETTE.card, 4.5],
  ["navy on blue 300 (illustration)", PALETTE.navy, PALETTE.blue300, 4.5],
  ["border on page (UI, 3:1)", PALETTE.border, PALETTE.page, 3],
  ["soft border on not-discussed chip (UI, 3:1)", PALETTE.borderSoft, PALETTE.notDiscussedBg, 3],
  ["soft border on white (UI, 3:1)", PALETTE.borderSoft, PALETTE.card, 3],
  ["switch off track on white (UI, 3:1)", PALETTE.borderSoft, PALETTE.card, 3],
  ["focus ring on page (3:1)", SHARED.focus, PALETTE.page, 3],
];

describe("Echo Cover design pack colours meet WCAG contrast", () => {
  it.each(PAIRS)("%s", (_name, fg, bg, min) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it("the shared cover skin uses the design pack colours", () => {
    const cover = SKINS.cover;
    expect(cover.bg).toBe(PALETTE.page);
    expect(cover.ink).toBe(PALETTE.ink);
    expect(cover.inkSoft).toBe(PALETTE.text2);
    expect(cover.accent).toBe(PALETTE.blue);
    expect(cover.check).toBe(PALETTE.amber700);
    expect(cover.flagBg).toBe(PALETTE.highlight);
  });
});
