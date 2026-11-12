import { describe, it, expect } from 'vitest';
import { MemoryStore } from './store';
import { runStoreContract } from './store-contract';
import type { Receipt, StoredSession } from '../types';

export const sampleSession = (id: string): StoredSession => ({
  id,
  schemaId: 'doctor-visit',
  createdAt: 1,
  segments: [{ id: 'seg-0001', index: 0, startMs: 0, endMs: 5000, text: 'take metformin twice daily' }],
});

export const sampleReceipt = (id: string): Receipt => ({
  conversationId: id,
  schemaId: 'doctor-visit',
  timestamp: 2,
  facts: [],
  checklist: [],
  readBack: [],
  labelFlags: [],
  disclaimer: 'Echo records and summarises what was said. It is not medical advice and not an interpreter.',
  nextSteps: [],
});

describe('MemoryStore', () => {
  runStoreContract(() => new MemoryStore(), { describe, it, expect }, { sampleSession, sampleReceipt });

  it('returns copies, so callers cannot mutate stored data', async () => {
    const store = new MemoryStore();
    const r = sampleReceipt('s1');
    await store.saveReceipt(r);
    r.schemaId = 'changed';
    const got = await store.getReceipt('s1');
    expect(got.ok && got.value?.schemaId).toBe('doctor-visit');
  });
});
