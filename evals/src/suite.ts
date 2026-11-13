/**
 * One full eval run, as data: used by `pnpm evals` (run.ts) and the eval MCP server.
 * Pure apart from reading the consults and schemas from disk.
 */

import { checkComparison, defaultExtractor, runConsult } from "./harness";
import type { Consult, ConsultResult } from "./harness";
import { loadConsults, loadSchemas } from "./files";

export interface SuiteTotals {
  consults: number;
  plantedFacts: number;
  kept: number;
  dropped: number;
  invented: number;
  unanchored: number;
  rejectedByValidator: number;
  fieldRecall: number;
  flaggedTokenRecall: number;
  checklistAccuracy: number;
  labelChecks: number;
  comparisonChecks: number;
}

export interface SuiteRun {
  broken: boolean;
  passed: boolean;
  totals: SuiteTotals;
  failures: string[];
  results: ConsultResult[];
  consults: Consult[];
}

const pct = (n: number, d: number): number => (d === 0 ? 1 : n / d);

/** Run every scripted consult. `broken` swaps in the deliberately broken extractor. */
export function runSuite(broken = false): SuiteRun {
  const schemas = loadSchemas();
  const consults = loadConsults();
  const extractor = defaultExtractor(broken);
  const results = new Map<string, ConsultResult>();
  const failures: string[] = [];

  for (const consult of consults) {
    const schema = schemas.get(consult.schemaId);
    if (!schema) {
      failures.push(`${consult.id}: unknown schema ${consult.schemaId}`);
      continue;
    }
    const result = runConsult(consult, schema, extractor);
    results.set(consult.id, result);
    failures.push(...result.failures.map((f) => `${consult.id}: ${f}`));
  }

  let comparisonChecks = 0;
  for (const consult of consults) {
    if (!consult.comparisonWith) continue;
    const self = results.get(consult.id);
    const other = results.get(consult.comparisonWith);
    const schema = schemas.get(consult.schemaId);
    if (!self || !other || !schema) {
      failures.push(`${consult.id}: comparison partner ${consult.comparisonWith} missing`);
      continue;
    }
    comparisonChecks += 1;
    failures.push(
      ...checkComparison(consult, self, other, schema).map(
        (f) => `${consult.id} vs ${other.id}: ${f}`,
      ),
    );
  }

  const all = [...results.values()];
  const sum = (k: keyof ConsultResult): number => all.reduce((acc, r) => acc + (r[k] as number), 0);
  const totals: SuiteTotals = {
    consults: all.length,
    plantedFacts: sum("planted"),
    kept: sum("kept"),
    dropped: sum("dropped"),
    invented: sum("invented"),
    unanchored: sum("unanchored"),
    rejectedByValidator: sum("rejectedByValidator"),
    fieldRecall: pct(sum("fieldsKept"), sum("fieldsPlanted")),
    flaggedTokenRecall: pct(sum("tokensFound"), sum("tokensExpected")),
    checklistAccuracy: pct(sum("checklistCorrect"), sum("checklistTotal")),
    labelChecks: all.filter((r) => r.details.label).length,
    comparisonChecks,
  };

  return { broken, passed: failures.length === 0, totals, failures, results: all, consults };
}
