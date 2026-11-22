/**
 * Picks the PriMock57 consultations where the doctor names medicines (exact names from
 * Echo's medicine list), so the real-speech check spends its time where Echo matters.
 *
 *   pnpm --filter @echo/evals exec vite-node src/primock-pick.ts [folder] [count]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { drugDetector, normaliseText } from "@echo/engine";
import drugs from "../../engine/data/drugs.json";
import { parseTextGrid } from "./primock-data";

const folder = resolve(process.argv[2] ?? "../private/primock57");
const count = Number(process.argv[3] ?? "12");

const rows = readdirSync(join(folder, "transcripts"))
  .filter((f) => f.endsWith("_doctor.TextGrid"))
  .map((f) => {
    const utterances = parseTextGrid(readFileSync(join(folder, "transcripts", f), "utf8"));
    const names = new Set<string>();
    let doses = 0;
    for (const u of utterances) {
      const seg = { id: "x", index: 0, startMs: 0, endMs: 0, text: u.text };
      for (const t of drugDetector.detect(seg, drugs))
        if (t.suggestion === undefined && !t.unknownName) names.add(normaliseText(t.value));
      doses += (
        normaliseText(u.text).match(
          /\b\d+(?:\.\d+)?\s*(?:mg|milligrams?|ml|tablets?|puffs?|capsules?)\b/g,
        ) ?? []
      ).length;
    }
    return { id: f.replace("_doctor.TextGrid", ""), names: [...names], doses };
  })
  .filter((r) => r.names.length > 0)
  .sort((a, b) => b.names.length * 2 + b.doses - (a.names.length * 2 + a.doses));

for (const r of rows.slice(0, count))
  console.log(`${r.id}\t${r.names.join(",")}\tdoses:${r.doses}`);
console.log(
  `\n${rows.length} of 57 consultations have a medicine name from the list in the doctor's speech.`,
);
