/**
 * Local store for sessions, audio, receipts and the consent ledger.
 *
 * Everything stays on the device. The engine defines the interface and an in-memory
 * implementation (tests, evals, private mode). The IndexedDB implementation lives in
 * `@echo/ui` (browser code), so the engine stays free of browser APIs.
 *
 * Audio is only saved when the user has opted in; the session decides that.
 */

import type { ConsentRecord, Receipt, Result, StoredSession } from '../types';

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
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value });

function copy<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryStore implements EchoStore {
  private sessions = new Map<string, StoredSession>();
  private audio = new Map<string, ArrayBuffer[]>();
  private receipts = new Map<string, Receipt>();
  private consent: ConsentRecord[] = [];

  async saveSession(session: StoredSession): Promise<Result<void>> {
    this.sessions.set(session.id, copy(session));
    return ok(undefined);
  }

  async getSession(id: string): Promise<Result<StoredSession | undefined>> {
    const s = this.sessions.get(id);
    return ok(s ? copy(s) : undefined);
  }

  async saveAudio(sessionId: string, chunk: ArrayBuffer): Promise<Result<void>> {
    const list = this.audio.get(sessionId) ?? [];
    list.push(chunk.slice(0));
    this.audio.set(sessionId, list);
    return ok(undefined);
  }

  async getAudio(sessionId: string): Promise<Result<ArrayBuffer[]>> {
    return ok((this.audio.get(sessionId) ?? []).map((c) => c.slice(0)));
  }

  async saveReceipt(receipt: Receipt): Promise<Result<void>> {
    this.receipts.set(receipt.conversationId, copy(receipt));
    return ok(undefined);
  }

  async getReceipt(id: string): Promise<Result<Receipt | undefined>> {
    const r = this.receipts.get(id);
    return ok(r ? copy(r) : undefined);
  }

  async listReceipts(): Promise<Result<Receipt[]>> {
    return ok([...this.receipts.values()].map(copy).sort((a, b) => a.timestamp - b.timestamp));
  }

  async deleteSession(id: string): Promise<Result<void>> {
    this.sessions.delete(id);
    this.audio.delete(id);
    this.receipts.delete(id);
    return ok(undefined);
  }

  async saveConsentRecords(records: ConsentRecord[]): Promise<Result<void>> {
    this.consent = copy(records);
    return ok(undefined);
  }

  async getConsentRecords(): Promise<Result<ConsentRecord[]>> {
    return ok(copy(this.consent));
  }
}
