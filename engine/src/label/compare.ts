/**
 * Label check: compare what was said about a medicine with what is printed on its label.
 *
 * Differences are reported with the spoken value, the printed value and the audio
 * anchors. The comparison never says which value is right, and never calculates a dose.
 */

import type { Anchor, Fact, LabelFields, LabelFlag } from "../types";
import { normaliseText } from "../text/normalise";

const COUNT_WORDS: Record<string, number> = { once: 1, twice: 2, thrice: 3 };

/**
 * Canonical frequency: `N/day`, `every-N-hours` or `prn`.
 * Returns undefined when the text does not say how often (never guesses).
 */
export function canonicalFrequency(text: string): string | undefined {
  const t = normaliseText(text);
  if (t.length === 0) return undefined;

  const everyHours = t.match(/\bevery (\d+) hours?\b/);
  if (everyHours) return `every-${everyHours[1]}-hours`;

  if (/\b(as needed|when needed|if needed|as required|when required|prn)\b/.test(t)) return "prn";

  const counted = t.match(/\b(once|twice|thrice|\d+ times?)( a| per| each)? (day|daily)\b/);
  if (counted) {
    const word = counted[1];
    const n = COUNT_WORDS[word] ?? parseInt(word, 10);
    if (n > 0) return `${n}/day`;
  }

  const timesOfDay = [
    /\bmorning\b/,
    /\b(noon|midday|lunchtime|lunch)\b/,
    /\bafternoon\b/,
    /\bevening\b/,
    /\b(night|bedtime)\b/,
  ].filter((re) => re.test(t)).length;
  if (timesOfDay > 0) return `${timesOfDay}/day`;

  if (/\b(daily|every day|each day|a day|per day)\b/.test(t)) return "1/day";

  return undefined;
}

const UNIT_ALIASES: Array<[RegExp, string]> = [
  [/^(mg|milligrams?|mgs)$/, "mg"],
  [/^(mcg|micrograms?|µg|ug)$/, "mcg"],
  [/^(g|grams?|gm)$/, "g"],
  [/^(ml|millilitres?|milliliters?|mls)$/, "ml"],
  [/^(units?|iu)$/, "units"],
  [/^(tablets?|tabs?)$/, "tablet"],
  [/^(capsules?|caps?)$/, "capsule"],
  [/^(drops?)$/, "drop"],
  [/^(puffs?)$/, "puff"],
];

/**
 * Canonical dose: "<value> <unit>" or "<value>" when no unit was given.
 * Returns undefined when there is no number (never guesses).
 */
export function canonicalDose(text: string): string | undefined {
  const t = normaliseText(text).replace(/(\d)([a-zµ]+)/g, "$1 $2");
  const m = t.match(/(\d+(?:\.\d+)?)\s*([a-zµ]+)?/);
  if (!m) return undefined;
  const value = String(parseFloat(m[1]));
  const rawUnit = m[2];
  if (!rawUnit) return value;
  const alias = UNIT_ALIASES.find(([re]) => re.test(rawUnit));
  return alias ? `${value} ${alias[1]}` : value;
}

function doseOf(fact: Fact): string | undefined {
  return fact.fields["dose"] ?? fact.fields["strength"];
}

function frequencyOf(fact: Fact): string | undefined {
  return fact.fields["frequency"] ?? fact.fields["how_to_take"];
}

/** Comparison key: the canonical form when known, otherwise the normalised text. */
function keyOf(value: string, canon: (s: string) => string | undefined): string {
  return canon(value) ?? `text:${normaliseText(value)}`;
}

function compareField(
  field: "dose" | "frequency",
  facts: Fact[],
  printed: string,
  getValue: (f: Fact) => string | undefined,
  canon: (s: string) => string | undefined,
): LabelFlag[] {
  if (normaliseText(printed).length === 0) return [];
  const printedKey = keyOf(printed, canon);

  const groups = new Map<string, { said: string; anchors: Anchor[] }>();
  for (const fact of facts) {
    const said = getValue(fact);
    if (said === undefined || normaliseText(said).length === 0) continue; // not said: nothing to compare
    const key = keyOf(said, canon);
    if (key === printedKey) continue;
    const group = groups.get(key);
    if (group) {
      group.anchors.push(fact.anchor);
    } else {
      groups.set(key, { said, anchors: [fact.anchor] });
    }
  }

  return [...groups.values()].map((g) => ({ field, said: g.said, printed, anchors: g.anchors }));
}

/**
 * Compare spoken medicine facts (doctor and/or pharmacy) with the label fields the
 * user confirmed. Medicine names are compared case-insensitively after normalisation,
 * doses by value and unit, and frequencies by canonical form.
 */
export function compareLabel(facts: Fact[], label: LabelFields): LabelFlag[] {
  const medicines = facts.filter((f) => f.key === "medicine");
  const named = medicines.filter((f) => normaliseText(f.fields["name"] ?? "").length > 0);
  if (named.length === 0) return [];

  const labelName = normaliseText(label.medicine);
  const matching = named.filter((f) => normaliseText(f.fields["name"]) === labelName);

  if (matching.length === 0) {
    const saidNames = [...new Set(named.map((f) => f.fields["name"]))];
    return [
      {
        field: "medicine",
        said: saidNames.join(", "),
        printed: label.medicine,
        anchors: named.map((f) => f.anchor),
      },
    ];
  }

  return [
    ...compareField("dose", matching, label.dose, doseOf, canonicalDose),
    ...compareField("frequency", matching, label.frequency, frequencyOf, canonicalFrequency),
  ];
}
