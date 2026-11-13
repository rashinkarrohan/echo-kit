/**
 * Medicine-name matching for speech-engine output.
 *
 * Speech engines mishear medicine names in predictable ways: wrong vowels
 * ("perocetumol"), c/s/z and ph/f swaps ("setirisine", "clorfenamine"), voicing swaps,
 * and names split into words ("merform in", "cell butimal"). Matching works on a sound
 * key (consonant skeleton with sound classes merged) plus spelling distance.
 *
 * Safety:
 * - The heard words are always kept; a match only adds a "sounds like" suggestion,
 *   and the verifier stamps any suggested name Check this.
 * - Joins never include function words, so "a medicine" is never one word.
 * - Single heard words that are ordinary English (english-guard.json) are never
 *   near-matched, so "aspiring" or "performing" are not medicines.
 * - soundAlikes() lists real medicines that sound alike (prednisone, prednisolone), so an
 *   exact name can still be marked Check this.
 */

import guard from "../../data/english-guard.json";
import drugsFile from "../../data/drugs.json";

/** Consonant sound skeleton: vowels dropped, sound classes and voicing pairs merged. */
export function soundKey(word: string): string {
  let s = word.toLowerCase().replace(/[^a-z]/g, "");
  if (s.length === 0) return "";
  s = s
    .replace(/sch/g, "sk")
    .replace(/ph/g, "f")
    .replace(/gh/g, "g")
    .replace(/^kn/, "n")
    .replace(/^wr/, "r")
    .replace(/ch/g, "k")
    .replace(/th/g, "t")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/[cqk]/g, "k")
    .replace(/x/g, "ks")
    .replace(/z/g, "s")
    .replace(/v/g, "f")
    .replace(/b/g, "p")
    .replace(/d/g, "t")
    .replace(/g/g, "k")
    .replace(/[hwy]/g, (m, i: number) => (m === "w" && i === 0 ? "w" : ""));
  const first = /^[aeiou]/.test(s) ? "a" : "";
  const consonants = s.replace(/[aeiou]/g, "");
  return (first + consonants).replace(/(.)\1+/g, "$1");
}

function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Words that are never part of a joined name. */
const FUNCTION_WORDS = new Set(
  `a an the of to in on at is it its and or but for with as by be am are was were been this that these those
  my your his her our their me you he she we they i not no so if then than do does did have has had will would
  can could should may might must just very also up down out off over about into from please take taking use
  using give given start keep stop one two three four five six seven eight nine ten some any all each per
  day days daily week weeks month months year years time times once twice morning night evening food mg
  tablet tablets capsule capsules dose doses which what when where who how why there here now new old`.split(
    /\s+/,
  ),
);

const ENGLISH = new Set<string>(guard.words);

interface Entry {
  name: string;
  key: string;
  rank: number;
}

interface Index {
  exact: Set<string>;
  /** Entries by first sound and key length, e.g. "k7" */
  buckets: Map<string, Entry[]>;
  alikes: Map<string, string[]>;
}

const indexes = new WeakMap<readonly string[], Index>();

/**
 * Misheard names are matched only to the most common medicines (drugs.json `common`,
 * ranked by FDA listings); rarer names must be heard exactly. This keeps ordinary phrases
 * ("flared up", "dark urine") from turning into rare medicines.
 */
export const COMMON_NAMES = typeof drugsFile.common === "number" ? drugsFile.common : 850;

function indexFor(drugs: readonly string[]): Index {
  const cached = indexes.get(drugs);
  if (cached) return cached;
  const buckets = new Map<string, Entry[]>();
  drugs.forEach((name, rank) => {
    if (rank >= COMMON_NAMES) return;
    const key = soundKey(name);
    if (key.length === 0) return;
    const b = `${key[0]}${key.length}`;
    const list = buckets.get(b) ?? [];
    list.push({ name, key, rank });
    buckets.set(b, list);
  });
  const index: Index = { exact: new Set(drugs), buckets, alikes: new Map() };
  indexes.set(drugs, index);
  return index;
}

/** Most sound-key edits allowed for a heard key of this length. */
function maxKeyEdits(keyLength: number): number {
  return keyLength < 4 ? 0 : Math.floor(keyLength * 0.2);
}

type Near = NonNullable<ReturnType<typeof closest>>;

/** Near matches for one heard word, before the English guard is applied. */
function singleWordOptions(word: string, index: Index): Near[] {
  if (word.length < 5) return [];
  const out: Near[] = [];
  const m = closest(word, index);
  if (m) out.push(m);
  // Speech engines often hear a final "-in" as "-ing" ("meriforming").
  if (word.endsWith("ing")) {
    const m2 = closest(word.slice(0, -1), index);
    if (m2) out.push(m2);
  }
  return out;
}

/** Closest medicine to a heard word, ignoring the English guard (used to build the guard). */
export function nearMatch(heard: string, drugs: readonly string[]): string | undefined {
  return singleWordOptions(heard, indexFor(drugs))[0]?.drug;
}

function closest(
  heard: string,
  index: Index,
): { drug: string; keyDist: number; letterDist: number; rank: number } | undefined {
  const key = soundKey(heard);
  const maxKey = maxKeyEdits(key.length);
  if (key.length < 4) return undefined;
  let best: { drug: string; keyDist: number; letterDist: number; rank: number } | undefined;
  for (let len = key.length - maxKey; len <= key.length + maxKey; len++) {
    // Same first sound only: speech engines rarely change it, and it keeps matches precise.
    for (const e of index.buckets.get(`${key[0]}${len}`) ?? []) {
      const keyDist = levenshtein(key, e.key, maxKey);
      if (keyDist > maxKey) continue;
      // An identical sound skeleton allows a looser spelling ("cell butimal" for salbutamol).
      const maxLetters = Math.ceil(e.name.length * (keyDist === 0 ? 0.5 : 0.35));
      const letterDist = levenshtein(heard, e.name, maxLetters);
      if (letterDist > maxLetters) continue;
      const better =
        !best ||
        keyDist < best.keyDist ||
        (keyDist === best.keyDist &&
          (letterDist < best.letterDist || (letterDist === best.letterDist && e.rank < best.rank)));
      if (better) best = { drug: e.name, keyDist, letterDist, rank: e.rank };
    }
  }
  return best;
}

export interface DrugMatch {
  /** Word index where the heard name starts */
  at: number;
  /** Words the heard name spans (1 to 3) */
  length: number;
  /** The heard words, as heard */
  heard: string;
  exact: boolean;
  /** What it sounds like, for near matches */
  suggestion?: string;
}

/**
 * Find medicine names in normalised words. Exact names first; otherwise a near match on
 * one word, or on two or three words joined, whichever is closest.
 */
export function matchDrugs(words: readonly string[], drugs: readonly string[]): DrugMatch[] {
  const index = indexFor(drugs);
  const out: DrugMatch[] = [];
  const isPart = (w: string | undefined): w is string =>
    w !== undefined && /^[a-z]{2,}$/.test(w) && !FUNCTION_WORDS.has(w);

  const isLaterPart = (w: string | undefined): w is string =>
    w !== undefined && /^[a-z]{2,}$/.test(w);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // A name split into words that join to an exact name ("hydro chlorothiazide").
    let joinedExact = 0;
    for (const n of [3, 2]) {
      const parts = words.slice(i, i + n);
      if (
        parts.length === n &&
        parts.every((p) => /^[a-z]+$/.test(p)) &&
        index.exact.has(parts.join(""))
      ) {
        joinedExact = n;
        break;
      }
    }
    if (joinedExact > 0) {
      out.push({
        at: i,
        length: joinedExact,
        heard: words.slice(i, i + joinedExact).join(" "),
        exact: false,
        suggestion: words.slice(i, i + joinedExact).join(""),
      });
      i += joinedExact - 1;
      continue;
    }
    if (index.exact.has(word)) {
      out.push({ at: i, length: 1, heard: word, exact: true });
      continue;
    }
    if (!isPart(word)) continue;

    const options: Array<{ length: number; m: Near }> = [];
    if (!ENGLISH.has(word)) {
      for (const m of singleWordOptions(word, index)) options.push({ length: 1, m });
    }
    for (const n of [2, 3]) {
      const parts = words.slice(i, i + n);
      // The first word starts the name; later words may be short ("merform in", "water in").
      if (
        parts.length < n ||
        !parts.slice(1).every(isLaterPart) ||
        parts.some((p) => index.exact.has(p))
      )
        break;
      const joined = parts.join("");
      if (ENGLISH.has(joined)) continue;
      const m = closest(joined, index);
      if (m) options.push({ length: n, m });
    }
    if (options.length === 0) continue;
    options.sort(
      (a, b) => a.m.keyDist - b.m.keyDist || a.m.letterDist - b.m.letterDist || a.length - b.length,
    );
    const best = options[0];
    out.push({
      at: i,
      length: best.length,
      heard: words.slice(i, i + best.length).join(" "),
      exact: false,
      suggestion: best.m.drug,
    });
    i += best.length - 1;
  }
  return out;
}

/** Other medicines in the list that sound like this one (sound key within 1 edit). */
export function soundAlikes(name: string, drugs: readonly string[]): string[] {
  const index = indexFor(drugs);
  const cached = index.alikes.get(name);
  if (cached) return cached;
  const key = soundKey(name);
  const found: string[] = [];
  if (key.length >= 4) {
    for (let len = key.length - 1; len <= key.length + 1; len++) {
      for (const e of index.buckets.get(`${key[0]}${len}`) ?? []) {
        if (e.name === name) continue;
        if (levenshtein(key, e.key, 1) <= 1 && levenshtein(name, e.name, 3) <= 3)
          found.push(e.name);
      }
    }
  }
  index.alikes.set(name, found);
  return found;
}
