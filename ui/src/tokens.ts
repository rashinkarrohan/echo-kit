/**
 * Design tokens from docs/appendix/DESIGN-TOKENS.md, as data, so contrast is tested
 * (tokens.test.ts) and styles.css is checked against them.
 *
 * Added by Kiro, not in the appendix (each contrast-tested): `onAccent` (white),
 * `flagBg` (highlight behind flagged words), and for the cover skin the three stamp
 * colours, reused from care.
 */

export type SkinName = "care" | "cover";

export const SHARED = {
  focus: "#1D4ED8",
} as const;

interface SkinTokens {
  bg: string;
  surface: string;
  ink: string;
  inkSoft: string;
  accent: string;
  onAccent: string;
  heard: string;
  check: string;
  notSaid: string;
  missing: string;
  line: string;
  flagBg: string;
}

export const SKINS: Record<SkinName, SkinTokens> = {
  care: {
    bg: "#F6F4EF",
    surface: "#FFFFFF",
    ink: "#101C1A",
    inkSoft: "#44524E",
    accent: "#0A5C51",
    onAccent: "#FFFFFF",
    heard: "#0A5C51",
    check: "#6B3800",
    notSaid: "#2B3A36",
    missing: "#2B3A36",
    line: "#C9D3CF",
    flagBg: "#FFE08A",
  },
  cover: {
    bg: "#F3F6FC",
    surface: "#FFFFFF",
    ink: "#0F1A33",
    inkSoft: "#44506A",
    accent: "#1A4FBA",
    onAccent: "#FFFFFF",
    heard: "#0F2F7A",
    check: "#6B3800",
    notSaid: "#26324D",
    missing: "#26324D",
    line: "#DCE3F1",
    flagBg: "#FFE08A",
  },
};

/** [skin, foreground token, background token, minimum ratio] for every text pair used. */
export const CONTRAST_PAIRS: Array<[SkinName, keyof SkinTokens, keyof SkinTokens, number]> = (
  ["care", "cover"] as const
).flatMap((skin) => [
  [skin, "ink", "bg", 4.5],
  [skin, "ink", "surface", 4.5],
  [skin, "ink", "flagBg", 4.5],
  [skin, "inkSoft", "bg", 4.5],
  [skin, "inkSoft", "surface", 4.5],
  [skin, "accent", "surface", 4.5],
  [skin, "accent", "bg", 4.5],
  [skin, "onAccent", "accent", 4.5],
  [skin, "heard", "surface", 4.5],
  [skin, "check", "surface", 4.5],
  [skin, "notSaid", "surface", 4.5],
  [skin, "missing", "surface", 4.5],
  [skin, "missing", "bg", 4.5],
]);

function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG 2.x contrast ratio of two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
