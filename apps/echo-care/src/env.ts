/** Schemas, sample consults and the query-string switches for Echo Care. */

import { loadSchema, validateSchema } from "@echo/engine";
import type { ConversationSchema } from "@echo/engine";
import type { ScriptedConsult } from "@echo/ui";
import doctorVisitYaml from "../schemas/doctor-visit.yaml?raw";
import care01 from "../../../evals/consults/care-01.json";

function schemaFrom(yaml: string): ConversationSchema {
  const loaded = loadSchema(yaml);
  if (!loaded.ok) throw new Error(loaded.error);
  const valid = validateSchema(loaded.value);
  if (!valid.ok) throw new Error(valid.error);
  return loaded.value;
}

export const DOCTOR_VISIT = schemaFrom(doctorVisitYaml);

/** Scripted consults (actors only) that can run without a microphone: ?sample=<id> */
export const SAMPLES: Record<string, ScriptedConsult> = { "care-01": care01 };

export interface Launch {
  sample?: ScriptedConsult;
  speed: number;
}

export function readLaunch(search: string): Launch {
  const params = new URLSearchParams(search);
  const id = params.get("sample");
  const speed = Number(params.get("speed") ?? "1");
  const sample = id ? SAMPLES[id] : undefined;
  return { ...(sample ? { sample } : {}), speed: Number.isFinite(speed) && speed > 0 ? speed : 1 };
}
