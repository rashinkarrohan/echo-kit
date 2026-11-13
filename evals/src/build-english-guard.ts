/**
 * Builds engine/data/english-guard.json: ordinary English words that the medicine
 * matcher would otherwise take for a misheard medicine ("aspiring" for aspirin).
 * Source words: /usr/share/dict/web2 (Webster's Second International, public domain,
 * as shipped with macOS and FreeBSD), plus simple inflections (-s, -es, -ed, -ing, -er, -ly).
 * Only the words that near-match a medicine are kept, so the file stays small.
 *
 *   pnpm --filter @echo/evals exec vite-node src/build-english-guard.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { nearMatch } from "../../engine/src/guard/drug-match";
import drugs from "../../engine/data/drugs.json";
import { evalsDir } from "./files";

const exact = new Set(drugs.drugs);
const base = readFileSync("/usr/share/dict/web2", "utf8")
  .split("\n")
  .map((w) => w.trim().toLowerCase())
  .filter((w) => /^[a-z]{4,}$/.test(w));

const forms = new Set<string>();
for (const w of base) {
  forms.add(w);
  forms.add(`${w}s`);
  forms.add(`${w}es`);
  forms.add(`${w}ed`);
  forms.add(`${w}er`);
  forms.add(`${w}ly`);
  forms.add(`${w}ing`);
  if (w.endsWith("e")) {
    forms.add(`${w.slice(0, -1)}ing`);
    forms.add(`${w}d`);
  }
}

const t0 = Date.now();
const guard: string[] = [];
for (const w of forms) {
  if (w.length < 5 || exact.has(w)) continue;
  if (nearMatch(w, drugs.drugs)) guard.push(w);
}
guard.sort();
writeFileSync(
  resolve(evalsDir, "..", "engine/data/english-guard.json"),
  `${JSON.stringify({
    source:
      "/usr/share/dict/web2 (Webster's Second International Dictionary, public domain) plus simple inflections",
    note: "English words that near-match a medicine name in engine/data/drugs.json; never treated as a misheard medicine.",
    words: guard,
  })}\n`,
);
console.log(
  `Checked ${forms.size} word forms in ${Math.round((Date.now() - t0) / 1000)} s; guard has ${guard.length} words.`,
);
