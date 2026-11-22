/**
 * Real-speech check on PriMock57 (see primock-data.ts for the dataset and attribution).
 * The doctor's channel of each picked consultation goes through the app's live path, on
 * this computer: the engine's Segmenter (3 to 8 s), the Silero speech check, whisper-base.en
 * at 8 bits with the medicine prompt, then the doctor-visit pipeline. The human transcript
 * of the same audio goes through the same pipeline. Comparing the two shows what real
 * speech recognition costs Echo, with no hand-made answers:
 *
 * - medicine names: names in the human transcript that Echo showed (exactly or as "Sounds
 *   like"), and names Echo showed that the doctor never said;
 * - medicine facts: facts built from the human transcript that were also built from the
 *   speech engine's text with agreeing fields, and extra facts with their stamps;
 * - word error rate, for context only (normalisation differs from published figures).
 *
 *   pnpm --filter @echo/evals exec vite-node src/primock.ts [folder]
 * Writes evals/primock-results.json (numbers only; no transcript text).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import {
  AutoProcessor,
  AutoTokenizer,
  WhisperForConditionalGeneration,
} from "@huggingface/transformers";
import type { Tensor } from "@huggingface/transformers";
import {
  DRUG_DICTIONARY,
  Segmenter,
  buildMedicinePrompt,
  cleanWhisperText,
  decodeWav,
  drugDetector,
  exactMedicineNames,
  normaliseText,
  promptOnlyNames,
  runPipeline,
} from "@echo/engine";
import type { Segment, VerifiedFact } from "@echo/engine";
import { SileroVad } from "../../ui/src/platform/silero-vad";
import type { VadTensor } from "../../ui/src/platform/silero-vad";
import { loadSchemas } from "./files";
import { valuesAgree } from "./harness";
import { parseTextGrid } from "./primock-data";

const folder = resolve(process.argv[2] ?? "../private/primock57");
const MODEL = "Xenova/whisper-base.en";
const SR = 16000;
/** NOVAD=1 skips the Silero speech check, to measure what it changes. */
const useVad = process.env.NOVAD !== "1";

interface OrtLike {
  InferenceSession: {
    create(
      bytes: Uint8Array,
    ): Promise<{ run(f: Record<string, unknown>): Promise<Record<string, unknown>> }>;
  };
  Tensor: new (type: string, data: unknown, dims: number[]) => unknown;
}

/** onnxruntime-node comes with @huggingface/transformers; load it from there. */
function loadOrt(): OrtLike {
  const req = createRequire(import.meta.url);
  const transformers = req.resolve("@huggingface/transformers");
  return createRequire(transformers)("onnxruntime-node") as OrtLike;
}

async function makeVad(): Promise<SileroVad> {
  const ort = loadOrt();
  const bytes = readFileSync(resolve("../ui/src/platform/models/silero-vad-v6.onnx"));
  const session = await ort.InferenceSession.create(new Uint8Array(bytes));
  return new SileroVad({
    tensor: (type, data, dims) => new ort.Tensor(type, data, dims) as VadTensor,
    run: async (feeds) => (await session.run(feeds)) as Record<string, VadTensor>,
  });
}

/** Names Echo shows for a text: exact names and "Sounds like" suggestions (not unknown words). */
function shownNames(text: string): string[] {
  return drugDetector
    .detect({ id: "x", index: 0, startMs: 0, endMs: 0, text }, DRUG_DICTIONARY)
    .filter((t) => !t.unknownName)
    .map((t) => (t.suggestion ?? normaliseText(t.value)).replace(/ /g, ""));
}

/** Exact names only (no "Sounds like", no unknown words). */
function exactNames(text: string): string[] {
  return drugDetector
    .detect({ id: "x", index: 0, startMs: 0, endMs: 0, text }, DRUG_DICTIONARY)
    .filter(
      (t) =>
        !t.unknownName &&
        // exact, or an exact name written as separate words ("co-codamol", "co codamol")
        (t.suggestion === undefined || t.suggestion === normaliseText(t.value).replace(/ /g, "")),
    )
    .map((t) => normaliseText(t.value).replace(/ /g, ""));
}

/** One name per medicine: UK, US and old spellings of the same medicine count as one. */
const SAME_DRUG: Record<string, string> = {
  frusemide: "furosemide",
  acetaminophen: "paracetamol",
  albuterol: "salbutamol",
  chlorpheniramine: "chlorphenamine",
  amoxycillin: "amoxicillin",
  lignocaine: "lidocaine",
  cephalexin: "cefalexin",
  glyburide: "glibenclamide",
};
const sameDrug = (n: string): string => SAME_DRUG[n] ?? n;

const FILLERS = new Set(["um", "uh", "er", "erm", "hmm", "mm", "mhm", "ah", "oh"]);
const wordsOf = (t: string): string[] =>
  normaliseText(t)
    .split(" ")
    .filter((w) => w.length > 0 && !FILLERS.has(w));

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

const medicines = (facts: VerifiedFact[]): VerifiedFact[] =>
  facts.filter((f) => f.key === "medicine");
const nameOf = (f: VerifiedFact): string => normaliseText(f.fields["name"] ?? "").replace(/ /g, "");

/** Same medicine: the heard name, or what it sounds like, is the reference name. */
function sameMedicine(heard: VerifiedFact, ref: VerifiedFact): boolean {
  const target = sameDrug(nameOf(ref));
  if (sameDrug(nameOf(heard)) === target) return true;
  return shownNames(heard.fields["name"] ?? "")
    .map(sameDrug)
    .includes(target);
}

function fieldsAgree(heard: VerifiedFact, ref: VerifiedFact): boolean {
  return Object.entries(heard.fields)
    .filter(([k]) => k !== "name")
    .every(([k, v]) => ref.fields[k] !== undefined && valuesAgree(k, v, ref.fields[k]));
}

async function main(): Promise<void> {
  const picked = readFileSync(join(folder, "picked.tsv"), "utf8")
    .split("\n")
    .map((l) => l.split("\t")[0])
    .filter((id) => id.startsWith("day"));
  const schema = loadSchemas().get("doctor-visit");
  if (!schema) throw new Error("no doctor-visit schema");
  const vad = await makeVad();
  const processor = await AutoProcessor.from_pretrained(MODEL);
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
  const whisper = await WhisperForConditionalGeneration.from_pretrained(MODEL, {
    dtype: "q8",
    device: "cpu",
  });
  const tok = (t: string): number => tokenizer.convert_tokens_to_ids(t);
  const prompt = buildMedicinePrompt(
    DRUG_DICTIONARY.drugs,
    (s) => tokenizer.encode(s, { add_special_tokens: false }).length,
  );
  const init = [
    tok("<|startofprev|>"),
    ...tokenizer.encode(prompt, { add_special_tokens: false }),
    tok("<|startoftranscript|>"),
    tok("<|notimestamps|>"),
  ];

  const totals = {
    consults: 0,
    audioMinutes: 0,
    segments: 0,
    segmentsEnergyPassed: 0,
    segmentsSentToWhisper: 0,
    words: 0,
    wordErrors: 0,
    namesSaid: 0,
    namesShown: 0,
    namesWrong: 0,
    refFacts: 0,
    factsMatched: 0,
    factsMatchedFieldsAgree: 0,
    extraFacts: 0,
    extraFactsCheckThis: 0,
    heardFactsCheckThis: 0,
    wordsInSkipped: 0,
    secondHearings: 0,
    matchedButCheckThis: 0,
    heardFacts: 0,
  };
  const perConsult: Array<Record<string, number | string>> = [];

  for (const id of picked) {
    const wav = decodeWav(readFileSync(join(folder, "audio", `${id}_doctor.wav`)).buffer);
    if (!wav.ok || wav.value.sampleRate !== SR) throw new Error(`${id}: expected 16 kHz wav`);
    const samples = wav.value.samples;
    const reference = parseTextGrid(
      readFileSync(join(folder, "transcripts", `${id}_doctor.TextGrid`), "utf8"),
    );

    // The app's live path: 20 ms frames into the Segmenter, then the speech check.
    const seg = new Segmenter({ sampleRate: SR });
    const pieces = [];
    for (let i = 0; i < samples.length; i += 320)
      pieces.push(...seg.push(samples.subarray(i, i + 320), (i / SR) * 1000));
    const last = seg.flush();
    if (last) pieces.push(last);

    // What the speech engine heard is kept next to the data (private), so scoring can be
    // re-run without transcribing again. Delete the file to transcribe again.
    const cacheFile = join(folder, "heard", `${id}${useVad ? "" : "-novad"}.json`);
    const cached = existsSync(cacheFile)
      ? (JSON.parse(readFileSync(cacheFile, "utf8")) as {
          heard: Segment[];
          sent: number;
          passed: number;
          skipped: Array<{ startMs: number; endMs: number }>;
        })
      : undefined;
    const heard: Segment[] = cached?.heard ?? [];
    let sent = cached?.sent ?? 0;
    let passed = cached?.passed ?? 0;
    const skippedNow: Array<{ startMs: number; endMs: number }> = [];
    for (const p of cached ? [] : pieces) {
      let text = "";
      if (p.hasSpeech) {
        passed++;
        if (useVad && !(await vad.hasSpeech(p.samples))) {
          skippedNow.push({ startMs: p.startMs, endMs: p.endMs });
        } else {
          sent++;
          const { input_features } = (await processor(p.samples)) as { input_features: Tensor };
          const out = (await whisper.generate({
            inputs: input_features,
            decoder_input_ids: init,
            max_new_tokens: 120,
          })) as Tensor;
          const ids = (out.tolist() as bigint[][])[0].map(Number).slice(init.length);
          text = cleanWhisperText(tokenizer.decode(ids, { skip_special_tokens: true }));
        }
      }
      heard.push({ id: p.id, index: p.index, startMs: p.startMs, endMs: p.endMs, text });
    }
    if (!cached) {
      mkdirSync(join(folder, "heard"), { recursive: true });
      writeFileSync(cacheFile, JSON.stringify({ heard, sent, passed, skipped: skippedNow }));
    }
    // Second hearing, as the speech worker does: segments whose prompted text has an exact
    // medicine name are heard again without the prompt (cached next to the first hearing).
    const confirmFile = join(folder, "heard", `${id}${useVad ? "" : "-novad"}-confirm.json`);
    const plainById: Record<string, string> = existsSync(confirmFile)
      ? (JSON.parse(readFileSync(confirmFile, "utf8")) as Record<string, string>)
      : {};
    for (const s of heard) {
      if (exactMedicineNames(s.text).length === 0 || s.id in plainById) continue;
      const audio = samples.slice(
        Math.floor((s.startMs / 1000) * SR),
        Math.floor((s.endMs / 1000) * SR),
      );
      const { input_features } = (await processor(audio)) as { input_features: Tensor };
      const plainInit = [tok("<|startoftranscript|>"), tok("<|notimestamps|>")];
      const out = (await whisper.generate({
        inputs: input_features,
        decoder_input_ids: plainInit,
        max_new_tokens: 120,
      })) as Tensor;
      plainById[s.id] = cleanWhisperText(
        tokenizer.decode((out.tolist() as bigint[][])[0].map(Number).slice(plainInit.length), {
          skip_special_tokens: true,
        }),
      );
    }
    writeFileSync(confirmFile, JSON.stringify(plainById));
    let secondHearings = 0;
    for (const s of heard) {
      const plain = plainById[s.id];
      if (plain === undefined) continue;
      secondHearings++;
      const unconfirmed = promptOnlyNames(s.text, plain);
      if (unconfirmed.length > 0) s.unconfirmedNames = unconfirmed;
      else delete s.unconfirmedNames;
    }

    const refSegments: Segment[] = reference.map((u, index) => ({
      id: `ref-${index + 1}`,
      index,
      startMs: u.startMs,
      endMs: u.endMs,
      text: u.text,
    }));

    // Word error rate over the whole consultation (doctor channel).
    const refWords = reference.flatMap((u) => wordsOf(u.text));
    const hypWords = heard.flatMap((s) => wordsOf(s.text));
    const errors = editDistance(refWords, hypWords);

    // Medicine names, once per consultation. "Said" is exact names in the human transcript
    // only (its typos, such as "hypothroidism", must not count as a medicine being said).
    const said = new Set(reference.flatMap((u) => exactNames(u.text)).map(sameDrug));
    const shown = new Set(heard.flatMap((s) => shownNames(s.text)).map(sameDrug));
    const namesShown = [...said].filter((n) => shown.has(n)).length;
    const namesWrong = [...shown].filter((n) => !said.has(n)).length;

    // Speech the speech check held back: human-transcript words whose utterance overlaps a
    // segment the energy gate passed but Silero rejected (an upper bound: overlap only).
    const skipped = cached?.skipped ?? skippedNow;
    const wordsInSkipped = reference
      .filter((u) => skipped.some((s) => u.startMs < s.endMs && u.endMs > s.startMs))
      .reduce((n, u) => {
        const overlap = skipped.reduce(
          (ms, s) => ms + Math.max(0, Math.min(u.endMs, s.endMs) - Math.max(u.startMs, s.startMs)),
          0,
        );
        return (
          n + Math.round((wordsOf(u.text).length * overlap) / Math.max(1, u.endMs - u.startMs))
        );
      }, 0);

    // Medicine facts: human transcript vs speech engine text, same pipeline.
    const ref = medicines(runPipeline(refSegments, schema).facts);
    const hyp = medicines(runPipeline(heard, schema).facts);
    const used = new Set<VerifiedFact>();
    let matched = 0;
    let agree = 0;
    for (const r of ref) {
      const h = hyp.find((x) => !used.has(x) && sameMedicine(x, r));
      if (!h) continue;
      used.add(h);
      matched++;
      if (fieldsAgree(h, r)) agree++;
    }
    const extra = hyp.filter((h) => !used.has(h));
    for (const f of extra) {
      console.log(
        `   extra fact (${f.stamp}): ${JSON.stringify(f.fields)}  quote: "${f.anchor.quote}"`,
      );
    }

    const row = {
      id,
      minutes: +(samples.length / SR / 60).toFixed(1),
      wer: +((100 * errors) / Math.max(1, refWords.length)).toFixed(1),
      namesSaid: said.size,
      namesShown,
      namesWrong,
      refFacts: ref.length,
      factsMatched: matched,
      factsMatchedFieldsAgree: agree,
      extraFacts: extra.length,
      extraFactsCheckThis: extra.filter((f) => f.stamp === "check_this").length,
      wordsInSkipped,
      secondHearings,
      matchedButCheckThis: hyp.filter((h) => used.has(h) && h.stamp === "check_this").length,
    };
    perConsult.push(row);
    console.log(JSON.stringify(row));
    for (const n of [...shown].filter((x) => !said.has(x))) {
      const where = heard.find((s) => shownNames(s.text).includes(n));
      console.log(`   shown but not said: ${n}   (heard: "${where?.text ?? ""}")`);
    }
    for (const n of [...said].filter((x) => !shown.has(x)))
      console.log(`   said but not shown: ${n}`);

    totals.consults++;
    totals.audioMinutes += samples.length / SR / 60;
    totals.segments += pieces.length;
    totals.segmentsEnergyPassed += passed;
    totals.segmentsSentToWhisper += sent;
    totals.words += refWords.length;
    totals.wordErrors += errors;
    totals.namesSaid += said.size;
    totals.namesShown += namesShown;
    totals.namesWrong += namesWrong;
    totals.refFacts += ref.length;
    totals.factsMatched += matched;
    totals.factsMatchedFieldsAgree += agree;
    totals.extraFacts += extra.length;
    totals.extraFactsCheckThis += row.extraFactsCheckThis;
    totals.heardFacts += hyp.length;
    totals.heardFactsCheckThis += hyp.filter((f) => f.stamp === "check_this").length;
    totals.wordsInSkipped += wordsInSkipped;
    totals.secondHearings += secondHearings;
    totals.matchedButCheckThis += row.matchedButCheckThis;
  }

  const summary = {
    dataset: "PriMock57 (Babylon Health, CC BY 4.0), doctor channel",
    date: new Date().toISOString().slice(0, 10),
    setup: `Segmenter 3-8 s${useVad ? " + Silero VAD v6" : " (no speech check)"} + Xenova/whisper-base.en q8 with medicine prompt, Node CPU; doctor-visit schema`,
    totals: {
      ...totals,
      audioMinutes: +totals.audioMinutes.toFixed(1),
      wer: +((100 * totals.wordErrors) / totals.words).toFixed(1),
    },
    perConsult,
  };
  writeFileSync(
    resolve(useVad ? "primock-results.json" : "../private/primock57/primock-results-novad.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  console.log(`\n${JSON.stringify(summary.totals, null, 2)}`);
}

void main();
