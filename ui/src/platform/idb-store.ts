/**
 * IndexedDB implementation of the engine's EchoStore, using `idb`.
 * Browser-only. Everything stays on the device; nothing is uploaded.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ConsentRecord, EchoStore, Receipt, Result, StoredSession } from "@echo/engine";

interface AudioChunk {
  sessionId: string;
  seq: number;
  data: ArrayBuffer;
}

interface EchoDB extends DBSchema {
  sessions: { key: string; value: StoredSession };
  audio: { key: [string, number]; value: AudioChunk; indexes: { bySession: string } };
  receipts: { key: string; value: Receipt };
  consent: { key: string; value: { id: "ledger"; records: ConsentRecord[] } };
  /** Version 2: the user's own medicines list */
  settings: { key: string; value: { id: "medicines"; names: string[] } };
}

const DB_NAME = "echo-kit";
const DB_VERSION = 2;

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : String(e),
});

export class IdbStore implements EchoStore {
  private constructor(private readonly db: IDBPDatabase<EchoDB>) {}

  static async open(name: string = DB_NAME): Promise<Result<IdbStore>> {
    try {
      const db = await openDB<EchoDB>(name, DB_VERSION, {
        // Existing data is kept: version 1 stores are only created on a fresh database.
        upgrade(database, oldVersion) {
          if (oldVersion < 1) {
            database.createObjectStore("sessions", { keyPath: "id" });
            const audio = database.createObjectStore("audio", { keyPath: ["sessionId", "seq"] });
            audio.createIndex("bySession", "sessionId");
            database.createObjectStore("receipts", { keyPath: "conversationId" });
            database.createObjectStore("consent", { keyPath: "id" });
          }
          if (oldVersion < 2) database.createObjectStore("settings", { keyPath: "id" });
        },
      });
      return ok(new IdbStore(db));
    } catch (e) {
      return err(e);
    }
  }

  close(): void {
    this.db.close();
  }

  async saveSession(session: StoredSession): Promise<Result<void>> {
    try {
      await this.db.put("sessions", session);
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  async getSession(id: string): Promise<Result<StoredSession | undefined>> {
    try {
      return ok(await this.db.get("sessions", id));
    } catch (e) {
      return err(e);
    }
  }

  async saveAudio(sessionId: string, chunk: ArrayBuffer): Promise<Result<void>> {
    try {
      const tx = this.db.transaction("audio", "readwrite");
      const seq = await tx.store.index("bySession").count(sessionId);
      await tx.store.put({ sessionId, seq, data: chunk });
      await tx.done;
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  async getAudio(sessionId: string): Promise<Result<ArrayBuffer[]>> {
    try {
      const chunks = await this.db.getAllFromIndex("audio", "bySession", sessionId);
      return ok(chunks.sort((a, b) => a.seq - b.seq).map((c) => c.data));
    } catch (e) {
      return err(e);
    }
  }

  async saveReceipt(receipt: Receipt): Promise<Result<void>> {
    try {
      await this.db.put("receipts", receipt);
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  async getReceipt(id: string): Promise<Result<Receipt | undefined>> {
    try {
      return ok(await this.db.get("receipts", id));
    } catch (e) {
      return err(e);
    }
  }

  async listReceipts(): Promise<Result<Receipt[]>> {
    try {
      const all = await this.db.getAll("receipts");
      return ok(all.sort((a, b) => a.timestamp - b.timestamp));
    } catch (e) {
      return err(e);
    }
  }

  /** Deletes audio, transcript and receipt in one transaction. */
  async deleteSession(id: string): Promise<Result<void>> {
    try {
      const tx = this.db.transaction(["sessions", "audio", "receipts"], "readwrite");
      await tx.objectStore("sessions").delete(id);
      await tx.objectStore("receipts").delete(id);
      const audioKeys = await tx.objectStore("audio").index("bySession").getAllKeys(id);
      for (const key of audioKeys) {
        await tx.objectStore("audio").delete(key);
      }
      await tx.done;
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  async saveConsentRecords(records: ConsentRecord[]): Promise<Result<void>> {
    try {
      await this.db.put("consent", { id: "ledger", records });
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  async getConsentRecords(): Promise<Result<ConsentRecord[]>> {
    try {
      const row = await this.db.get("consent", "ledger");
      return ok(row?.records ?? []);
    } catch (e) {
      return err(e);
    }
  }

  async saveMedicines(names: string[]): Promise<Result<void>> {
    try {
      if (names.length === 0) await this.db.delete("settings", "medicines");
      else await this.db.put("settings", { id: "medicines", names: [...names] });
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  async getMedicines(): Promise<Result<string[]>> {
    try {
      const row = await this.db.get("settings", "medicines");
      return ok(row?.names ?? []);
    } catch (e) {
      return err(e);
    }
  }
}
