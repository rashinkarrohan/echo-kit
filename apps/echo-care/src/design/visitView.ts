/**
 * What the Echo Care screens show about one visit, worked out from the receipt. Every value is
 * either taken from the receipt (the words that were said) or counted from it. Nothing is
 * written here that was not said: a missing value stays `undefined` and the screen says "Not said".
 */

import type { Anchor, ChecklistResult, FactStamp, Receipt, VerifiedFact } from "@echo/engine";
import type { Stage } from "../env";

export interface Glance {
  heard: number;
  check: number;
  notSaid: number;
  total: number;
}

/**
 * Heard clearly: facts heard clearly. Check this: facts to check, plus questions whose answer
 * was unclear. Not said: planned questions that were not discussed.
 */
export function glance(receipt: Receipt): Glance {
  const heard = receipt.facts.filter((f) => f.stamp === "heard_clearly").length;
  const check =
    receipt.facts.filter((f) => f.stamp === "check_this").length +
    receipt.checklist.filter((c) => c.stamp === "Unclear").length;
  const notSaid = receipt.checklist.filter((c) => c.stamp === "Not discussed").length;
  return { heard, check, notSaid, total: heard + check + notSaid };
}

export function answeredCount(checklist: readonly ChecklistResult[]): {
  answered: number;
  total: number;
} {
  return {
    answered: checklist.filter((c) => c.stamp === "Answered").length,
    total: checklist.length,
  };
}

export interface FieldRow {
  label: string;
  /** The value as heard; undefined when it was not said */
  value: string | undefined;
}

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export function medicineRows(fact: VerifiedFact, stage: Stage): FieldRow[] {
  const f = fact.fields;
  return stage === "doctor"
    ? [
        { label: "Amount", value: clean(f["dose"]) },
        { label: "How often", value: clean(f["frequency"]) },
        { label: "For how long", value: clean(f["duration"]) },
      ]
    : [
        { label: "Amount", value: clean(f["strength"]) },
        { label: "How to take it", value: clean(f["how_to_take"]) },
      ];
}

const NUMERIC_DATE = /\b\d{1,2}[/.-]\d{1,2}\b/;
const ORDINAL_DAY = /\b\d{1,2}(st|nd|rd|th)\b/i;
const MONTH =
  /\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b/i;
/** "may" is also a common word, so it only counts next to a number. */
const MAY_WITH_NUMBER = /\bmay\s+\d{1,2}\b|\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?may\b/i;

/** True when the words name a calendar date (a month, a day number, or d/m). */
export function hasExactDate(text: string): boolean {
  return (
    NUMERIC_DATE.test(text) ||
    ORDINAL_DAY.test(text) ||
    MONTH.test(text) ||
    MAY_WITH_NUMBER.test(text)
  );
}

export interface NextVisit {
  heard: boolean;
  text?: string;
  quote?: string;
  anchor?: Anchor;
  stamp?: FactStamp;
  exactDate: boolean;
}

export function nextVisit(receipt: Receipt): NextVisit {
  const f = receipt.facts.find((fact) => fact.key === "follow_up");
  if (!f) return { heard: false, exactDate: false };
  const text = clean(f.fields["when"]) ?? clean(f.anchor.quote);
  return {
    heard: true,
    ...(text !== undefined ? { text } : {}),
    quote: f.anchor.quote,
    anchor: f.anchor,
    stamp: f.stamp,
    exactDate: hasExactDate(`${f.fields["when"] ?? ""} ${f.anchor.quote}`),
  };
}

export interface WarningSign {
  quote: string;
  anchor: Anchor;
  stamp: FactStamp;
}

/** The warning-sign sentences that were said, word for word. */
export function warningSigns(receipt: Receipt): WarningSign[] {
  return receipt.facts
    .filter((f) => f.key === "warning_sign")
    .map((f) => ({ quote: f.anchor.quote, anchor: f.anchor, stamp: f.stamp }));
}

const TOPICS: Readonly<Record<string, string>> = {
  "q-medicine-purpose": "what each medicine is for",
  "q-how-to-take": "how much and how often",
  "q-side-effects": "side effects",
  "q-warning-signs": "when to call",
  "q-follow-up": "the next appointment",
  "q-how-when": "how and when to take it",
  "q-missed-dose": "a missed dose",
  "q-avoid": "what to avoid",
};

/** Short topic for an "Ask about ..." button; undefined when the question has no short form. */
export function askTopic(checklistId: string): string | undefined {
  return TOPICS[checklistId];
}

const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** "today", "yesterday", or the date. */
export function dayLabel(timestamp: number, now: number = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return new Date(timestamp).toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

export function sentenceCase(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** One line for the Home "last visit" card: the first medicine heard, else the kind of visit. */
export function lastVisitTitle(receipt: Receipt, stage: Stage): string {
  const medicine = receipt.facts.find((f) => f.key === "medicine");
  const name = clean(medicine?.fields["name"]);
  if (medicine && name) {
    const amount = clean(medicine.fields["dose"]) ?? clean(medicine.fields["strength"]);
    return amount ? `${sentenceCase(name)}, ${amount}` : sentenceCase(name);
  }
  return stage === "doctor" ? "Doctor visit" : "Pharmacy";
}
