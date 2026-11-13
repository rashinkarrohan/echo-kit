/**
 * Segmenter: splits a stream of mono audio frames into segments of 3 to 8 seconds.
 *
 * Rules (docs/BUILD-GUIDE.md Step 15):
 * - minimum 3000 ms, maximum 8000 ms;
 * - cut at the first silence of at least 300 ms once the segment is at least 3000 ms;
 * - otherwise cut at 8000 ms;
 * - speech/silence uses an adaptive energy threshold that follows the noise floor.
 *
 * Segments are contiguous and keep every sample. flush() returns the remainder at the
 * end of a recording, which may be shorter than 3 s. Segments with no speech are
 * marked `hasSpeech: false` so they are not sent to the speech engine (which can
 * invent words from silence).
 *
 * The clock starts at the first frame's tMs; later frames are treated as contiguous.
 * Pure: no browser APIs.
 */

export interface AudioSegment {
  id: string;
  index: number;
  startMs: number;
  endMs: number;
  samples: Float32Array;
  hasSpeech: boolean;
}

export interface SegmenterOptions {
  sampleRate: number;
  minMs?: number;
  maxMs?: number;
  silenceMs?: number;
  /** Energy analysis window */
  windowMs?: number;
}

/** RMS below this is always silence, however quiet the room is. */
const ABSOLUTE_MIN_THRESHOLD = 0.003;
/** Speech must be this many times louder than the noise floor. */
const THRESHOLD_FACTOR = 2;
/** Starting noise-floor guess before any audio is heard. */
const INITIAL_NOISE_FLOOR = 0.01;
/** RMS below this is digital silence, not room noise; it never lowers the noise floor. */
const DIGITAL_SILENCE = 0.0003;
/** Per-window step towards a quieter level (about 0.2 s to settle). */
const FLOOR_DOWN_RATE = 0.1;
/** Unbroken "speech" this long means background noise is above the threshold. */
const NOISY_ROOM_MS = 10000;
/** At least this much speech (ms) for a segment to count as containing speech. */
const MIN_SPEECH_MS = 60;

export class Segmenter {
  private readonly sr: number;
  private readonly minSamples: number;
  private readonly maxSamples: number;
  private readonly silenceSamples: number;
  private readonly windowSamples: number;

  private buffer: Float32Array;
  private length = 0;
  private windowFill = 0;
  private windowSumSq = 0;
  private silenceRun = 0;
  private speechSamples = 0;
  private speechRun = 0;
  private minRmsInSpeechRun = Number.POSITIVE_INFINITY;
  private readonly noisyRoomSamples: number;
  private noiseFloor = INITIAL_NOISE_FLOOR;
  private startMs: number | undefined;
  private nextIndex = 0;

  constructor(options: SegmenterOptions) {
    this.sr = options.sampleRate;
    const ms = (v: number) => Math.round((v / 1000) * this.sr);
    this.minSamples = ms(options.minMs ?? 3000);
    this.maxSamples = ms(options.maxMs ?? 8000);
    this.silenceSamples = ms(options.silenceMs ?? 300);
    this.windowSamples = Math.max(1, ms(options.windowMs ?? 20));
    this.noisyRoomSamples = ms(NOISY_ROOM_MS);
    this.buffer = new Float32Array(this.maxSamples);
  }

  /** Add a frame that starts at tMs; returns any segments completed by it. */
  push(frame: Float32Array, tMs: number): AudioSegment[] {
    if (this.startMs === undefined) this.startMs = tMs;
    const done: AudioSegment[] = [];

    for (let i = 0; i < frame.length; i++) {
      const v = frame[i];
      this.buffer[this.length++] = v;
      this.windowSumSq += v * v;
      this.windowFill++;

      if (this.windowFill === this.windowSamples) {
        this.classifyWindow();
        if (this.length >= this.minSamples && this.silenceRun >= this.silenceSamples) {
          done.push(this.cut());
          continue;
        }
      }
      if (this.length === this.maxSamples) {
        done.push(this.cut());
      }
    }
    return done;
  }

  /** End of recording: return the remaining audio as a final segment, if any. */
  flush(): AudioSegment | undefined {
    if (this.length === 0) return undefined;
    if (this.windowFill > 0) this.classifyWindow();
    return this.cut();
  }

  private classifyWindow(): void {
    const rms = Math.sqrt(this.windowSumSq / this.windowFill);
    const threshold = Math.max(this.noiseFloor * THRESHOLD_FACTOR, ABSOLUTE_MIN_THRESHOLD);
    const speech = rms > threshold;

    if (rms < DIGITAL_SILENCE) {
      // exact zeros (encoder priming, muted input) say nothing about the room's noise
    } else if (rms < this.noiseFloor) {
      // follow quieter rooms quickly, but not instantly, so a brief fade-in at the start
      // of a recording does not drag the floor below the room's real noise
      this.noiseFloor += (rms - this.noiseFloor) * FLOOR_DOWN_RATE;
    } else if (!speech && this.silenceRun >= this.silenceSamples) {
      // learn the room only during real pauses, not the quiet dips inside speech
      this.noiseFloor += (rms - this.noiseFloor) * 0.05;
    }

    if (speech) {
      this.silenceRun = 0;
      this.speechSamples += this.windowFill;
      this.speechRun += this.windowFill;
      this.minRmsInSpeechRun = Math.min(this.minRmsInSpeechRun, rms);
      // Unbroken "speech" for this long is a noisy room: raise the floor to its quietest part.
      if (this.speechRun >= this.noisyRoomSamples) {
        this.noiseFloor = Math.max(this.noiseFloor, this.minRmsInSpeechRun);
        this.speechRun = 0;
        this.minRmsInSpeechRun = Number.POSITIVE_INFINITY;
      }
    } else {
      this.silenceRun += this.windowFill;
      this.speechRun = 0;
      this.minRmsInSpeechRun = Number.POSITIVE_INFINITY;
    }
    this.windowFill = 0;
    this.windowSumSq = 0;
  }

  private cut(): AudioSegment {
    const start = this.startMs ?? 0;
    const samples = this.buffer.slice(0, this.length);
    const endMs = start + (this.length / this.sr) * 1000;
    const index = this.nextIndex++;
    const segment: AudioSegment = {
      id: `seg-${String(index + 1).padStart(4, "0")}`,
      index,
      startMs: start,
      endMs,
      samples,
      hasSpeech: this.speechSamples >= (MIN_SPEECH_MS / 1000) * this.sr,
    };

    this.startMs = endMs;
    this.length = 0;
    this.windowFill = 0;
    this.windowSumSq = 0;
    this.silenceRun = 0;
    this.speechSamples = 0;
    return segment;
  }
}
