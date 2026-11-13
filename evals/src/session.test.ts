/**
 * Step 17 check: every scripted consult, run through a live ConversationSession with
 * the MockAdapter (as if the speech engine heard each segment exactly), produces a
 * receipt whose facts and checklist are identical to the eval harness output.
 */

import { describe, it, expect } from "vitest";
import {
  CONSENT_WORDING_VERSION,
  ConsentLedger,
  ConversationSession,
  MemoryStore,
  MockAdapter,
  RulesExtractor,
} from "@echo/engine";
import type { AudioSegment } from "@echo/engine";
import { runConsult, toSegments } from "./harness";
import { loadConsults, loadSchemas } from "./files";

const schemas = loadSchemas();
const consults = loadConsults();

describe("live session matches the eval harness", () => {
  it("covers at least the 15 consults Step 14 requires", () => {
    expect(consults.length).toBeGreaterThanOrEqual(15);
  });

  for (const consult of consults) {
    it(consult.id, async () => {
      const schema = schemas.get(consult.schemaId);
      if (!schema) throw new Error(`no schema ${consult.schemaId}`);

      const ledger = new ConsentLedger();
      ledger.grant("record", CONSENT_WORDING_VERSION);
      ledger.grant("transcribe", CONSENT_WORDING_VERSION);
      const session = new ConversationSession({
        id: consult.id,
        schema,
        asr: new MockAdapter(consult.segments.map((s) => s.text)),
        ledger,
        store: new MemoryStore(),
        ...(consult.seller !== undefined ? { seller: consult.seller } : {}),
      });

      session.start();
      for (const [index, s] of consult.segments.entries()) {
        const segment: AudioSegment = {
          id: s.id,
          index,
          startMs: s.startMs,
          endMs: s.endMs,
          samples: new Float32Array(((s.endMs - s.startMs) / 1000) * 16000),
          hasSpeech: true,
        };
        const added = await session.addAudio(segment);
        expect(added.ok).toBe(true);
      }
      const receipt = await session.stop();
      if (!receipt.ok) throw new Error(receipt.error);

      const harness = runConsult(consult, schema, new RulesExtractor());
      expect(session.transcript()).toEqual(toSegments(consult));
      expect(receipt.value.facts).toEqual(harness.facts);
      expect(receipt.value.checklist.map((c) => [c.item.id, c.stamp])).toEqual(
        harness.details.checklist.map((c) => [c.id, c.actual]),
      );
      expect(harness.invented).toBe(0);
      expect(harness.unanchored).toBe(0);
    });
  }
});
