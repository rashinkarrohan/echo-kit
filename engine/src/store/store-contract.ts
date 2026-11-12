/**
 * Behaviour every EchoStore must have. Shared so the IndexedDB store in `@echo/ui`
 * can run the same checks in a browser test. The test functions are passed in, so
 * this module does not depend on a test runner.
 */

import type { Receipt, StoredSession } from "../types";
import type { EchoStore } from "./store";

interface Matchers {
  toEqual(expected: unknown): void;
  toBe(expected: unknown): void;
  toMatchObject(expected: object): void;
}

export interface ContractRunner {
  describe: (name: string, fn: () => void) => void;
  it: (name: string, fn: () => Promise<void>) => void;
  expect: (actual: unknown) => Matchers;
}

export interface ContractSamples {
  sampleSession: (id: string) => StoredSession;
  sampleReceipt: (id: string) => Receipt;
}

export function runStoreContract(
  makeStore: () => EchoStore | Promise<EchoStore>,
  { describe, it, expect }: ContractRunner,
  { sampleSession, sampleReceipt }: ContractSamples,
): void {
  describe("EchoStore contract", () => {
    it("saves and reads a session transcript", async () => {
      const store = await makeStore();
      await store.saveSession(sampleSession("s1"));
      expect(await store.getSession("s1")).toEqual({ ok: true, value: sampleSession("s1") });
      expect(await store.getSession("missing")).toEqual({ ok: true, value: undefined });
    });

    it("saves and reads a receipt, and lists receipts", async () => {
      const store = await makeStore();
      await store.saveReceipt(sampleReceipt("s1"));
      await store.saveReceipt(sampleReceipt("s2"));
      expect(await store.getReceipt("s1")).toEqual({ ok: true, value: sampleReceipt("s1") });
      const list = await store.listReceipts();
      expect(list.ok).toBe(true);
      expect(list.ok ? list.value.map((r) => r.conversationId).sort() : []).toEqual(["s1", "s2"]);
    });

    it("keeps audio chunks per session", async () => {
      const store = await makeStore();
      await store.saveAudio("s1", new Uint8Array([1, 2]).buffer);
      await store.saveAudio("s1", new Uint8Array([3]).buffer);
      const audio = await store.getAudio("s1");
      expect(audio.ok ? audio.value.map((b) => [...new Uint8Array(b)]) : null).toEqual([
        [1, 2],
        [3],
      ]);
      expect(await store.getAudio("none")).toEqual({ ok: true, value: [] });
    });

    it("deleteSession removes audio, transcript and receipt of that session only", async () => {
      const store = await makeStore();
      for (const id of ["s1", "s2"]) {
        await store.saveSession(sampleSession(id));
        await store.saveReceipt(sampleReceipt(id));
        await store.saveAudio(id, new Uint8Array([9]).buffer);
      }
      expect(await store.deleteSession("s1")).toEqual({ ok: true, value: undefined });
      expect(await store.getSession("s1")).toEqual({ ok: true, value: undefined });
      expect(await store.getReceipt("s1")).toEqual({ ok: true, value: undefined });
      expect(await store.getAudio("s1")).toEqual({ ok: true, value: [] });
      expect(await store.getSession("s2")).toMatchObject({ ok: true, value: { id: "s2" } });
      expect(await store.getReceipt("s2")).toMatchObject({
        ok: true,
        value: { conversationId: "s2" },
      });
    });

    it("saves and reads consent records", async () => {
      const store = await makeStore();
      const records = [
        { id: "c1", purpose: "record" as const, wordingVersion: "v1", timestamp: 1, granted: true },
        {
          id: "c2",
          purpose: "record" as const,
          wordingVersion: "v1",
          timestamp: 2,
          granted: false,
        },
      ];
      await store.saveConsentRecords(records);
      expect(await store.getConsentRecords()).toEqual({ ok: true, value: records });
    });
  });
}
