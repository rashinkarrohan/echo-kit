#!/usr/bin/env node
// Scaffolds draft eval cases for a new conversation schema (used by the "Scaffold eval
// cases for a new schema" hook). Takes the schema path as an argument, or finds it in
// the hook's JSON on stdin. Drafts go to evals/drafts/ (not run by the harness) with
// TODO markers: a person writes the actor script, then moves the file to evals/consults/.
// Never overwrites an existing draft.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

function findPath() {
  const arg = process.argv.slice(2).find((a) => /\.ya?ml$/.test(a));
  if (arg) return arg;
  try {
    const stdin = readFileSync(0, "utf8");
    const match = stdin.match(/"([^"]*schemas\/[^"]+\.ya?ml)"/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

const schemaPath = findPath();
if (!schemaPath) {
  console.log("Scaffold: no schema path given; nothing to do.");
  process.exit(0);
}
const abs = resolve(root, schemaPath);
if (!existsSync(abs) || !/\/apps\/[^/]+\/schemas\//.test(abs)) {
  console.log(`Scaffold: ${schemaPath} is not a schema under apps/*/schemas; nothing to do.`);
  process.exit(0);
}

const yaml = readFileSync(abs, "utf8");
const id = yaml.match(/^id:\s*(\S+)/m)?.[1];
if (!id) {
  console.log(`Scaffold: ${relative(root, abs)} has no id yet; save it again once it has one.`);
  process.exit(0);
}
const app = abs.match(/\/apps\/([^/]+)\//)[1];
const factKeys = [...yaml.matchAll(/^\s*-\s*key:\s*(\S+)/gm)].map((m) => m[1]);
const checklistIds = [...yaml.matchAll(/^\s*-\s*id:\s*(\S+)/gm)].map((m) => m[1]);

const dir = join(root, "evals", "drafts");
mkdirSync(dir, { recursive: true });
const out = join(dir, `${id}-01.json`);
if (existsSync(out)) {
  console.log(`Scaffold: ${relative(root, out)} already exists; not overwritten.`);
  process.exit(0);
}

const draft = {
  id: `${id}-01`,
  app,
  schemaId: id,
  note: "DRAFT. Scripted by actors only. Write real segments, planted facts and one planted gap, then move to evals/consults/.",
  segments: [
    { id: "seg-0001", startMs: 0, endMs: 5000, text: "TODO: first 3 to 8 seconds of what is said" },
    { id: "seg-0002", startMs: 5000, endMs: 10000, text: "TODO: next segment" },
  ],
  planted: factKeys.map((key) => ({ key, fields: {}, quote: "TODO: verbatim words from the segments" })),
  plantedGapItemIds: checklistIds.length > 0 ? [`TODO: one of ${checklistIds.join(", ")}`] : [],
};
writeFileSync(out, `${JSON.stringify(draft, null, 2)}\n`);
console.log(`Scaffold: wrote ${relative(root, out)} for schema ${id} (${factKeys.length} fact keys, ${checklistIds.length} checklist items).`);
