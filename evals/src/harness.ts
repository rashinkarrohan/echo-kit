/**
 * Eval harness: runs scripted consults through the full engine pipeline from
 * segments (no audio): flag tokens -> extract -> validate -> verify -> gap check,
 * plus label and quote-comparison expectations.
 *
 * Metrics: facts kept, dropped, invented (accepted facts that match no planted fact),
 * unanchored (accepted facts whose quote is not verbatim in their audio; 0 by
 * construction, checked again here independently), field recall, flagged-token
 * recall, checklist accuracy.
 */

import {
  RulesExtractor,
  assertOrdered,
  canonicalFrequency,
  compareLabel,
  compareQuotes,
  containsPhrase,
  flagSegment,
  normaliseText,
  numbersIn,
  quoteRecordFromFacts,
  runPipeline,
} from "@echo/engine";
import type {
  ConversationSchema,
  Extractor,
  LabelFields,
  RawFact,
  Segment,
  Stamp,
  VerifiedFact,
} from "@echo/engine";

export interface PlantedFact {
  key: string;
  fields: Record<string, string>;
  quote: string;
}

export interface Consult {
  id: string;
  app: "echo-care" | "echo-cover";
  schemaId: string;
  seller?: string;
  note?: string;
  segments: Array<{ id: string; startMs: number; endMs: number; text: string }>;
  planted: PlantedFact[];
  plantedGapItemIds: string[];
  /**
   * Checklist results that are not "Answered", beyond the one planted gap. Short red-team
   * consults cover only part of a visit, so other topics are truly not discussed.
   */
  expectedChecklist?: Record<string, Stamp>;
  label?: LabelFields;
  expectedLabelFlags?: string[];
  comparisonWith?: string;
  expectedComparison?: Record<string, string>;
}

export interface ConsultResult {
  id: string;
  schemaId: string;
  seller?: string;
  failures: string[];
  planted: number;
  kept: number;
  dropped: number;
  invented: number;
  unanchored: number;
  rejectedByValidator: number;
  fieldsPlanted: number;
  fieldsKept: number;
  tokensExpected: number;
  tokensFound: number;
  checklistTotal: number;
  checklistCorrect: number;
  details: {
    droppedFacts: PlantedFact[];
    inventedFacts: Array<{ key: string; fields: Record<string, string>; quote: string }>;
    missedTokens: string[];
    checklist: Array<{ id: string; expected: Stamp; actual: Stamp }>;
    label?: { expected: string[]; actual: string[] };
  };
  facts: VerifiedFact[];
}

const STOPWORDS = new Set(
  "a an the and or of to in on for it is you your i we that this with be are do at if but so them they their our my me".split(
    " ",
  ),
);

function contentWords(normalised: string): string[] {
  return normalised
    .split(" ")
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
}

/**
 * Does an extracted value agree with the planted (true) value?
 * - Every number in the extracted value must be in the planted value (an extra number is an invention).
 * - Frequencies compare by canonical form.
 * - Otherwise at least 60% of the planted content words must be in the extracted value.
 */
export function valuesAgree(field: string, said: string, truth: string): boolean {
  const a = normaliseText(said);
  const b = normaliseText(truth);
  const truthNumbers = new Set(numbersIn(b));
  if (numbersIn(a).some((n) => !truthNumbers.has(n))) return false;
  if (a === b) return true;

  if (field === "frequency" || field === "how_to_take") {
    const fa = canonicalFrequency(said);
    const fb = canonicalFrequency(truth);
    if (fa !== undefined && fb !== undefined) return fa === fb;
  }

  const want = contentWords(b);
  if (want.length === 0) return false;
  const have = new Set(contentWords(a));
  const hit = want.filter((w) => have.has(w)).length;
  return hit / want.length >= 0.6;
}

/** An accepted fact matches a planted fact when the key matches and every extracted field agrees. */
export function factMatches(
  fact: { key: string; fields: Record<string, string> },
  planted: PlantedFact,
): boolean {
  if (fact.key !== planted.key) return false;
  return Object.entries(fact.fields).every(([field, value]) => {
    const truth = planted.fields[field];
    return truth !== undefined && valuesAgree(field, value, truth);
  });
}

export function toSegments(consult: Consult): Segment[] {
  return consult.segments.map((s, index) => ({
    id: s.id,
    index,
    startMs: s.startMs,
    endMs: s.endMs,
    text: s.text,
  }));
}

/** Checks on the consult file itself (written by people, so it is checked too). */
export function checkConsult(consult: Consult, schema: ConversationSchema): string[] {
  const problems: string[] = [];
  const segments = toSegments(consult);
  const ordered = assertOrdered(segments);
  if (!ordered.ok) problems.push(`segments: ${ordered.error}`);
  if (new Set(segments.map((s) => s.id)).size !== segments.length)
    problems.push("segments: duplicate ids");
  for (const s of segments) {
    const ms = s.endMs - s.startMs;
    if (ms < 3000 || ms > 8000) problems.push(`segment ${s.id} is ${ms} ms (must be 3000 to 8000)`);
  }

  const transcript = normaliseText(segments.map((s) => s.text).join(" "));
  for (const p of consult.planted) {
    if (!containsPhrase(transcript, normaliseText(p.quote))) {
      problems.push(`planted ${p.key} quote is not verbatim in the transcript: "${p.quote}"`);
    }
    if (!schema.facts.some((f) => f.key === p.key))
      problems.push(`planted key ${p.key} is not in schema ${schema.id}`);
    for (const field of Object.keys(p.fields)) {
      const def = schema.facts.find((f) => f.key === p.key);
      if (def && !def.fields.includes(field))
        problems.push(`planted ${p.key}.${field} is not a schema field`);
    }
  }

  if (consult.plantedGapItemIds.length !== 1)
    problems.push("there must be exactly one planted gap");
  for (const id of Object.keys(consult.expectedChecklist ?? {})) {
    if (!schema.checklist.some((c) => c.id === id))
      problems.push(`expected checklist item ${id} is not in the checklist`);
  }
  for (const id of consult.plantedGapItemIds) {
    if (!schema.checklist.some((c) => c.id === id))
      problems.push(`planted gap ${id} is not in the checklist`);
  }
  if (consult.schemaId !== schema.id)
    problems.push(`schemaId ${consult.schemaId} does not match ${schema.id}`);
  return problems;
}

/** Independent re-check of an accepted fact's anchor. */
function isAnchored(fact: VerifiedFact, segments: Segment[]): boolean {
  const idx = fact.anchor.segmentIds.map((id) => segments.findIndex((s) => s.id === id));
  if (idx.length === 0 || idx.some((i) => i < 0)) return false;
  if (idx.some((v, i) => i > 0 && v !== idx[i - 1] + 1)) return false;
  const span = idx.map((i) => segments[i]);
  if (fact.anchor.startMs !== span[0].startMs || fact.anchor.endMs !== span[span.length - 1].endMs)
    return false;
  const quote = normaliseText(fact.anchor.quote);
  return (
    containsPhrase(normaliseText(span.map((s) => s.text).join(" ")), quote) &&
    containsPhrase(normaliseText(segments.map((s) => s.text).join(" ")), quote)
  );
}

export function runConsult(
  consult: Consult,
  schema: ConversationSchema,
  extractor: Extractor,
): ConsultResult {
  const failures = checkConsult(consult, schema);
  const segments = toSegments(consult);

  const { rejected, facts, checklist: gap } = runPipeline(segments, schema, extractor);

  const unanchored = facts.filter((f) => !isAnchored(f, segments)).length;
  const inventedFacts = facts.filter((f) => !consult.planted.some((p) => factMatches(f, p)));
  const droppedFacts = consult.planted.filter((p) => !facts.some((f) => factMatches(f, p)));

  let fieldsPlanted = 0;
  let fieldsKept = 0;
  for (const p of consult.planted) {
    const total = Object.keys(p.fields).length;
    fieldsPlanted += total;
    const best = Math.max(
      0,
      ...facts
        .filter((f) => factMatches(f, p))
        .map((f) => Object.keys(f.fields).filter((k) => k in p.fields).length),
    );
    fieldsKept += best;
  }

  // Flagged-token recall: numbers and drug names in planted values must be flagged. A count
  // inside a free-text description ("two follow up visits") is only expected when the
  // schema flags numbers at all; Echo Cover flags money, percentages and durations instead.
  const flagsNumbers = schema.detectors.includes("number");
  const flagged = segments
    .flatMap((s) => flagSegment(s, schema))
    .map((t) => normaliseText(t.value));
  const expectedTokens = consult.planted.flatMap((p) =>
    Object.entries(p.fields).flatMap(([field, value]) => {
      const n = normaliseText(value);
      if (field === "name") return [n, ...numbersIn(n)];
      if (!flagsNumbers && (field === "description" || field === "statement")) return [];
      return numbersIn(n);
    }),
  );
  const missedTokens = expectedTokens.filter((t) => !flagged.some((f) => containsPhrase(f, t)));

  const checklist = gap.map((g) => ({
    id: g.item.id,
    expected: consult.plantedGapItemIds.includes(g.item.id)
      ? "Not discussed"
      : (consult.expectedChecklist?.[g.item.id] ?? "Answered"),
    actual: g.stamp,
  }));
  for (const c of checklist) {
    if (c.expected === "Not discussed" && c.actual !== "Not discussed") {
      failures.push(`planted gap ${c.id} was reported as ${c.actual}`);
    }
  }

  let label: ConsultResult["details"]["label"];
  if (consult.label) {
    const actual = [...new Set(compareLabel(facts, consult.label).map((f) => f.field))].sort();
    const expected = [...(consult.expectedLabelFlags ?? [])].sort();
    label = { expected, actual };
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(
        `label flags ${JSON.stringify(actual)} but expected ${JSON.stringify(expected)}`,
      );
    }
  }

  if (inventedFacts.length > 0) failures.push(`${inventedFacts.length} invented fact(s)`);
  if (unanchored > 0) failures.push(`${unanchored} unanchored fact(s)`);

  return {
    id: consult.id,
    schemaId: schema.id,
    ...(consult.seller !== undefined ? { seller: consult.seller } : {}),
    failures,
    planted: consult.planted.length,
    kept: consult.planted.length - droppedFacts.length,
    dropped: droppedFacts.length,
    invented: inventedFacts.length,
    unanchored,
    rejectedByValidator: rejected.length,
    fieldsPlanted,
    fieldsKept,
    tokensExpected: expectedTokens.length,
    tokensFound: expectedTokens.length - missedTokens.length,
    checklistTotal: checklist.length,
    checklistCorrect: checklist.filter((c) => c.expected === c.actual).length,
    details: {
      droppedFacts,
      inventedFacts: inventedFacts.map((f) => ({
        key: f.key,
        fields: f.fields,
        quote: f.anchor.quote,
      })),
      missedTokens,
      checklist,
      ...(label ? { label } : {}),
    },
    facts,
  };
}

/**
 * Comparison expectations: "differs", "same", or "not discussed in <consult id>".
 * Returns failures (empty when every expectation holds).
 */
export function checkComparison(
  consult: Consult,
  self: ConsultResult,
  other: ConsultResult,
  schema: ConversationSchema,
): string[] {
  const expected = consult.expectedComparison ?? {};
  const order = Object.fromEntries(schema.facts.map((f) => [f.key, f.fields]));
  const records = [other, self].map((r) =>
    quoteRecordFromFacts(r.id, r.seller ?? r.id, r.facts, order),
  );
  const rows = compareQuotes(records, Object.keys(expected));
  const failures: string[] = [];

  for (const row of rows) {
    const want = expected[row.field];
    const notIn = want.match(/^not discussed in (\S+)$/);
    if (want === "differs" && !row.differs) failures.push(`${row.field}: expected differs`);
    else if (want === "same" && (row.differs || row.cells.some((c) => c.value === null))) {
      failures.push(`${row.field}: expected the same value from both`);
    } else if (notIn) {
      const missing = row.cells.find((c) => c.conversationId === notIn[1]);
      const present = row.cells.find((c) => c.conversationId !== notIn[1]);
      if (!missing || missing.value !== null)
        failures.push(`${row.field}: expected Not discussed in ${notIn[1]}`);
      if (!present || present.value === null)
        failures.push(`${row.field}: expected a value from the other seller`);
    } else if (!["differs", "same"].includes(want) && !notIn) {
      failures.push(`${row.field}: unknown expectation "${want}"`);
    }
  }
  return failures;
}

/**
 * Deliberately broken extractor for `--break`: claims every segment's last word is a
 * fact. Its quotes are real, so the validator accepts them; the harness must catch
 * them as invented.
 */
export class BrokenExtractor implements Extractor {
  extract(segments: Segment[], schema: ConversationSchema): RawFact[] {
    const def = schema.facts[0];
    if (!def) return [];
    return segments.map((s) => {
      const last =
        s.text
          .replace(/[^A-Za-z\s]/g, " ")
          .trim()
          .split(/\s+/)
          .pop() ?? "";
      return { key: def.key, fields: { [def.fields[0]]: last }, quote: s.text, segmentIds: [s.id] };
    });
  }
}

export function defaultExtractor(broken: boolean): Extractor {
  return broken ? new BrokenExtractor() : new RulesExtractor();
}
