/**
 * `pnpm evals` runs every scripted consult in evals/consults and writes evals/results.json.
 * Exit code 1 if any fact is invented or unanchored, or any consult, label or
 * comparison check fails. `pnpm evals --break` swaps in a broken extractor and must fail.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ConsultResult } from "./harness";
import { evalsDir } from "./files";
import { runSuite } from "./suite";

const broken = process.argv.includes("--break") || process.env["EVALS_BREAK"] === "1";
const fmt = (x: number): string => `${(x * 100).toFixed(1)}%`;

function main(): number {
  const { passed, totals, failures, results: all } = runSuite(broken);

  console.log(`Echo Kit evals${broken ? " (--break: broken extractor)" : ""}`);
  console.log("consult        kept  dropped  invented  unanchored  fields  tokens  checklist");
  for (const r of all) {
    console.log(
      [
        r.id.padEnd(14),
        String(r.kept).padStart(4),
        String(r.dropped).padStart(8),
        String(r.invented).padStart(9),
        String(r.unanchored).padStart(11),
        `${r.fieldsKept}/${r.fieldsPlanted}`.padStart(7),
        `${r.tokensFound}/${r.tokensExpected}`.padStart(7),
        `${r.checklistCorrect}/${r.checklistTotal}`.padStart(10),
      ].join(""),
    );
  }
  console.log(
    `\nTotals: ${totals.consults} consults, kept ${totals.kept}/${totals.plantedFacts}, dropped ${totals.dropped}, invented ${totals.invented}, unanchored ${totals.unanchored}`,
  );
  console.log(
    `Field recall ${fmt(totals.fieldRecall)}, flagged-token recall ${fmt(totals.flaggedTokenRecall)}, checklist accuracy ${fmt(totals.checklistAccuracy)}, label checks ${totals.labelChecks}, comparison checks ${totals.comparisonChecks}`,
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
