/**
 * Consent ledger: separate consent per purpose, append-only, with the wording version.
 *
 * assertConsent is the consent gate. It is the one engine function that throws by
 * design, so that capture can never start by accident without consent.
 */

import type { ConsentPurpose, ConsentRecord, Result } from '../types';
import type { EchoStore } from '../store/store';

/** All-party wording, used everywhere (docs/appendix/UI-SPEC.md, docs/PRIVACY.md). */
export const CONSENT_WORDING =
  'Echo will record this conversation on your phone. Everyone in the conversation must agree. ' +
  'Audio and text stay on your phone unless you choose to share. You can stop and delete at any time.';

export const CONSENT_WORDING_VERSION = 'v1-2026-11-12';

export class ConsentRequiredError extends Error {
  readonly purpose: ConsentPurpose;
  constructor(purpose: ConsentPurpose, detail?: string) {
    super(detail ?? `Consent for "${purpose}" is required`);
    this.name = 'ConsentRequiredError';
    this.purpose = purpose;
  }
}

export interface LedgerOptions {
  store?: EchoStore;
  now?: () => number;
}

export class ConsentLedger {
  private entries: ConsentRecord[] = [];
  private counter = 0;
  private readonly store: EchoStore | undefined;
  private readonly now: () => number;

  constructor(options: LedgerOptions = {}) {
    this.store = options.store;
    this.now = options.now ?? (() => Date.now());
  }

  static fromRecords(records: ConsentRecord[], options: LedgerOptions = {}): ConsentLedger {
    const ledger = new ConsentLedger(options);
    ledger.entries = records.map((r) => ({ ...r }));
    ledger.counter = records.length;
    return ledger;
  }

  private append(purpose: ConsentPurpose, wordingVersion: string, granted: boolean): ConsentRecord {
    const timestamp = this.now();
    this.counter += 1;
    const record: ConsentRecord = {
      id: `consent-${purpose}-${timestamp}-${this.counter}`,
      purpose,
      wordingVersion,
      timestamp,
      granted,
    };
    this.entries.push(record);
    return { ...record };
  }

  grant(purpose: ConsentPurpose, wordingVersion: string): ConsentRecord {
    if (wordingVersion.trim().length === 0) {
      throw new ConsentRequiredError(purpose, 'A consent grant must name the wording version the user saw');
    }
    return this.append(purpose, wordingVersion, true);
  }

  /**
   * Withdraw consent for a purpose. When a session id is given, that session's audio,
   * transcript and receipt are deleted from the store.
   */
  async withdraw(purpose: ConsentPurpose, sessionId?: string): Promise<Result<ConsentRecord>> {
    const last = this.latest(purpose);
    const record = this.append(purpose, last?.wordingVersion ?? CONSENT_WORDING_VERSION, false);
    if (sessionId !== undefined && this.store) {
      const deleted = await this.store.deleteSession(sessionId);
      if (!deleted.ok) {
        return { ok: false, error: `Consent withdrawn, but deleting session ${sessionId} failed: ${deleted.error}` };
      }
    }
    return { ok: true, value: record };
  }

  private latest(purpose: ConsentPurpose): ConsentRecord | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].purpose === purpose) return this.entries[i];
    }
    return undefined;
  }

  has(purpose: ConsentPurpose): boolean {
    return this.latest(purpose)?.granted === true;
  }

  /** The consent gate. Throws ConsentRequiredError when consent is missing or withdrawn. */
  assertConsent(purpose: ConsentPurpose): void {
    if (!this.has(purpose)) {
      throw new ConsentRequiredError(purpose);
    }
  }

  records(): ConsentRecord[] {
    return this.entries.map((r) => ({ ...r }));
  }

  /** Save the ledger to the store, if one was given. */
  async persist(): Promise<Result<void>> {
    if (!this.store) return { ok: true, value: undefined };
    return this.store.saveConsentRecords(this.records());
  }
}
