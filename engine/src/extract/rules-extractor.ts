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
/** A "do not take" or "stop" instruction in the drug's clause, before the drug. */
const NEGATION_CLAUSE = /\b(not|dont|never|avoid|stop|stopping)\b/;
/** "simvastatin 40 mg, we are stopping that": the drug is being stopped. */
const STOPPING_AFTER =
  /^(?:\S+ ){0,6}?(we are|were|i am|im|i'm)? ?(stopping|stop|coming off) (that|it|this|them)\b/;
/** Marker for a field heard with two different values; removed before output. */
const CONFLICT = "\u0000conflict";
/** Words that end a clause when they follow a comma (spoken lists of instructions). */
const CLAUSE_WORDS = /^(and|but|then|or|so|now|plus|also)$/;

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

/** Sentences with their original ending (`raw`) and without it (`text`). */
function sentencesWithEnds(text: string): Array<{ raw: string; text: string }> {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => ({ raw, text: raw.replace(/[.!?]+$/, "").trim() }));
}

/** A question, asked or reported: "Is there a fee?", "People often ask if ...". */
function isQuestion(s: { raw: string; text: string }): boolean {
  return (
    /\?$/.test(s.raw) || /\b(ask|asks|asked|wonder|wondering)\b.*\b(if|whether)\b/i.test(s.text)
  );
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

          if (kind === "drug") {
            const raw = this.medicineFact(
              def,
              segments,
              si,
              positions,
              ai,
              token,
              ai > 0 ? words(normaliseText(anchors[ai - 1].value)).length : 0,
              windowWords,
              detectors,
            );
            if (raw) out.push(raw);
            return;
          }

          const prevAnchor = ai > 0 ? positions[ai - 1] + 1 : 0;
          const nextAnchor =
            ai + 1 < positions.length && positions[ai + 1] >= 0 ? positions[ai + 1] : norm.length;
          const end = Math.min(nextAnchor, at + windowWords);
          const text = norm.slice(prevAnchor, end).join(" ");
          const used = end - at;

          const fields: Record<string, string> = {};
          fields[firstField(def, kind)] = token.value;
          // What a price is "per" is said right after it ("1800 dollars for a single aid"),
          // so look there first; only then before it, never past the next price (red team 18, 19).
          if (def.fields.includes("per")) {
            const per =
              matchPer(norm.slice(at, end).join(" ")) ??
              matchPer(norm.slice(prevAnchor, at).join(" "));
            if (per !== undefined) fields["per"] = per;
          }
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
        const sentences = sentencesWithEnds(segment.text);
        const i = sentences.findIndex((s) =>
          any.some((alt) => matchesCue(alt, piece(segment, s.text), enabled)),
        );
        if (i < 0) continue;
        // A question ("People often ask if we get a commission.") is not what was said
        // about it; keep the answer that follows in the same segment (red team 20).
        const next = sentences[i + 1];
        win.fields[field] =
          isQuestion(sentences[i]) && next ? `${sentences[i].raw} ${next.text}` : sentences[i].text;
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

  /**
   * A medicine fact built from positions, so one medicine never takes another's values
   * (red-team attacks, S27):
   * - The window starts at the start of the clause that names the drug, and never before
   *   the previous drug or after it (values between two drugs belong to the clause they
   *   are in); it ends at the next drug or after `windowWords`.
   * - A drug inside a "do not take" / "stop" clause, or followed by "we are stopping
   *   that", is not a medicine to take.
   * - If two different doses or two different frequencies are heard for one drug
   *   (a correction, "not ten, just five"), that field is left empty: never guessed.
   * - Missing fields may come from the next segment if it names no other drug.
   */
  private medicineFact(
    def: FactDef,
    segments: Segment[],
    si: number,
    positions: number[],
    ai: number,
    token: FlaggedToken,
    prevLength: number,
    windowWords: number,
    detectors: EntityDetector[],
  ): RawFact | null {
    const segment = segments[si];
    const norm = words(normaliseText(segment.text));
    const at = positions[ai];
    const prevDrugEnd = ai > 0 && positions[ai - 1] >= 0 ? positions[ai - 1] + prevLength : 0;
    const nextDrug =
      ai + 1 < positions.length && positions[ai + 1] >= 0 ? positions[ai + 1] : norm.length;

    const clause = clauseStartBefore(segment.text, norm, at);
    // Negation is looked for from the start of this drug's clause, but not before the
    // previous drug ("stop taking simvastatin and start atorvastatin").
    if (NEGATION_CLAUSE.test(norm.slice(Math.max(clause, prevDrugEnd), at).join(" "))) return null;
    const ownLength = words(normaliseText(token.value)).length;
    if (STOPPING_AFTER.test(norm.slice(at + ownLength, nextDrug).join(" "))) return null;

    // Values said before the drug count only if no earlier drug shares its clause; when
    // one does, words between them belong to that earlier drug.
    const sharesClause = ai > 0 && positions[ai - 1] >= clause;
    const start = sharesClause ? at : clause;
    const end = Math.min(nextDrug, at + windowWords);
    const name = firstField(def, "drug");
    const win: Window = { segmentIdx: [si], fields: { [name]: token.value } };
    this.fillMedicine(def, win, segment, norm.slice(start, end).join(" "), detectors);

    const next = segments[si + 1];
    const budget = windowWords - (end - at);
    const missing = def.fields.some(
      (f) => win.fields[f] === undefined && !DESCRIPTION_FIELDS.has(f),
    );
    if (
      next &&
      budget > 0 &&
      missing &&
      !this.tokens(next, detectors).some((t) => t.kind === "drug")
    ) {
      const before = Object.keys(win.fields).length;
      const nextText = words(normaliseText(next.text)).slice(0, budget).join(" ");
      this.fillMedicine(def, win, next, nextText, detectors);
      if (Object.keys(win.fields).length > before) win.segmentIdx.push(si + 1);
    }
    return toRaw(def, win, segments);
  }

  /** Fill dose and frequency only when exactly one distinct value was heard. */
  private fillMedicine(
    def: FactDef,
    win: Window,
    segment: Segment,
    text: string,
    detectors: EntityDetector[],
  ): void {
    const window = piece(segment, text);
    const tokens = this.tokens(window, detectors);
    const distinct = (values: string[]): string | undefined => {
      const seen = [...new Set(values.map((v) => normaliseText(v)))];
      return seen.length === 1 ? values[0] : undefined;
    };
    const doses = tokens.filter((t) => t.kind === "number").map((t) => t.value);
    const mass = doses.filter((v) => MASS_UNIT.test(v));
    const count = doses.filter((v) => COUNT_UNIT.test(v));
    const freqs = tokens.filter((t) => t.kind === "frequency");
    const counted = freqs.filter((t) => COUNT_FREQUENCY.test(t.canonical ?? ""));
    const timed = freqs.filter((t) => TIME_OF_DAY_FREQUENCY.test(t.canonical ?? ""));
    // "twice a day" and "twice daily" are the same frequency; compare canonical forms.
    const oneFreq = (list: FlaggedToken[]): string | undefined =>
      new Set(list.map((t) => t.canonical)).size === 1 ? list[0].value : undefined;

    for (const field of def.fields) {
      if (win.fields[field] !== undefined || DESCRIPTION_FIELDS.has(field)) continue;
      let value: string | undefined;
      if (field === "dose" || field === "strength") {
        value = mass.length > 0 ? distinct(mass) : count.length > 0 ? distinct(count) : undefined;
      } else if (field === "frequency") {
        value =
          counted.length > 0 ? oneFreq(counted) : timed.length > 0 ? oneFreq(timed) : undefined;
      } else if (field === "how_to_take") {
        const first = freqs[0]?.value;
        value = first
          ? sentencesOf(segment.text).find((s) => normaliseText(s).includes(first))
          : undefined;
      } else if (field === "duration") {
        value = text.match(/\bfor (\d+(?:\.\d+)? (?:days?|weeks?|months?|years?))\b/)?.[1];
      }
      if (value !== undefined && value.length > 0) win.fields[field] = value;
    }
    // Once a field has been seen with two values, never fill it from a later segment either.
    for (const field of ["dose", "strength"]) {
      if (
        def.fields.includes(field) &&
        win.fields[field] === undefined &&
        (mass.length > 1 || count.length > 1)
      ) {
        win.fields[field] = CONFLICT;
      }
    }
    if (
      def.fields.includes("frequency") &&
      win.fields["frequency"] === undefined &&
      (counted.length > 1 || timed.length > 1)
    ) {
      win.fields["frequency"] = CONFLICT;
    }
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
          value = matchPer(norm);
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

/**
 * Word index (in the normalised words) where the clause holding word `at` starts.
 * A clause starts after a sentence end, after "," or ";" followed by a joining word
 * ("and", "but", "then", ...), or after "but"/"now" anywhere. Counts words of the
 * original text, so it needs the normalised and original word counts to line up;
 * when they do not, it falls back to the start of the segment.
 */
function clauseStartBefore(original: string, norm: string[], at: number): number {
  const starts = clauseStarts(original, norm);
  let start = 0;
  for (const s of starts) if (s <= at) start = s;
  // "but"/"now" inside a clause also starts a new instruction ("1000 mg, but now take ...").
  for (let i = at - 1; i >= start; i--) if (/^(but|now)$/.test(norm[i])) return i + 1;
  return start;
}

/**
 * Normalised-word indices where clauses start. Clauses end at ". ! ? ;" or at a comma
 * followed by a joining word ("and", "but", "then", ...). Each clause is normalised on
 * its own, so number words ("five hundred") cannot shift positions; if the pieces do not
 * line up with the whole segment, only the segment start is returned.
 */
function clauseStarts(original: string, norm: string[]): number[] {
  const pieces: string[] = [];
  let current = "";
  const tokens = original.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    current += t;
    if (/\s+/.test(t) || t.length === 0) continue;
    const nextWord = tokens.slice(i + 1).find((x) => x.trim().length > 0) ?? "";
    const endsSentence = /[.!?;]["')\]]*$/.test(t);
    const commaJoin = /,$/.test(t) && CLAUSE_WORDS.test(normaliseText(nextWord));
    if (endsSentence || commaJoin) {
      pieces.push(current);
      current = "";
    }
  }
  if (current.trim().length > 0) pieces.push(current);

  const starts: number[] = [];
  let n = 0;
  const joined: string[] = [];
  for (const p of pieces) {
    const w = words(normaliseText(p));
    if (w.length === 0) continue;
    starts.push(n);
    n += w.length;
    joined.push(...w);
  }
  if (joined.length !== norm.length || joined.some((w, i) => w !== norm[i])) return [0];
  return starts.length > 0 ? starts : [0];
}

/** The field an anchor token fills: drug -> name, money -> amount, else the first field. */
function firstField(def: FactDef, kind: string): string {
  if (kind === "drug" && def.fields.includes("name")) return "name";
  if (kind === "money" && def.fields.includes("amount")) return "amount";
  return def.fields[0];
}

/** What a price is for: the pair, one aid, or one ear, as said. */
function matchPer(text: string): string | undefined {
  return text.match(/\b(pair|per hearing aid|per aid|single aid|each|per ear|both ears)\b/)?.[1];
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
    if (win.fields[f] !== undefined && win.fields[f] !== CONFLICT) fields[f] = win.fields[f];
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
