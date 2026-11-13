/** Schema, sample sales and query-string switches for Echo Cover. */

import { loadSchema, validateSchema } from "@echo/engine";
import type { ConversationSchema } from "@echo/engine";
import type { ScriptedConsult } from "@echo/ui";
import hearingAidSaleYaml from "../schemas/hearing-aid-sale.yaml?raw";
import cover01 from "../../../evals/consults/cover-01.json";
import cover02 from "../../../evals/consults/cover-02.json";
import cover04 from "../../../evals/consults/cover-04.json";

function schemaFrom(yaml: string): ConversationSchema {
  const loaded = loadSchema(yaml);
  if (!loaded.ok) throw new Error(loaded.error);
  // Not a release build: unverified sources are allowed while CLAIMS.md is being filled.
  const valid = validateSchema(loaded.value);
  if (!valid.ok) throw new Error(valid.error);
  return loaded.value;
}

export const SALE = schemaFrom(hearingAidSaleYaml);

/** Ledger rows (UI-SPEC): price, what is included, trial and returns, financing, commission. */
export const COMPARE_FIELDS = ["price", "inclusions", "trial_returns", "financing", "commission"];

/**
 * Scripted sales (actors, fictional prices) used in order for each seller recorded:
 * ?sample=sales. Seller 1 hears cover-01, seller 2 cover-04, seller 3 cover-02.
 */
export const SAMPLES: Record<string, ScriptedConsult[]> = { sales: [cover01, cover04, cover02] };

export interface Launch {
  samples?: ScriptedConsult[];
  speed: number;
  /** Sample mode: in-memory, no consent screen, no microphone */
  demo: boolean;
}

export function readLaunch(search: string): Launch {
  const params = new URLSearchParams(search);
  const id = params.get("sample");
  const speed = Number(params.get("speed") ?? "1");
  const samples = id ? SAMPLES[id] : undefined;
  return {
    ...(samples ? { samples } : {}),
    speed: Number.isFinite(speed) && speed > 0 ? speed : 1,
    demo: samples !== undefined && params.get("demo") === "1",
  };
}

import results from "../../../evals/results.json";
import type { EvalSummary } from "@echo/ui";

/** Latest eval results, bundled at build time (written by `pnpm evals`). */
export const EVAL_SUMMARY: EvalSummary = results;
