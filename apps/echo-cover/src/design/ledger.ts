/**
 * What the Echo Cover screens say about the sellers, worked out from the engine's comparison. It
 * only lays recorded values and missing topics side by side. Nothing here ranks a seller, picks a
 * better value or recommends a purchase.
 */

import type { ChecklistResult, QuoteComparisonRow } from "@echo/engine";
import type { TextSize } from "@echo/ui";

/** "A", "A and B", "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export interface RowNote {
  tone: "differ" | "only" | "none" | "same";
  text: string;
}

/** A word for the thing that differs, per topic; "answers" when the topic has no special word. */
const NOUN: Readonly<Record<string, string>> = {
  price: "amounts",
  trial_returns: "terms",
  financing: "terms",
  inclusions: "details",
};

export function rowNote(row: QuoteComparisonRow): RowNote {
  const total = row.cells.length;
  if (total < 2) return { tone: "same", text: "" };
  const said = row.cells.filter((c) => c.value !== null);
  if (said.length === 0) {
    return { tone: "none", text: total === 2 ? "Neither seller said" : "No seller said this" };
  }
  if (said.length < total) {
    return { tone: "only", text: `Only ${joinNames(said.map((c) => c.seller))} said this` };
  }
  if (row.differs) return { tone: "differ", text: `The ${NOUN[row.field] ?? "answers"} differ` };
  return { tone: "same", text: "The same on each" };
}

export interface QuestionChip {
  tone: "said" | "check" | "none";
  word: string;
}

export function questionChip(stamp: ChecklistResult["stamp"]): QuestionChip {
  if (stamp === "Answered") return { tone: "said", word: "Said" };
  if (stamp === "Unclear") return { tone: "check", word: "Check this" };
  return { tone: "none", word: "Not discussed" };
}

/** How many of the chosen question ids are real questions. */
export function plannedCount(chosen: readonly string[], all: readonly string[]): number {
  return chosen.filter((id) => all.includes(id)).length;
}

const CAPTION_PX: Record<TextSize, number> = { small: 22, medium: 26, large: 32 };

/** Live caption size: 26 px on a phone as in the design pack; a fifth larger on a wide screen. */
export function captionPx(size: TextSize, desktop: boolean): number {
  return Math.round(CAPTION_PX[size] * (desktop ? 1.2 : 1));
}

export function captionLineHeight(size: TextSize, desktop: boolean): number {
  return Math.round(captionPx(size, desktop) * 1.38);
}
