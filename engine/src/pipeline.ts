/**
 * The post-recording pipeline, in one place so the live session and the eval harness
 * run exactly the same code: extract -> validate (no anchor, no claim) -> verify -> gap check.
 */

import type {
  ChecklistResult,
  ConversationSchema,
  Extractor,
  FlaggedToken,
  RawFact,
  Rejected,
  Segment,
  VerifiedFact,
} from "./types";
import { RulesExtractor } from "./extract/rules-extractor";
import { validateFacts } from "./validate/validate-fact";
import { verifyFacts } from "./verify/verify";
import { runGapCheck } from "./gap/gap-check";
import { flagTokens } from "./guard/index";
import { DRUG_DICTIONARY, detectorsFor } from "./guard/registry";

export interface PipelineOutput {
  raw: RawFact[];
  rejected: Rejected[];
  facts: VerifiedFact[];
  checklist: ChecklistResult[];
}

export function runPipeline(
  segments: Segment[],
  schema: ConversationSchema,
  extractor: Extractor = new RulesExtractor(),
): PipelineOutput {
  const raw = extractor.extract(segments, schema);
  const { accepted, rejected } = validateFacts(raw, segments);
  const facts = verifyFacts(accepted, segments);
  const checklist = runGapCheck(facts, schema, segments);
  return { raw, rejected, facts, checklist };
}

/** Flag tokens in one segment with the detectors the schema enables. */
export function flagSegment(segment: Segment, schema: ConversationSchema): FlaggedToken[] {
  return flagTokens(segment, detectorsFor(schema.detectors), DRUG_DICTIONARY);
}
