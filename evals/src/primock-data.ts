/**
 * PriMock57 (Babylon Health; CC BY 4.0; https://github.com/babylonhealth/primock57): 57 mock
 * UK primary-care consultations with separate doctor and patient audio and human,
 * utterance-level transcripts (Praat TextGrid). Used for evaluation only; the data stays in
 * private/primock57/ and is not committed or shown in the demo.
 *
 * Attribution: Papadopoulos Korfiatis, A., Moramarco, F., Sarac, R. and Savkov, A. (2022),
 * "PriMock57: A Dataset Of Primary Care Mock Consultations", ACL 2022.
 */

export interface Utterance {
  startMs: number;
  endMs: number;
  text: string;
}

/** Transcription marks (<UNSURE>, </UNSURE>, <UNIN/>, <INAUDIBLE/>...) removed; text kept. */
export function cleanTranscript(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Non-empty intervals of the first tier of a Praat TextGrid (long text format). */
export function parseTextGrid(source: string): Utterance[] {
  const out: Utterance[] = [];
  const interval =
    /intervals \[\d+\]:\s*xmin = ([\d.]+)\s*xmax = ([\d.]+)\s*text = "((?:[^"]|"")*)"/g;
  for (const m of source.matchAll(interval)) {
    const text = cleanTranscript(m[3].replace(/""/g, '"'));
    if (text.length === 0) continue;
    out.push({
      startMs: Math.round(parseFloat(m[1]) * 1000),
      endMs: Math.round(parseFloat(m[2]) * 1000),
      text,
    });
  }
  return out;
}
