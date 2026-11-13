/**
 * Whisper prompt of medicine names. Whisper treats prompt text as "what came before",
 * which makes it more likely to spell those names correctly. The prompt must stay under
 * Whisper's limit (half the 448-token context, about 224 tokens), so only the most
 * common names fit; names come from engine/data/drugs.json, already ranked by use.
 */

export interface PromptOptions {
  /** Most names to include (default 60) */
  maxNames?: number;
  /** Token budget (default 200, under Whisper's 224) */
  maxTokens?: number;
  /** Names to put first, e.g. the user's own medicines */
  priority?: readonly string[];
}

/** Build " Medicines: a, b, c." from ranked names, within the token budget. */
export function buildMedicinePrompt(
  ranked: readonly string[],
  countTokens: (text: string) => number,
  { maxNames = 60, maxTokens = 200, priority = [] }: PromptOptions = {},
): string {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...priority, ...ranked]) {
    const name = raw.trim().toLowerCase();
    if (name.length === 0 || seen.has(name)) continue;
    const next = ` Medicines: ${[...names, name].join(", ")}.`;
    if (countTokens(next) > maxTokens) break;
    names.push(name);
    seen.add(name);
    if (names.length >= maxNames) break;
  }
  return names.length === 0 ? "" : ` Medicines: ${names.join(", ")}.`;
}
