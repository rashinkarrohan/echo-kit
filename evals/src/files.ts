/** Loads the app schemas and the scripted consults from disk. */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSchema } from "@echo/engine";
import type { ConversationSchema } from "@echo/engine";
import type { Consult } from "./harness";

const here = dirname(fileURLToPath(import.meta.url));
export const evalsDir = resolve(here, "..");
const root = resolve(evalsDir, "..");

export function loadSchemas(): Map<string, ConversationSchema> {
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

export function loadConsults(): Consult[] {
  const dir = join(evalsDir, "consults");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Consult);
}
