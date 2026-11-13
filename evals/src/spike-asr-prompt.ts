/**
 * S16 accuracy spike: does a Whisper text prompt of medicine names help, and how do
 * bigger models compare? Runs on-device (Node, CPU) on the bundled actor clip, split by
 * the engine Segmenter, plus a silent clip to check the prompt does not make Whisper
 * "hear" medicine names that were never said.
 *
 *   pnpm --filter @echo/evals exec vite-node src/spike-asr-prompt.ts [model] [dtype]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AutoProcessor,
  AutoTokenizer,
  WhisperForConditionalGeneration,
} from "@huggingface/transformers";
import type { Tensor } from "@huggingface/transformers";
import { Segmenter, cleanWhisperText, decodeWav } from "@echo/engine";
import { evalsDir } from "./files";

const model = process.argv[2] || "Xenova/whisper-tiny.en";
const dtype = (process.argv[3] || "q8") as "q8" | "fp32";
const PROMPT =
  process.env["PROMPT"] ??
  "Medicines: metformin, amlodipine, atorvastatin, lisinopril, omeprazole, chlorpheniramine, chloroquine.";

async function main(): Promise<void> {
  const wav = decodeWav(
    readFileSync(resolve(evalsDir, "..", "ui/e2e/fixtures/sample-10s.wav")).buffer,
  );
  if (!wav.ok) throw new Error(wav.error);
  const samples = wav.value.samples;

  const processor = await AutoProcessor.from_pretrained(model);
  const tokenizer = await AutoTokenizer.from_pretrained(model);
  const whisper = await WhisperForConditionalGeneration.from_pretrained(model, {
    dtype,
    device: "cpu",
  });

  const id = (t: string): number => {
    const v = tokenizer.convert_tokens_to_ids(t);
    if (typeof v !== "number") throw new Error(`no token ${t}`);
    return v;
  };
  const sot = id("<|startoftranscript|>");
  const prev = id("<|startofprev|>");
  const noTs = id("<|notimestamps|>");
  const promptIds = tokenizer.encode(` ${PROMPT.trim()}`, { add_special_tokens: false });

  async function transcribe(
    audio: Float32Array,
    withPrompt: boolean,
  ): Promise<{ text: string; ms: number }> {
    const { input_features } = (await processor(audio)) as { input_features: Tensor };
    const init = withPrompt ? [prev, ...promptIds, sot, noTs] : [sot, noTs];
    const t0 = performance.now();
    const out = (await whisper.generate({
      inputs: input_features,
      decoder_input_ids: init,
      max_new_tokens: 120,
    })) as Tensor;
    const ms = performance.now() - t0;
    const ids = (out.tolist() as bigint[][])[0].map(Number).slice(init.length);
    return {
      text: cleanWhisperText(tokenizer.decode(ids, { skip_special_tokens: true })),
      ms: Math.round(ms),
    };
  }

  const segmenter = new Segmenter({ sampleRate: 16000 });
  const segs = [];
  for (let i = 0; i < samples.length; i += 320)
    segs.push(...segmenter.push(samples.subarray(i, i + 320), (i / 16000) * 1000));
  const last = segmenter.flush();
  if (last) segs.push(last);

  const rows: Array<Record<string, unknown>> = [];
  for (const s of segs.filter((x) => x.hasSpeech)) {
    const plain = await transcribe(s.samples, false);
    const prompted = await transcribe(s.samples, true);
    rows.push({
      seg: s.id,
      plain: plain.text,
      plainMs: plain.ms,
      prompted: prompted.text,
      promptedMs: prompted.ms,
    });
  }
  // Quiet room noise, no speech: the prompt must not produce medicine names.
  const noise = new Float32Array(16000 * 4).map(() => (Math.random() - 0.5) * 0.004);
  const silentPlain = await transcribe(noise, false);
  const silentPrompted = await transcribe(noise, true);

  console.log(
    JSON.stringify(
      {
        model,
        dtype,
        prompt: PROMPT,
        rows,
        noise: { plain: silentPlain.text, prompted: silentPrompted.text },
      },
      null,
      2,
    ),
  );
}

void main();
