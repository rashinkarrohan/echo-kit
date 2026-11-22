#!/usr/bin/env node
// Flags advice-like or ranking wording in user-facing copy files (safety steering:
// no medical, legal or financial advice, no dose calculations, no ranking sellers).
// Used by the "Check copy for advice wording" hook. Exit code 1 if anything is found.
// The fixed disclaimers ("It is not medical advice", "does not recommend a purchase")
// are allowed.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;

const PATTERNS = [
  [/\byou should\b/i, "tells the user what to do"],
  [/\byou must (take|stop|buy|not take)\b/i, "tells the user what to do"],
  [/\bwe recommend\b|\brecommended\b/i, "recommends"],
  [/\b(increase|decrease|double|halve|change) (the|your) dose\b/i, "dose advice"],
  [/\b(take|use) (more|less)\b/i, "dose advice"],
  [/\b\d+\s*(mg|milligrams?)\s*(per|\/)\s*(kg|kilogram)/i, "dose calculation"],
  [/\bsafe to (take|stop|buy)\b/i, "safety judgement"],
  [/\bdiagnos(e|is|ed)\b/i, "diagnosis"],
  [/\b(best|cheapest|top pick|good deal|great deal|better value|winner)\b/i, "ranks or rates sellers"],
  [/\b(buy|choose) (this|from)\b/i, "recommends a purchase"],
  [/\bEcho reduces errors\b/i, "unsupported claim (docs/CLAIMS.md)"],
];

const ALLOWED = [
  /not medical advice/gi,
  /not legal or financial advice/gi,
  /does not recommend a purchase/gi,
];

function copyFiles() {
  const files = [join(root, "ui/src/copy.ts")];
  for (const app of readdirSync(join(root, "apps"))) {
    for (const rel of ["src/copy.ts", "src/design/copy.ts"]) {
      const f = join(root, "apps", app, rel);
      if (existsSync(f)) files.push(f);
    }
  }
  return files;
}

const targets = process.argv.slice(2).filter((a) => a.endsWith(".ts"));
const files = targets.length > 0 ? targets : copyFiles();
const findings = [];

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments explain rules; only strings matter
    let text = line;
    for (const allowed of ALLOWED) text = text.replace(allowed, "");
    for (const [re, why] of PATTERNS) {
      if (re.test(text)) findings.push(`${relative(root, file)}:${i + 1}: ${why}: ${line.trim()}`);
    }
  });
}

if (findings.length > 0) {
  console.log("Copy check FAILED (advice-like or ranking wording):");
  for (const f of findings) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`Copy check passed: ${files.length} file(s).`);
