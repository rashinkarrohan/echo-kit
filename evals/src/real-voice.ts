/**
 * Real-voice check: the owner's own recordings of the sample scripts (docs/RECORDING-SCRIPT.md,
 * release in docs/RELEASES.md) go through the app's default speech set-up (whisper-base.en,
 * 8-bit, medicine prompt, Node CPU), one segment at a time, then through the same pipeline
 * and scoring as `pnpm evals`. This measures what reaches the receipt from real speech,
 * not from typed transcripts.
 *
 *   pnpm --filter @echo/evals exec vite-node src/real-voice.ts [audio folder]
 *
 * The folder holds `<consult>.wav` (16 kHz mono) and `plan.json` (trim and segment times),
 * kept in private/actor-audio/ (not committed). PERSONAL=1 also gives each consult's
 * planted medicine names as the user's own list.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AutoProcessor,
  AutoTokenizer,
  WhisperForConditionalGeneration,
} from "@huggingface/transformers";
import type { Tensor } from "@huggingface/transformers";
import {
  RulesExtractor,
  buildMedicinePrompt,
  buildWordsPrompt,
  cleanWhisperText,
  decodeWav,
  dictionaryWith,
  normaliseText,
} from "@echo/engine";
import type { Segment } from "@echo/engine";
import drugs from "../../engine/data/drugs.json";
import { loadConsults, loadSchemas } from "./files";
import { runConsult } from "./harness";

const folder = resolve(process.argv[2] ?? "../private/actor-audio");
const MODEL = "Xenova/whisper-base.en";
const personal = process.env.PERSONAL === "1";
/**
 * PROMPT=schema (default, as the apps do: a schema's speechWords, else medicine names),
 * PROMPT=medicine (medicine names for every recording) or PROMPT=none.
 */
const mode = (process.env.PROMPT ?? "schema") as "schema" | "medicine" | "none";

interface Plan {
  trimStartMs: number;
  segments: Array<{ id: string; startMs: number; endMs: number }>;
}

async function main(): Promise<void> {
  const plan = JSON.parse(readFileSync(join(folder, "plan.json"), "utf8")) as Record<string, Plan>;
  const consults = loadConsults().filter((c) => c.id in plan);
  const schemas = loadSchemas();
  const processor = await AutoProcessor.from_pretrained(MODEL);
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
  const whisper = await WhisperForConditionalGeneration.from_pretrained(MODEL, {
    dtype: "q8",
    device: "cpu",
  });
  const tok = (t: string): number => tokenizer.convert_tokens_to_ids(t);
  const count = (s: string): number => tokenizer.encode(s, { add_special_tokens: false }).length;

  let words = 0;
  let wordErrors = 0;
  const totals = { planted: 0, kept: 0, invented: 0, inventedCheck: 0, unanchored: 0 };
  for (const consult of consults) {
    const schema = schemas.get(consult.schemaId);
    if (!schema) throw new Error(`no schema ${consult.schemaId}`);
    const mine = personal
      ? consult.planted.flatMap((p) => (p.fields["name"] ? [p.fields["name"]] : []))
      : [];
    // As the app does: the schema's speech words when it has them, else medicine names.
    const prompt =
      mode === "none"
        ? ""
        : mode === "schema" && schema.speechWords
          ? buildWordsPrompt(schema.speechWords, count)
          : buildMedicinePrompt(drugs.drugs, count, { priority: mine });
    const start = [tok("<|startoftranscript|>"), tok("<|notimestamps|>")];
    const init =
      prompt.length > 0
        ? [
            tok("<|startofprev|>"),
            ...tokenizer.encode(prompt, { add_special_tokens: false }),
            ...start,
          ]
        : start;
    const wav = decodeWav(readFileSync(join(folder, `${consult.id}.wav`)).buffer);
    if (!wav.ok) throw new Error(`${consult.id}: ${wav.error}`);
    const rate = wav.value.sampleRate;
    const p = plan[consult.id];
    const heard: Segment[] = [];
    for (const [index, s] of p.segments.entries()) {
      const from = Math.round(((p.trimStartMs + s.startMs) * rate) / 1000);
      const to = Math.round(((p.trimStartMs + s.endMs) * rate) / 1000);
      const audio = wav.value.samples.slice(from, to);
      const { input_features } = (await processor(audio)) as { input_features: Tensor };
      const out = (await whisper.generate({
        inputs: input_features,
        decoder_input_ids: init,
        max_new_tokens: 120,
      })) as Tensor;
      const ids = (out.tolist() as bigint[][])[0].map(Number).slice(init.length);
      const text = cleanWhisperText(tokenizer.decode(ids, { skip_special_tokens: true }));
      heard.push({ id: s.id, index, startMs: s.startMs, endMs: s.endMs, text });
      const script = consult.segments.find((c) => c.id === s.id)?.text ?? "";
      const a = normaliseText(script).split(" ");
      const b = normaliseText(text).split(" ");
      words += a.length;
      wordErrors += editDistance(a, b);
      console.log(`${consult.id} ${s.id}\n  said:  ${script}\n  heard: ${text}`);
    }
    const asHeard = {
      ...consult,
      segments: heard.map((s) => ({ id: s.id, startMs: s.startMs, endMs: s.endMs, text: s.text })),
    };
    const r = runConsult(asHeard, schema, new RulesExtractor({ dictionary: dictionaryWith(mine) }));
    const checkOnes = r.details.inventedFacts.filter((f) =>
      r.facts.some((v) => v.anchor.quote === f.quote && v.stamp === "check_this"),
    ).length;
    totals.planted += r.planted;
    totals.kept += r.kept;
    totals.invented += r.invented;
    totals.inventedCheck += checkOnes;
    totals.unanchored += r.unanchored;
    console.log(
      `  -> kept ${r.kept}/${r.planted}, invented ${r.invented} (${checkOnes} marked Check this), unanchored ${r.unanchored}`,
    );
    for (const f of r.details.inventedFacts)
      console.log(`     invented: ${f.key} ${JSON.stringify(f.fields)}`);
    for (const f of r.details.droppedFacts)
      console.log(`     dropped:  ${f.key} ${JSON.stringify(f.fields)}`);
  }
  console.log(
    `\nreal voice (${personal ? "with" : "without"} a personal list, prompt ${mode}): ${consults.length} recordings, ` +
      `word error rate ${((100 * wordErrors) / words).toFixed(1)}% over ${words} words; ` +
      `facts kept ${totals.kept}/${totals.planted}, invented ${totals.invented} ` +
      `(${totals.inventedCheck} marked Check this), unanchored ${totals.unanchored}`,
  );
}

function editDistance(a: readonly string[], b: readonly string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur.push(
        Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

void main();
