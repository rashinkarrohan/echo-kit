/**
 * Medicine-name accuracy bench for on-device Whisper (S16 accuracy work).
 * For each WAV in a folder named "NN-voice-<drug>.wav", transcribes with and without a
 * prompt of common medicine names, then reports:
 *   heard   - the exact drug name appears in Whisper's text
 *   found   - the engine's drug detector (full FDA list) names the right drug, either
 *             exactly or as a "sounds like" suggestion (shown as Check this)
 *   dose    - the dose number in the sentence appears in the normalised text
 *
 *   pnpm --filter @echo/evals exec vite-node src/asr-bench.ts <folder> [model] [promptSize]
 *
 * PERSONAL=with|without simulates a user's own medicines list of 5 names put first in the
 * prompt and given to the matcher: "with" includes the clip's medicine plus the next 4 in
 * the bench, "without" is the next 5 only (to measure harm when the medicine is not listed).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AutoProcessor,
  AutoTokenizer,
  WhisperForConditionalGeneration,
  pipeline,
} from "@huggingface/transformers";
import type { Tensor } from "@huggingface/transformers";
import { cleanWhisperText, decodeWav, drugDetector, normaliseText } from "@echo/engine";
import drugs from "../../engine/data/drugs.json";
import { buildMedicinePrompt } from "../../engine/src/asr/prompt";

const folder = resolve(process.argv[2] ?? "../private/asr-bench");
const model = process.argv[3] || "Xenova/whisper-tiny.en";
const promptSize = Number(process.argv[4] ?? "60");
const dtype = (process.argv[5] || "q8") as "q8" | "q4" | "fp32";
/** Non-Whisper models (e.g. Moonshine) run through the pipeline, with no prompt. */
const usePipeline = /moonshine/i.test(model);

const DOSE: Record<string, string> = {};
const BENCH_DRUGS: string[] = [];
for (const line of readFileSync(join(folder, "sentences.tsv"), "utf8").trim().split("\n")) {
  const [drug, text] = line.split("\t");
  DOSE[drug] = normaliseText(text).match(/\d+(?:\.\d+)?/)?.[0] ?? "";
  BENCH_DRUGS.push(drug);
}
const personalMode = process.env.PERSONAL as "with" | "without" | undefined;
/** The simulated personal list for a clip's medicine (see PERSONAL above). */
function personalFor(drug: string): string[] {
  if (personalMode === undefined) return [];
  const at = BENCH_DRUGS.indexOf(drug);
  const next = (k: number): string => BENCH_DRUGS[(at + k) % BENCH_DRUGS.length];
  return personalMode === "with"
    ? [drug, next(1), next(2), next(3), next(4)]
    : [1, 2, 3, 4, 5].map(next);
}

async function main(): Promise<void> {
  if (usePipeline) {
    const asr = await pipeline("automatic-speech-recognition", model, { dtype, device: "cpu" });
    await runAll(
      async (audio) => {
        const out = (await asr(audio)) as { text?: string } | Array<{ text?: string }>;
        const first = Array.isArray(out) ? out[0] : out;
        return cleanWhisperText(first?.text ?? "");
      },
      undefined,
      "",
    );
    return;
  }
  const processor = await AutoProcessor.from_pretrained(model);
  const tokenizer = await AutoTokenizer.from_pretrained(model);
  const whisper = await WhisperForConditionalGeneration.from_pretrained(model, {
    dtype,
    device: "cpu",
  });
  const tok = (t: string): number => tokenizer.convert_tokens_to_ids(t);
  // multilingual models (no ".en") get language and task tokens, as in the app's worker
  const language = /\.en$/i.test(model) ? [] : [tok("<|en|>"), tok("<|transcribe|>")];
  const start = [tok("<|startoftranscript|>"), ...language, tok("<|notimestamps|>")];
  const prompt = buildMedicinePrompt(
    drugs.drugs,
    (s) => tokenizer.encode(s, { add_special_tokens: false }).length,
    {
      maxNames: promptSize,
    },
  );
  const promptIdsFor = (drug: string): number[] => {
    const text = buildMedicinePrompt(
      drugs.drugs,
      (s) => tokenizer.encode(s, { add_special_tokens: false }).length,
      { maxNames: promptSize, priority: personalFor(drug) },
    );
    return tokenizer.encode(text, { add_special_tokens: false });
  };
  async function transcribe(
    audio: Float32Array,
    withPrompt: boolean,
    drug: string,
  ): Promise<string> {
    const { input_features } = (await processor(audio)) as { input_features: Tensor };
    const init = withPrompt ? [tok("<|startofprev|>"), ...promptIdsFor(drug), ...start] : start;
    const out = (await whisper.generate({
      inputs: input_features,
      decoder_input_ids: init,
      max_new_tokens: 100,
    })) as Tensor;
    const ids = (out.tolist() as bigint[][])[0].map(Number).slice(init.length);
    return cleanWhisperText(tokenizer.decode(ids, { skip_special_tokens: true }));
  }

  await runAll(
    (audio, drug) => transcribe(audio, false, drug),
    (audio, drug) => transcribe(audio, true, drug),
    prompt,
  );
}

async function runAll(
  plain: (audio: Float32Array, drug: string) => Promise<string>,
  prompted: ((audio: Float32Array, drug: string) => Promise<string>) | undefined,
  prompt: string,
): Promise<void> {
  const inPrompt = new Set(prompt.toLowerCase().match(/[a-z]+/g) ?? []);
  const files = readdirSync(folder)
    .filter((f) => f.endsWith(".wav"))
    .sort();
  const score = {
    plain: { heard: 0, found: 0, dose: 0, wrong: 0 },
    prompted: { heard: 0, found: 0, dose: 0, wrong: 0 },
  };
  const rows: string[] = [];
  for (const f of files) {
    const drug = f
      .replace(/\.wav$/, "")
      .split("-")
      .slice(2)
      .join("-");
    const wav = decodeWav(readFileSync(join(folder, f)).buffer);
    if (!wav.ok) throw new Error(`${f}: ${wav.error}`);
    for (const mode of ["plain", "prompted"] as const) {
      const run = mode === "plain" ? plain : prompted;
      if (!run) continue;
      const text = await run(wav.value.samples, drug);
      const norm = normaliseText(text);
      const heard = ` ${norm} `.includes(` ${drug} `);
      const tokens = drugDetector.detect(
        { id: "x", index: 0, startMs: 0, endMs: 0, text },
        mode === "prompted" && personalMode !== undefined
          ? { drugs: drugs.drugs, personal: personalFor(drug) }
          : drugs,
      );
      const found = tokens.some((t) => t.value === drug || t.suggestion === drug);
      // A different medicine named or suggested: the harm a looser match can do.
      const wrong =
        !found &&
        tokens.some(
          (t) =>
            t.kind === "drug" &&
            !t.unknownName &&
            (t.suggestion ?? normaliseText(t.value).replace(/ /g, "")) !== drug,
        );
      score[mode].wrong += wrong ? 1 : 0;
      const dose =
        DOSE[drug] !== "" &&
        new RegExp(`(^|[^0-9.])${DOSE[drug].replace(".", "\\.")}(?![0-9])`).test(norm);
      score[mode].heard += heard ? 1 : 0;
      score[mode].found += found ? 1 : 0;
      score[mode].dose += dose ? 1 : 0;
      rows.push(
        `${f.padEnd(34)} ${mode.padEnd(8)} ${heard ? "H" : "-"}${found ? "F" : "-"}${dose ? "D" : "-"}${wrong ? "W" : "-"} ${inPrompt.has(drug) ? "[in prompt]" : "           "} ${text}`,
      );
    }
  }
  console.log(rows.join("\n"));
  console.log(
    `\nmodel ${model} (${dtype}), prompt ${prompted ? prompt.split(",").length : 0} names, ${files.length} clips`,
  );
  for (const mode of ["plain", "prompted"] as const) {
    const s = score[mode];
    console.log(
      `${mode.padEnd(8)} heard ${s.heard}/${files.length}  found ${s.found}/${files.length}  dose ${s.dose}/${files.length}  wrong medicine ${s.wrong}/${files.length}`,
    );
  }
}

void main();
