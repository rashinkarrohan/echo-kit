/**
 * Caption text size shared by both apps: small, medium, large. Each app's design decides the pixel
 * values. The choice is a display preference only, so it is kept in this browser's local storage
 * and never leaves the device.
 */

export type TextSize = "small" | "medium" | "large";

export const TEXT_SIZES: readonly TextSize[] = ["small", "medium", "large"];

const KEY = "echo:text-size";

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
