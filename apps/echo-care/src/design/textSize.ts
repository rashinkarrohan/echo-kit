/**
 * Caption text size (design pack, DESIGN-SPEC.md): small, medium, large. Mobile captions are
 * 28, 34 and 40 px; desktop 44, 52 and 60 px. The choice is a display preference only, so it
 * is kept in this browser's local storage and never leaves the device.
 */

export type TextSize = "small" | "medium" | "large";

export const TEXT_SIZES: readonly TextSize[] = ["small", "medium", "large"];

const CAPTION_PX: Record<TextSize, { mobile: number; desktop: number }> = {
  small: { mobile: 28, desktop: 44 },
  medium: { mobile: 34, desktop: 52 },
  large: { mobile: 40, desktop: 60 },
};

const KEY = "echo-care:text-size";

export function captionPx(size: TextSize, desktop: boolean): number {
  return desktop ? CAPTION_PX[size].desktop : CAPTION_PX[size].mobile;
}

export function lineHeightPx(size: TextSize, desktop: boolean): number {
  return Math.round(captionPx(size, desktop) * (desktop ? 1.22 : 1.28));
}

/** Earlier caption lines are smaller: 60% of the caption on a phone, 26/28/30 px on a wide screen. */
export function earlierLinePx(size: TextSize, desktop: boolean): number {
  if (desktop) return { small: 26, medium: 28, large: 30 }[size];
  return Math.max(20, Math.round(captionPx(size, false) * 0.6));
}

/** Labels read by screen readers on the size buttons. */
export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  small: "Smaller text",
  medium: "Large text",
  large: "Largest text",
};

const isTextSize = (value: unknown): value is TextSize =>
  value === "small" || value === "medium" || value === "large";

export function readTextSize(storage: Pick<Storage, "getItem"> | undefined): TextSize {
  try {
    const value = storage?.getItem(KEY);
    return isTextSize(value) ? value : "medium";
  } catch {
    return "medium";
  }
}

export function saveTextSize(storage: Pick<Storage, "setItem"> | undefined, size: TextSize): void {
  try {
    storage?.setItem(KEY, size);
  } catch {
    // Storage can be blocked; the size then lasts until the page is closed.
  }
}
