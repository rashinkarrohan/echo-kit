/**
 * What the eval MCP server's tools return, as plain functions (tested without MCP).
 * Runs are cheap (under a second), so each call runs the suite fresh: answers always
 * reflect the code and consults on disk now.
 */

import { runSuite } from "@echo/evals/suite";
import type { SuiteRun } from "@echo/evals/suite";

export function runEvals(broken: boolean): {
  text: string;
  data: Omit<SuiteRun, "results" | "consults">;
} {
  const run = runSuite(broken);
  const t = run.totals;
  const lines = [
    `Echo Kit evals${broken ? " with the deliberately broken extractor" : ""}: ${run.passed ? "PASSED" : "FAILED"}`,
    `${t.consults} consults; facts kept ${t.kept}/${t.plantedFacts}, dropped ${t.dropped}, invented ${t.invented}, unanchored ${t.unanchored}.`,
    `Flagged-token recall ${(t.flaggedTokenRecall * 100).toFixed(1)}%, checklist accuracy ${(t.checklistAccuracy * 100).toFixed(1)}%.`,
    run.failures.length > 0
      ? `${run.failures.length} failure(s); call list_failures for the list.`
      : "No failures.",
  ];
  const { results: _r, consults: _c, ...data } = run;
  void _r;
  void _c;
  return { text: lines.join("\n"), data };
}

export interface FailingCase {
  id: string;
  failures: string[];
  invented: number;
  dropped: number;
}

export function listFailures(broken: boolean): { text: string; data: FailingCase[] } {
  const run = runSuite(broken);
  const cases = run.results
    .filter((r) => r.failures.length > 0)
    .map((r) => ({ id: r.id, failures: r.failures, invented: r.invented, dropped: r.dropped }));
  const suiteLevel = run.failures.filter((f) => f.includes(" vs "));
  const text =
    cases.length === 0 && suiteLevel.length === 0
      ? "No failing cases."
      : [
          ...cases.map((c) => `${c.id}: ${c.failures.join("; ")}`),
          ...suiteLevel.map((f) => `comparison: ${f}`),
        ].join("\n");
  return { text, data: cases };
}

export function showCase(id: string, broken: boolean): { text: string; data: unknown } | undefined {
  const run = runSuite(broken);
  const result = run.results.find((r) => r.id === id);
  const consult = run.consults.find((c) => c.id === id);
  if (!result || !consult) return undefined;
  const data = {
    id,
    schemaId: consult.schemaId,
    passed: result.failures.length === 0,
    failures: result.failures,
    transcript: consult.segments.map((s) => `${s.id} [${s.startMs}-${s.endMs} ms] ${s.text}`),
    planted: consult.planted,
    accepted: result.facts.map((f) => ({
      key: f.key,
      fields: f.fields,
      stamp: f.stamp,
      quote: f.anchor.quote,
      segmentIds: f.anchor.segmentIds,
    })),
    invented: result.details.inventedFacts,
    dropped: result.details.droppedFacts,
    checklist: result.details.checklist,
    label: result.details.label,
  };
  const text = [
    `${id} (${consult.schemaId}): ${data.passed ? "passes" : `FAILS: ${result.failures.join("; ")}`}`,
    `Invented facts: ${result.invented}. Dropped facts: ${result.dropped}. Unanchored: ${result.unanchored}.`,
    ...result.details.inventedFacts.map(
      (f) => `  invented ${f.key} ${JSON.stringify(f.fields)} from "${f.quote}"`,
    ),
    ...result.details.droppedFacts.map((f) => `  dropped ${f.key} ${JSON.stringify(f.fields)}`),
  ].join("\n");
  return { text, data };
}

export function caseIds(): string[] {
  return runSuite(false).consults.map((c) => c.id);
}
