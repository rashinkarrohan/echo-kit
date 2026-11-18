/** Schemas, sample consults and the query-string switches for Echo Care. */

import { loadSchema, validateSchema } from "@echo/engine";
import type { ConversationSchema } from "@echo/engine";
import type { ScriptedConsult } from "@echo/ui";
import doctorVisitYaml from "../schemas/doctor-visit.yaml?raw";
import pharmacyCounterYaml from "../schemas/pharmacy-counter.yaml?raw";
import care01 from "../../../evals/consults/care-01.json";
import care02 from "../../../evals/consults/care-02.json";
import care11 from "../../../evals/consults/care-11.json";

function schemaFrom(yaml: string): ConversationSchema {
  const loaded = loadSchema(yaml);
  if (!loaded.ok) throw new Error(loaded.error);
  const valid = validateSchema(loaded.value);
  if (!valid.ok) throw new Error(valid.error);
  return loaded.value;
}

export type Stage = "doctor" | "pharmacy";

export const SCHEMAS: Record<Stage, ConversationSchema> = {
  doctor: schemaFrom(doctorVisitYaml),
  pharmacy: schemaFrom(pharmacyCounterYaml),
};

/**
 * Scripted outings (actors only) that run without a microphone: ?sample=<id>.
 * "care-01" is the doctor visit care-01 followed by the pharmacy visit care-02.
 * "misheard" is care-11, where the speech engine misheard two medicine names.
 */
export const SAMPLES: Record<string, Record<Stage, ScriptedConsult>> = {
  "care-01": { doctor: care01, pharmacy: care02 },
  misheard: { doctor: care11, pharmacy: care02 },
};

export interface Launch {
  sample?: Record<Stage, ScriptedConsult>;
  speed: number;
  /** Sample consult mode: in-memory, no consent screen, no microphone */
  demo: boolean;
}

export function readLaunch(search: string): Launch {
  const params = new URLSearchParams(search);
  const id = params.get("sample");
  const speed = Number(params.get("speed") ?? "1");
  const sample = id ? SAMPLES[id] : undefined;
  return {
    ...(sample ? { sample } : {}),
    speed: Number.isFinite(speed) && speed > 0 ? speed : 1,
    demo: sample !== undefined && params.get("demo") === "1",
  };
}

import results from "../../../evals/results.json";
import type { EvalSummary } from "@echo/ui";

/** Latest eval results, bundled at build time (written by `pnpm evals`). */
export const EVAL_SUMMARY: EvalSummary = results;
