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
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AutoProcessor,
  AutoTokenizer,
  WhisperForConditionalGeneration,
} from "@huggingface/transformers";
import type { Tensor } from "@huggingface/transformers";
import { cleanWhisperText, decodeWav, drugDetector, normaliseText } from "@echo/engine";
import drugs from "../../engine/data/drugs.json";
import { buildMedicinePrompt } from "../../engine/src/asr/prompt";

const folder = resolve(process.argv[2] ?? "../private/asr-bench");
const model = process.argv[3] || "Xenova/whisper-tiny.en";
const promptSize = Number(process.argv[4] ?? "60");

const DOSE: Record<string, string> = {};
for (const line of readFileSync(join(folder, "sentences.tsv"), "utf8").trim().split("\n")) {
  const [drug, text] = line.split("\t");
  DOSE[drug] = normaliseText(text).match(/\d+(?:\.\d+)?/)?.[0] ?? "";
}

async function main(): Promise<void> {
  const processor = await AutoProcessor.from_pretrained(model);
  const tokenizer = await AutoTokenizer.from_pretrained(model);
  const whisper = await WhisperForConditionalGeneration.from_pretrained(model, {
    dtype: "q8",
    device: "cpu",
  });
  const tok = (t: string): number => tokenizer.convert_tokens_to_ids(t);
  const prompt = buildMedicinePrompt(
    drugs.drugs,
    (s) => tokenizer.encode(s, { add_special_tokens: false }).length,
    {
      maxNames: promptSize,
    },
  );
  const promptIds = tokenizer.encode(prompt, { add_special_tokens: false });
  const inPrompt = new Set(prompt.toLowerCase().match(/[a-z]+/g) ?? []);

  async function transcribe(audio: Float32Array, withPrompt: boolean): Promise<string> {
    const { input_features } = (await processor(audio)) as { input_features: Tensor };
    const init = withPrompt
      ? [
          tok("<|startofprev|>"),
          ...promptIds,
          tok("<|startoftranscript|>"),
          tok("<|notimestamps|>"),
        ]
      : [tok("<|startoftranscript|>"), tok("<|notimestamps|>")];
    const out = (await whisper.generate({
      inputs: input_features,
      decoder_input_ids: init,
      max_new_tokens: 100,
    })) as Tensor;
    const ids = (out.tolist() as bigint[][])[0].map(Number).slice(init.length);
    return cleanWhisperText(tokenizer.decode(ids, { skip_special_tokens: true }));
  }

  const files = readdirSync(folder)
    .filter((f) => f.endsWith(".wav"))
    .sort();
  const score = {
    plain: { heard: 0, found: 0, dose: 0 },
    prompted: { heard: 0, found: 0, dose: 0 },
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
      const text = await transcribe(wav.value.samples, mode === "prompted");
      const norm = normaliseText(text);
      const heard = ` ${norm} `.includes(` ${drug} `);
      const tokens = drugDetector.detect({ id: "x", index: 0, startMs: 0, endMs: 0, text }, drugs);
      const found = tokens.some((t) => t.value === drug || t.suggestion === drug);
      const dose =
        DOSE[drug] !== "" &&
        new RegExp(`(^|[^0-9.])${DOSE[drug].replace(".", "\\.")}(?![0-9])`).test(norm);
      score[mode].heard += heard ? 1 : 0;
      score[mode].found += found ? 1 : 0;
      score[mode].dose += dose ? 1 : 0;
      rows.push(
        `${f.padEnd(34)} ${mode.padEnd(8)} ${heard ? "H" : "-"}${found ? "F" : "-"}${dose ? "D" : "-"} ${inPrompt.has(drug) ? "[in prompt]" : "           "} ${text}`,
      );
    }
  }
  console.log(rows.join("\n"));
  console.log(
    `\nmodel ${model}, prompt ${prompt.split(",").length} names (${promptIds.length} tokens), ${files.length} clips`,
  );
  for (const mode of ["plain", "prompted"] as const) {
    const s = score[mode];
    console.log(
      `${mode.padEnd(8)} heard ${s.heard}/${files.length}  found ${s.found}/${files.length}  dose ${s.dose}/${files.length}`,
    );
  }
}

void main();
