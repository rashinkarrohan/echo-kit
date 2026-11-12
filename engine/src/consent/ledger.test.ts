import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  ConsentLedger,
  ConsentRequiredError,
  CONSENT_WORDING,
  CONSENT_WORDING_VERSION,
} from "./ledger";
import { MemoryStore } from "../store/store";
import type { ConsentPurpose, Receipt, StoredSession } from "../types";

const session = (id: string): StoredSession => ({
  id,
  schemaId: "doctor-visit",
  createdAt: 1,
  segments: [],
});
const receipt = (id: string): Receipt => ({
  conversationId: id,
  schemaId: "doctor-visit",
  timestamp: 1,
  facts: [],
  checklist: [],
  readBack: [],
  labelFlags: [],
  disclaimer: "d",
  nextSteps: [],
});

describe("ConsentLedger", () => {
  it("has no consent by default", () => {
    const ledger = new ConsentLedger();
    expect(ledger.has("record")).toBe(false);
    expect(() => ledger.assertConsent("record")).toThrow(ConsentRequiredError);
  });

  it("grant records purpose, wording version and time", () => {
    const ledger = new ConsentLedger({ now: () => 1234 });
    const rec = ledger.grant("record", CONSENT_WORDING_VERSION);
    expect(rec).toMatchObject({
      purpose: "record",
      wordingVersion: CONSENT_WORDING_VERSION,
      timestamp: 1234,
      granted: true,
    });
    expect(ledger.has("record")).toBe(true);
    expect(() => ledger.assertConsent("record")).not.toThrow();
  });

  it("consent is separate per purpose", () => {
    const ledger = new ConsentLedger();
    ledger.grant("record", CONSENT_WORDING_VERSION);
    expect(ledger.has("transcribe")).toBe(false);
    expect(ledger.has("share")).toBe(false);
    expect(ledger.has("cloud")).toBe(false);
  });

  it("withdrawal appends a record and keeps the history", async () => {
    const ledger = new ConsentLedger();
    ledger.grant("share", CONSENT_WORDING_VERSION);
    await ledger.withdraw("share");
    expect(ledger.has("share")).toBe(false);
    expect(ledger.records().map((r) => r.granted)).toEqual([true, false]);
  });

  it("rejects an empty wording version", () => {
    expect(() => new ConsentLedger().grant("record", "")).toThrow();
  });

  it("can be restored from stored records", () => {
    const a = new ConsentLedger();
    a.grant("record", CONSENT_WORDING_VERSION);
    const b = ConsentLedger.fromRecords(a.records());
    expect(b.has("record")).toBe(true);
  });

  it("withdrawing record consent deletes that session audio, transcript and receipt", async () => {
    const store = new MemoryStore();
    await store.saveSession(session("s1"));
    await store.saveAudio("s1", new ArrayBuffer(8));
    await store.saveReceipt(receipt("s1"));
    await store.saveSession(session("s2"));

    const ledger = new ConsentLedger({ store });
    ledger.grant("record", CONSENT_WORDING_VERSION);
    const result = await ledger.withdraw("record", "s1");
    expect(result.ok).toBe(true);

    expect((await store.getSession("s1")).ok && (await store.getSession("s1"))).toMatchObject({
      ok: true,
      value: undefined,
    });
    expect(await store.getAudio("s1")).toEqual({ ok: true, value: [] });
    expect(await store.getReceipt("s1")).toEqual({ ok: true, value: undefined });
    expect(await store.getSession("s2")).toMatchObject({ ok: true, value: { id: "s2" } });
  });

  it("uses all-party consent wording", () => {
    expect(CONSENT_WORDING).toMatch(/Everyone in the conversation must agree/);
  });
});

describe("Property PB10: consent gate", () => {
  const purposes: ConsentPurpose[] = ["record", "transcribe", "share", "cloud"];
  const op = fc.record({
    kind: fc.constantFrom("grant", "withdraw"),
    purpose: fc.constantFrom(...purposes),
  });

  it("assertConsent succeeds exactly when the latest entry for that purpose is a grant", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(op, { maxLength: 20 }),
        fc.constantFrom(...purposes),
        async (ops, probe) => {
          const ledger = new ConsentLedger();
          for (const o of ops) {
            if (o.kind === "grant") ledger.grant(o.purpose, CONSENT_WORDING_VERSION);
            else await ledger.withdraw(o.purpose);
          }
          const last = [...ops].reverse().find((o) => o.purpose === probe);
          const expected = last?.kind === "grant";
          expect(ledger.has(probe)).toBe(expected);
          if (expected) expect(() => ledger.assertConsent(probe)).not.toThrow();
          else expect(() => ledger.assertConsent(probe)).toThrow(ConsentRequiredError);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("a gated start never runs without record consent", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(op, { maxLength: 10 }), async (ops) => {
        const ledger = new ConsentLedger();
        for (const o of ops) {
          if (o.kind === "grant") ledger.grant(o.purpose, CONSENT_WORDING_VERSION);
          else await ledger.withdraw(o.purpose);
        }
        let started = false;
        const start = () => {
          ledger.assertConsent("record");
          started = true;
        };
        if (ledger.has("record")) {
          start();
          expect(started).toBe(true);
        } else {
          expect(start).toThrow(ConsentRequiredError);
          expect(started).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("withdrawal always deletes the session data", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("a", "b", "c"), { minLength: 1, maxLength: 3 }),
        fc.constantFrom("a", "b", "c"),
        async (ids, target) => {
          const store = new MemoryStore();
          for (const id of ids) {
            await store.saveSession(session(id));
            await store.saveReceipt(receipt(id));
          }
          const ledger = new ConsentLedger({ store });
          ledger.grant("record", CONSENT_WORDING_VERSION);
          await ledger.withdraw("record", target);
          expect(await store.getSession(target)).toEqual({ ok: true, value: undefined });
          expect(await store.getReceipt(target)).toEqual({ ok: true, value: undefined });
          for (const id of ids.filter((i) => i !== target)) {
            expect((await store.getReceipt(id)).ok).toBe(true);
            expect(await store.getReceipt(id)).not.toEqual({ ok: true, value: undefined });
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
