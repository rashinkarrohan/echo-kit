/**
 * Local store for sessions, audio, receipts and the consent ledger.
 *
 * Everything stays on the device. The engine defines the interface and an in-memory
 * implementation (tests, evals, private mode). The IndexedDB implementation lives in
 * `@echo/ui` (browser code), so the engine stays free of browser APIs.
 *
 * Audio is only saved when the user has opted in; the session decides that.
 */

import type { ConsentRecord, Receipt, Result, StoredSession } from "../types";

export interface EchoStore {
  saveSession(session: StoredSession): Promise<Result<void>>;
  getSession(id: string): Promise<Result<StoredSession | undefined>>;
  /** Only called after the user opts in to keeping audio */
  saveAudio(sessionId: string, chunk: ArrayBuffer): Promise<Result<void>>;
  getAudio(sessionId: string): Promise<Result<ArrayBuffer[]>>;
  saveReceipt(receipt: Receipt): Promise<Result<void>>;
  getReceipt(id: string): Promise<Result<Receipt | undefined>>;
  listReceipts(): Promise<Result<Receipt[]>>;
  /** Deletes the session's audio, transcript and receipt */
  deleteSession(id: string): Promise<Result<void>>;
  saveConsentRecords(records: ConsentRecord[]): Promise<Result<void>>;
  getConsentRecords(): Promise<Result<ConsentRecord[]>>;
  /** The user's own medicines list (Echo Care), as typed; an empty list clears it */
  saveMedicines(names: string[]): Promise<Result<void>>;
  getMedicines(): Promise<Result<string[]>>;
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const done = <T>(value: T): Promise<Result<T>> => Promise.resolve(ok(value));

function copy<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryStore implements EchoStore {
  private sessions = new Map<string, StoredSession>();
  private audio = new Map<string, ArrayBuffer[]>();
  private receipts = new Map<string, Receipt>();
  private consent: ConsentRecord[] = [];
  private medicines: string[] = [];

  saveSession(session: StoredSession): Promise<Result<void>> {
    this.sessions.set(session.id, copy(session));
    return done(undefined);
  }

  getSession(id: string): Promise<Result<StoredSession | undefined>> {
    const s = this.sessions.get(id);
    return done(s ? copy(s) : undefined);
  }

  saveAudio(sessionId: string, chunk: ArrayBuffer): Promise<Result<void>> {
    const list = this.audio.get(sessionId) ?? [];
    list.push(chunk.slice(0));
    this.audio.set(sessionId, list);
    return done(undefined);
  }

  getAudio(sessionId: string): Promise<Result<ArrayBuffer[]>> {
    return done((this.audio.get(sessionId) ?? []).map((c) => c.slice(0)));
  }

  saveReceipt(receipt: Receipt): Promise<Result<void>> {
    this.receipts.set(receipt.conversationId, copy(receipt));
    return done(undefined);
  }

  getReceipt(id: string): Promise<Result<Receipt | undefined>> {
    const r = this.receipts.get(id);
    return done(r ? copy(r) : undefined);
  }

  listReceipts(): Promise<Result<Receipt[]>> {
    return done([...this.receipts.values()].map(copy).sort((a, b) => a.timestamp - b.timestamp));
  }

  deleteSession(id: string): Promise<Result<void>> {
    this.sessions.delete(id);
    this.audio.delete(id);
    this.receipts.delete(id);
    return done(undefined);
  }

  saveConsentRecords(records: ConsentRecord[]): Promise<Result<void>> {
    this.consent = copy(records);
    return done(undefined);
  }

  getConsentRecords(): Promise<Result<ConsentRecord[]>> {
    return done(copy(this.consent));
  }

  saveMedicines(names: string[]): Promise<Result<void>> {
    this.medicines = [...names];
    return done(undefined);
  }

  getMedicines(): Promise<Result<string[]>> {
    return done([...this.medicines]);
  }
}
