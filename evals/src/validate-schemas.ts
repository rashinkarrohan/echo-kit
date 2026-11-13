/**
 * Validate every conversation schema in apps/*\/schemas (used by the "Validate schemas
 * on save" hook). `--release` also rejects checklist items whose source is unverified.
 * Exit code 1 on any problem.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadSchema, validateSchema } from "@echo/engine";
import { evalsDir } from "./files";

const root = resolve(evalsDir, "..");
const release = process.argv.includes("--release");
const problems: string[] = [];
let checked = 0;

for (const app of readdirSync(join(root, "apps"))) {
  const dir = join(root, "apps", app, "schemas");
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    checked += 1;
    const where = `apps/${app}/schemas/${file}`;
    const loaded = loadSchema(readFileSync(join(dir, file), "utf8"));
    if (!loaded.ok) {
      problems.push(`${where}: ${loaded.error}`);
      continue;
    }
    const valid = validateSchema(loaded.value, { release });
    if (!valid.ok) problems.push(`${where}: ${valid.error}`);
  }
}

if (problems.length > 0) {
  console.log(`Schema check${release ? " (release)" : ""} FAILED:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`Schema check${release ? " (release)" : ""} passed: ${checked} schema(s).`);
