/**
 * Caption sizes from the Echo Care design pack (DESIGN-SPEC.md): mobile captions are 28, 34 and
 * 40 px; desktop 44, 52 and 60 px.
 */
import type { TextSize } from "@echo/ui";

const CAPTION_PX: Record<TextSize, { mobile: number; desktop: number }> = {
  small: { mobile: 28, desktop: 44 },
  medium: { mobile: 34, desktop: 52 },
  large: { mobile: 40, desktop: 60 },
};

export function captionPx(size: TextSize, desktop: boolean): number {
  return desktop ? CAPTION_PX[size].desktop : CAPTION_PX[size].mobile;
}

export function lineHeightPx(size: TextSize, desktop: boolean): number {
  return Math.round(captionPx(size, desktop) * (desktop ? 1.22 : 1.28));
}

export function earlierLinePx(size: TextSize, desktop: boolean): number {
  if (desktop) return { small: 26, medium: 28, large: 30 }[size];
  return Math.max(20, Math.round(captionPx(size, false) * 0.6));
}
