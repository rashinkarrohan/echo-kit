/**
 * Rules-based fact extractor for Echo Kit.
 * Deterministic: no model, no network. Driven by each schema fact's cues.
 *
 * - A fact is triggered by an anchor detector token (`anchor: "@drug"`, `"@money"`)
 *   or by a cue phrase (`any: [...]`).
 * - Fields are filled only from what was heard in the window around the trigger
 *   (at most `windowWords` words, default 25). A field that was not heard stays empty;
 *   nothing is ever filled with a placeholder or a canonical code.
 * - When fields are missing, the window may run into the next segment, but never
 *   past another anchor of the same kind (so one medicine never takes another's dose).
 * - Quotes are the original text of whole segments (anchors are segment-level).
 */

import type {
  ConversationSchema,
  EntityDetector,
  Extractor,
  FlaggedToken,
  RawFact,
  Segment,
} from "../types";
import { normaliseText } from "../text/normalise";
import { DRUG_DICTIONARY, detectorsFor, matchesCue } from "../guard/registry";

interface FactDef {
  key: string;
  fields: string[];
  cues?: Record<string, unknown>;
}

interface Window {
  /** Segments that contributed a field, in order */
  segmentIdx: number[];
  fields: Record<string, string>;
}

const DEFAULT_WINDOW_WORDS = 25;
const DESCRIPTION_FIELDS = new Set(["description", "statement"]);
const COUNT_FREQUENCY = /^(\d+\/day|every-\d+-hours|prn)$/;
const TIME_OF_DAY_FREQUENCY = /^(morning|night)$/;
const MASS_UNIT = /\d\s*(mg|mcg|g|ml|milligrams?|grams?|micrograms?|units?)$/;
const COUNT_UNIT = /\d\s*(tablets?|capsules?|drops?|puffs?)$/;
const NEGATION_BEFORE = /\b(not|dont|never|avoid|stop)\b/;

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : [];
}

function words(s: string): string[] {
  return s.length === 0 ? [] : s.split(" ");
}

/** A pseudo-segment so detectors can run on part of a segment. */
function piece(segment: Segment, text: string): Segment {
  return {
    id: segment.id,
    index: segment.index,
    startMs: segment.startMs,
    endMs: segment.endMs,
    text,
  };
}

/** Sentences of the original text, without their final punctuation. */
function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) =>
      s
        .trim()
        .replace(/[.!?]+$/, "")
        .trim(),
    )
    .filter((s) => s.length > 0);
}

/** Word index in normalised text where `value` (normalised) occurs, searching from word `from`. */
function wordIndexOf(normWords: string[], value: string, from: number): number {
  const target = words(normaliseText(value));
  if (target.length === 0) return -1;
  for (let i = from; i + target.length <= normWords.length; i++) {
    if (target.every((w, j) => normWords[i + j] === w)) return i;
  }
  return -1;
}

export class RulesExtractor implements Extractor {
  extract(segments: Segment[], schema: ConversationSchema): RawFact[] {
    if (segments.length === 0) return [];
    const detectors = detectorsFor(schema.detectors);
    const facts: RawFact[] = [];
    for (const def of schema.facts as FactDef[]) {
      facts.push(...dedupe(this.extractFact(def, segments, detectors, schema.detectors)));
    }
    return facts;
  }

  private extractFact(
    def: FactDef,
    segments: Segment[],
    detectors: EntityDetector[],
    enabled: string[],
  ): RawFact[] {
    const cues = def.cues ?? {};
    const windowWords =
      typeof cues["windowWords"] === "number" ? cues["windowWords"] : DEFAULT_WINDOW_WORDS;
    const anchor = typeof cues["anchor"] === "string" ? cues["anchor"] : undefined;
    const out: RawFact[] = [];

    if (anchor && anchor.startsWith("@")) {
      const kind = anchor.slice(1);
      const near = asStringArray(cues["near"]);
      segments.forEach((segment, si) => {
        const norm = words(normaliseText(segment.text));
        const anchors = this.tokens(segment, detectors).filter((t) => t.kind === kind);
        let cursor = 0;
        const positions = anchors.map((t) => {
          const at = wordIndexOf(norm, t.value, cursor);
          if (at >= 0) cursor = at + 1;
          return at;
        });
        anchors.forEach((token, ai) => {
          const at = positions[ai];
          if (at < 0) return;
          if (
            kind === "drug" &&
            NEGATION_BEFORE.test(norm.slice(Math.max(0, at - 3), at).join(" "))
          )
            return;
          if (kind === "money" && isMonthly(norm, at, token.value)) return;
          if (near.length > 0 && !near.some((alt) => matchesCue(alt, segment, enabled))) return;

          const prevAnchor = ai > 0 ? positions[ai - 1] + 1 : 0;
          const nextAnchor =
            ai + 1 < positions.length && positions[ai + 1] >= 0 ? positions[ai + 1] : norm.length;
          const end = Math.min(nextAnchor, at + windowWords);
          const text = norm.slice(prevAnchor, end).join(" ");
          const used = end - at;

          const fields: Record<string, string> = {};
          fields[firstField(def, kind)] = token.value;
          const win: Window = { segmentIdx: [si], fields };
          this.fill(def, win, segment, piece(segment, text), detectors);
          this.extend(def, win, segments, si, windowWords - used, detectors, kind);
          const raw = toRaw(def, win, segments);
          if (raw) out.push(raw);
        });
      });
      return out;
    }

    const any = asStringArray(cues["any"]);
    if (any.length === 0) return out;
    segments.forEach((segment, si) => {
      if (!any.some((alt) => matchesCue(alt, segment, enabled))) return;
      const norm = words(normaliseText(segment.text));
      const text = norm.slice(0, windowWords).join(" ");
      const win: Window = { segmentIdx: [si], fields: {} };

      for (const field of def.fields) {
        if (!DESCRIPTION_FIELDS.has(field)) continue;
        const sentence = sentencesOf(segment.text).find((s) =>
          any.some((alt) => matchesCue(alt, piece(segment, s), enabled)),
        );
        if (sentence) win.fields[field] = sentence;
      }
      this.fill(def, win, segment, piece(segment, text), detectors);
      const onlyDescriptions = def.fields.every((f) => DESCRIPTION_FIELDS.has(f));
      if (!onlyDescriptions && Object.keys(win.fields).length > 0) {
        this.extend(def, win, segments, si, windowWords - norm.length, detectors);
      }
      const raw = toRaw(def, win, segments);
      if (raw) out.push(raw);
    });
    return out;
  }

  private tokens(segment: Segment, detectors: EntityDetector[]): FlaggedToken[] {
    return detectors.flatMap((d) => d.detect(segment, DRUG_DICTIONARY));
  }

  /** Try to fill missing fields from the next segment, within the remaining word budget. */
  private extend(
    def: FactDef,
    win: Window,
    segments: Segment[],
    si: number,
    budget: number,
    detectors: EntityDetector[],
    anchorKind?: string,
  ): void {
    const next = segments[si + 1];
    if (!next || budget <= 0) return;
    if (def.fields.every((f) => win.fields[f] !== undefined || DESCRIPTION_FIELDS.has(f))) return;
    if (anchorKind && this.tokens(next, detectors).some((t) => t.kind === anchorKind)) return;

    const text = words(normaliseText(next.text)).slice(0, budget).join(" ");
    const before = Object.keys(win.fields).length;
    this.fill(def, win, next, piece(next, text), detectors);
    if (Object.keys(win.fields).length > before) win.segmentIdx.push(si + 1);
  }

  /** Fill missing token-based fields from a window of normalised text. */
  private fill(
    def: FactDef,
    win: Window,
    segment: Segment,
    window: Segment,
    detectors: EntityDetector[],
  ): void {
    const tokens = this.tokens(window, detectors);
    const norm = window.text;
    const of = (kind: FlaggedToken["kind"]) => tokens.filter((t) => t.kind === kind);

    for (const field of def.fields) {
      if (win.fields[field] !== undefined || DESCRIPTION_FIELDS.has(field)) continue;
      let value: string | undefined;
      switch (field) {
        case "name":
          value = of("drug")[0]?.value;
          break;
        case "dose":
        case "strength": {
          const numbers = of("number").map((t) => t.value);
          value = numbers.find((v) => MASS_UNIT.test(v)) ?? numbers.find((v) => COUNT_UNIT.test(v));
          break;
        }
        case "frequency": {
          const freq = of("frequency");
          value = (
            freq.find((t) => COUNT_FREQUENCY.test(t.canonical ?? "")) ??
            freq.find((t) => TIME_OF_DAY_FREQUENCY.test(t.canonical ?? ""))
          )?.value;
          break;
        }
        case "how_to_take": {
          const freq = of("frequency");
          if (freq.length > 0) {
            const firstValue = freq[0].value;
            value = sentencesOf(segment.text).find((s) => normaliseText(s).includes(firstValue));
          }
          break;
        }
        case "duration":
          value = norm.match(/\bfor (\d+(?:\.\d+)? (?:days?|weeks?|months?|years?))\b/)?.[1];
          break;
        case "when":
          value = of("date")[0]?.value;
          break;
        case "amount":
          value = of("money").find(
            (t) => !isMonthly(words(norm), wordIndexOf(words(norm), t.value, 0), t.value),
          )?.value;
          break;
        case "per":
          value = norm.match(/\b(pair|each|per ear|both ears)\b/)?.[1];
          break;
        case "period":
        case "term":
          value = of("duration").find((t) => /^\d/.test(t.value))?.value;
          break;
        case "terms":
          value = norm.match(
            /\b(full refund|partial refund|money back|refund|exchange|restocking fee)\b/,
          )?.[1];
          break;
        case "rate":
          value = of("percent")[0]?.value;
          break;
        case "monthly": {
          const ws = words(norm);
          value = of("money").find((t) =>
            isMonthly(ws, wordIndexOf(ws, t.value, 0), t.value),
          )?.value;
          break;
        }
        default:
          value = undefined; // unknown field: never guessed
      }
      if (value !== undefined && value.length > 0) win.fields[field] = value;
    }
  }
}

/** The field an anchor token fills: drug -> name, money -> amount, else the first field. */
function firstField(def: FactDef, kind: string): string {
  if (kind === "drug" && def.fields.includes("name")) return "name";
  if (kind === "money" && def.fields.includes("amount")) return "amount";
  return def.fields[0];
}

/** "250 dollars a month": a money token followed by a monthly cue. */
function isMonthly(normWords: string[], at: number, value: string): boolean {
  if (at < 0) return false;
  const after = normWords
    .slice(at + words(normaliseText(value)).length, at + words(normaliseText(value)).length + 2)
    .join(" ");
  return /^(a month|per month|monthly|each month)\b/.test(after);
}

function toRaw(def: FactDef, win: Window, segments: Segment[]): RawFact | null {
  const fields: Record<string, string> = {};
  for (const f of def.fields) {
    if (win.fields[f] !== undefined) fields[f] = win.fields[f];
  }
  if (Object.keys(fields).length === 0) return null;
  const span = win.segmentIdx.map((i) => segments[i]);
  return {
    key: def.key,
    fields,
    quote: span.map((s) => s.text).join(" "),
    segmentIds: span.map((s) => s.id),
  };
}

/** Drop a fact when another fact of the same key has the same fields over an overlapping, shorter span. */
function dedupe(facts: RawFact[]): RawFact[] {
  const same = (a: RawFact, b: RawFact) =>
    JSON.stringify(Object.entries(a.fields).sort()) ===
    JSON.stringify(Object.entries(b.fields).sort());
  return facts.filter(
    (f, i) =>
      !facts.some((g, j) => {
        if (j === i || !same(f, g)) return false;
        if (!g.segmentIds.some((id) => f.segmentIds.includes(id))) return false;
        return (
          g.segmentIds.length < f.segmentIds.length ||
          (g.segmentIds.length === f.segmentIds.length && j < i)
        );
      }),
  );
}
