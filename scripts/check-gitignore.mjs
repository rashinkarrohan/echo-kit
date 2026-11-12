#!/usr/bin/env node
/**
 * CI guard: fails if .kiro appears anywhere in .gitignore.
 * Required by the Kiroween rules: .kiro must NEVER be gitignored.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const gitignorePath = join(root, ".gitignore");

let content;
try {
  content = readFileSync(gitignorePath, "utf-8");
} catch {
  console.error("Could not read .gitignore");
  process.exit(1);
}

// Split into lines, strip comments, check for any line that would match .kiro
const lines = content.split("\n").map((l) => l.trim());
const offending = lines.filter((line) => {
  if (line.startsWith("#") || line === "") return false;
  // A pattern matches .kiro if it is exactly ".kiro", ".kiro/", "/.kiro", or "/.kiro/"
  return /^\/?.kiro\/?$/.test(line);
});

if (offending.length > 0) {
  console.error(
    "ERROR: .gitignore contains a pattern that would ignore .kiro/:",
  );
  offending.forEach((l) => console.error(`  "${l}"`));
  console.error(
    "The .kiro directory must NEVER appear in .gitignore (Kiroween rule).",
  );
  process.exit(1);
}

console.log("OK: .kiro is not in .gitignore");
process.exit(0);
