import { parse } from "yaml";
import type { ConversationSchema, Result } from "../types";

/** Known entity detector IDs */
const KNOWN_DETECTORS = new Set([
  "number",
  "drug",
  "frequency",
  "date",
  "money",
  "percent",
  "duration",
  "commission",
]);

/** Options for schema validation */
export interface ValidateOptions {
  release?: boolean;
}

/**
 * Load and parse a conversation schema from YAML text.
 * Returns Result with parsed schema or error message.
 */
type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/**
 * One speech word or short term: letters, spaces and hyphens, 2 to 30 characters, at most
 * three words ("per aid", "hearing aids"), so a schema cannot hand Whisper a sentence.
 */
const SPEECH_WORD = /^[A-Za-z][A-Za-z-]*(?: [A-Za-z-]+){0,2}$/;

export function loadSchema(yamlText: string): Result<ConversationSchema> {
  try {
    const data: unknown = parse(yamlText);

    if (!isObj(data)) {
      return { ok: false, error: "Schema must be a YAML object" };
    }

    // Required fields
    const { id, skin, detectors, disclaimer, facts, checklist, nextSteps } = data;
    if (!nonEmptyString(id)) {
      return { ok: false, error: "Schema must have a string id" };
    }
    if (skin !== "care" && skin !== "cover") {
      return { ok: false, error: "Schema must have skin: care or cover" };
    }
    if (!Array.isArray(detectors)) {
      return { ok: false, error: "Schema must have detectors array" };
    }
    if (!nonEmptyString(disclaimer)) {
      return { ok: false, error: "Schema must have a disclaimer string" };
    }
    if (!Array.isArray(facts)) {
      return { ok: false, error: "Schema must have facts array" };
    }
    if (!Array.isArray(checklist)) {
      return { ok: false, error: "Schema must have checklist array" };
    }
    if (!Array.isArray(nextSteps)) {
      return { ok: false, error: "Schema must have nextSteps array" };
    }

    // Validate facts structure
    const typedFacts: ConversationSchema["facts"] = [];
    for (const fact of facts as unknown[]) {
      if (!isObj(fact) || !nonEmptyString(fact["key"])) {
        return { ok: false, error: "Each fact must have a string key" };
      }
      const fields: unknown = fact["fields"];
      if (!Array.isArray(fields)) {
        return { ok: false, error: `Fact ${fact["key"]} must have fields array` };
      }
      const cues: unknown = fact["cues"];
      typedFacts.push({
        key: fact["key"],
        fields: (fields as unknown[]).map(String),
        ...(isObj(cues) ? { cues } : {}),
      });
    }

    // Validate checklist structure
    const typedChecklist: ConversationSchema["checklist"] = [];
    for (const item of checklist as unknown[]) {
      if (!isObj(item) || !nonEmptyString(item["id"])) {
        return { ok: false, error: "Each checklist item must have a string id" };
      }
      if (!nonEmptyString(item["text"])) {
        return { ok: false, error: `Checklist item ${item["id"]} must have text` };
      }
      const sourceUrl: unknown = item["sourceUrl"];
      const verified: unknown = item["verified"];
      const cues: unknown = item["cues"];
      typedChecklist.push({
        id: item["id"],
        text: item["text"],
        // A missing or non-string sourceUrl becomes "" and is rejected by validateSchema.
        sourceUrl: typeof sourceUrl === "string" ? sourceUrl : "",
        ...(typeof verified === "boolean" ? { verified } : {}),
        ...(isObj(cues) ? { cues } : {}),
      });
    }

    // Validate nextSteps structure
    const typedNextSteps: ConversationSchema["nextSteps"] = [];
    for (const step of nextSteps as unknown[]) {
      if (!isObj(step) || !nonEmptyString(step["label"])) {
        return { ok: false, error: "Each nextStep must have a label" };
      }
      typedNextSteps.push({ label: step["label"] });
    }

    // Optional speech words: a short list of plain words or phrases, never sentences
    // (a sentence-like prompt was written out as speech on near-silence; docs/SPIKES.md).
    const speechWords: unknown = data["speechWords"];
    if (speechWords !== undefined) {
      if (
        !Array.isArray(speechWords) ||
        speechWords.length > 40 ||
        !speechWords.every(
          (w) => typeof w === "string" && w.length >= 2 && w.length <= 30 && SPEECH_WORD.test(w),
        )
      ) {
        return {
          ok: false,
          error:
            "speechWords must be a list of up to 40 plain terms of at most three words (letters, spaces, hyphens)",
        };
      }
    }

    const schema: ConversationSchema = {
      id,
      skin,
      detectors: (detectors as unknown[]).map(String),
      disclaimer,
      facts: typedFacts,
      checklist: typedChecklist,
      nextSteps: typedNextSteps,
      ...(Array.isArray(speechWords) ? { speechWords: speechWords as string[] } : {}),
    };

    return { ok: true, value: schema };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate a loaded schema for correctness and completeness.
 * In release mode, rejects unverified checklist items.
 */
export function validateSchema(
  schema: ConversationSchema,
  options: ValidateOptions = {},
): Result<void> {
  // Validate detector IDs
  for (const detectorId of schema.detectors) {
    if (!KNOWN_DETECTORS.has(detectorId)) {
      return {
        ok: false,
        error: `Unknown detector id: ${detectorId}. Known detectors: ${Array.from(KNOWN_DETECTORS).join(", ")}`,
      };
    }
  }

  // Validate checklist items
  for (const item of schema.checklist) {
    // Must have sourceUrl
    if (!item.sourceUrl || item.sourceUrl.trim() === "") {
      return {
        ok: false,
        error: `Checklist item ${item.id} must have a sourceUrl`,
      };
    }

    // In release mode, non-user-planned items must be verified
    if (options.release && item.sourceUrl !== "user-planned") {
      if (item.verified === false || item.verified === undefined) {
        return {
          ok: false,
          error: `Checklist item ${item.id} has unverified source ${item.sourceUrl} (not allowed in release mode)`,
        };
      }
    }
  }

  return { ok: true, value: undefined };
}
