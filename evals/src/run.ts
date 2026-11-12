/**
 * `pnpm evals` runs every scripted consult in evals/consults and writes evals/results.json.
 * Exit code 1 if any fact is invented or unanchored, or any consult, label or
 * comparison check fails. `pnpm evals --break` swaps in a broken extractor and must fail.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSchema } from "@echo/engine";
import type { ConversationSchema } from "@echo/engine";
import { checkComparison, defaultExtractor, runConsult } from "./harness";
import type { Consult, ConsultResult } from "./harness";

const here = dirname(fileURLToPath(import.meta.url));
const evalsDir = resolve(here, "..");
const root = resolve(evalsDir, "..");
const broken = process.argv.includes("--break") || process.env["EVALS_BREAK"] === "1";

function loadSchemas(): Map<string, ConversationSchema> {
  const schemas = new Map<string, ConversationSchema>();
  for (const app of ["echo-care", "echo-cover"]) {
    const dir = join(root, "apps", app, "schemas");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
      const result = loadSchema(readFileSync(join(dir, file), "utf8"));
      if (!result.ok) throw new Error(`Schema ${app}/${file}: ${result.error}`);
      schemas.set(result.value.id, result.value);
    }
  }
  return schemas;
}

function loadConsults(): Consult[] {
  const dir = join(evalsDir, "consults");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Consult);
}

const pct = (n: number, d: number) => (d === 0 ? 1 : n / d);
const fmt = (x: number) => `${(x * 100).toFixed(1)}%`;

function main(): number {
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
  const sum = (k: keyof ConsultResult) => all.reduce((acc, r) => acc + (r[k] as number), 0);
  const totals = {
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
  const passed = failures.length === 0;

  console.log(`Echo Kit evals${broken ? " (--break: broken extractor)" : ""}`);
  console.log("consult        kept  dropped  invented  unanchored  fields  tokens  checklist");
  for (const r of all) {
    console.log(
      `${r.id.padEnd(14)} ${String(r.kept).padStart(4)}  ${String(r.dropped).padStart(7)}  ${String(r.invented).padStart(8)}  ${String(
        r.unanchored,
      ).padStart(
        10,
      )}  ${`${r.fieldsKept}/${r.fieldsPlanted}`.padStart(6)}  ${`${r.tokensFound}/${r.tokensExpected}`.padStart(
        6,
      )}  ${`${r.checklistCorrect}/${r.checklistTotal}`.padStart(9)}`,
    );
  }
  console.log(
    `\nTotals: ${totals.consults} consults, kept ${totals.kept}/${totals.plantedFacts}, dropped ${totals.dropped}, invented ${totals.invented}, unanchored ${totals.unanchored}`,
  );
  console.log(
    `Field recall ${fmt(totals.fieldRecall)}, flagged-token recall ${fmt(totals.flaggedTokenRecall)}, checklist accuracy ${fmt(
      totals.checklistAccuracy,
    )}, label checks ${totals.labelChecks}, comparison checks ${totals.comparisonChecks}`,
  );

  if (!broken) {
    const resultsPath = join(evalsDir, "results.json");
    let runs = 0;
    if (existsSync(resultsPath)) {
      try {
        runs = (JSON.parse(readFileSync(resultsPath, "utf8")) as { runs?: number }).runs ?? 0;
      } catch {
        runs = 0;
      }
    }
    const out = {
      date: new Date().toISOString(),
      runs: runs + 1,
      extractor: "rules",
      passed,
      totals,
      failures,
      consults: all.map((r) => {
        const rest: Partial<ConsultResult> = { ...r };
        delete rest.facts;
        return rest;
      }),
    };
    writeFileSync(resultsPath, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`Wrote evals/results.json (run ${out.runs})`);
  }

  if (!passed) {
    console.log(`\nFAILED (${failures.length}):`);
    for (const f of failures) console.log(`  - ${f}`);
    return 1;
  }
  console.log("\nPASSED");
  return 0;
}

process.exit(main());
