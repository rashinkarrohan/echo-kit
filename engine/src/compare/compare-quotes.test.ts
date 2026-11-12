import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compareQuotes, quoteRecordFromFacts } from './compare-quotes';
import type { Anchor, Fact, QuoteRecord } from '../types';

const a = (id: string): Anchor => ({ segmentIds: [id], startMs: 0, endMs: 5000, quote: id });

const sellerA: QuoteRecord = {
  conversationId: 'cover-01',
  seller: 'Seller A',
  fields: {
    price: { value: '3800 dollars, pair', anchor: a('a-1') },
    financing: { value: '12 percent, 3 years', anchor: a('a-4') },
    trial_returns: { value: '30 days, full refund', anchor: a('a-3') },
  },
};

const sellerB: QuoteRecord = {
  conversationId: 'cover-02',
  seller: 'Seller B',
  fields: {
    price: { value: '3800 dollars, pair', anchor: a('b-1') },
    financing: { value: '9.9 percent, 3 years', anchor: a('b-4') },
    commission: { value: 'staff earn a commission on every sale', anchor: a('b-5') },
  },
};

const sellerC: QuoteRecord = {
  conversationId: 'cover-03',
  seller: 'Seller C',
  fields: {
    price: { value: '$3800, pair', anchor: a('c-1') },
  },
};

const FIELDS = ['price', 'financing', 'trial_returns', 'commission'];

describe('compareQuotes', () => {
  it('two sales that differ in financing interest, and a third missing the field', () => {
    const rows = compareQuotes([sellerA, sellerB, sellerC], FIELDS);
    const financing = rows.find((r) => r.field === 'financing')!;
    expect(financing.differs).toBe(true);
    expect(financing.cells.map((c) => c.value)).toEqual(['12 percent, 3 years', '9.9 percent, 3 years', null]);
    expect(financing.cells[0].anchor).toEqual(a('a-4'));
    expect(financing.cells[2].anchor).toBeUndefined();
  });

  it('same price in different wording does not differ ("$3800" vs "3800 dollars")', () => {
    const price = compareQuotes([sellerA, sellerB, sellerC], FIELDS).find((r) => r.field === 'price')!;
    expect(price.differs).toBe(false);
  });

  it('a field only one seller discussed is not marked as differing; others are Not discussed', () => {
    const commission = compareQuotes([sellerA, sellerB], FIELDS).find((r) => r.field === 'commission')!;
    expect(commission.differs).toBe(false);
    expect(commission.cells.map((c) => c.value)).toEqual([null, 'staff earn a commission on every sale']);
  });

  it('returns one row per requested field, in the requested order', () => {
    expect(compareQuotes([sellerA, sellerB], FIELDS).map((r) => r.field)).toEqual(FIELDS);
  });

  it('handles no quotes', () => {
    expect(compareQuotes([], FIELDS).every((r) => r.cells.length === 0 && !r.differs)).toBe(true);
  });
});

describe('quoteRecordFromFacts', () => {
  it('builds values from fact fields in schema order, keeping the first fact per key', () => {
    const facts: Fact[] = [
      { key: 'price', fields: { per: 'pair', amount: '3800 dollars' }, anchor: a('s1') },
      { key: 'price', fields: { amount: '100 dollars' }, anchor: a('s9') },
      { key: 'trial_returns', fields: { period: '30 days' }, anchor: a('s3') },
    ];
    const order = { price: ['amount', 'per'], trial_returns: ['period', 'terms'] };
    const rec = quoteRecordFromFacts('cover-01', 'Seller A', facts, order);
    expect(rec.fields.price).toEqual({ value: '3800 dollars, pair', anchor: a('s1') });
    expect(rec.fields.trial_returns.value).toBe('30 days');
    expect(rec.seller).toBe('Seller A');
  });
});

describe('Property PB11: comparison neutrality', () => {
  const values = ['3800 dollars', '$3800', '4200 dollars', '12 percent', '12%', '9.9 percent', '30 days', '60 days'];
  const arbRecord = (i: number) =>
    fc
      .record({
        price: fc.option(fc.constantFrom(...values), { nil: undefined }),
        financing: fc.option(fc.constantFrom(...values), { nil: undefined }),
        trial_returns: fc.option(fc.constantFrom(...values), { nil: undefined }),
      })
      .map((vals): QuoteRecord => {
        const fields: QuoteRecord['fields'] = {};
        for (const [k, v] of Object.entries(vals)) {
          if (v !== undefined) fields[k] = { value: v, anchor: a(`${i}-${k}`) };
        }
        return { conversationId: `conv-${i}`, seller: `Seller ${i}`, fields };
      });

  const arbQuotes = fc.tuple(arbRecord(1), arbRecord(2), arbRecord(3), arbRecord(4));

  it('reordering conversations gives the same differences and the same cells per seller', () => {
    fc.assert(
      fc.property(arbQuotes, fc.array(fc.nat(), { minLength: 4, maxLength: 4 }), (quotes, keys) => {
        const shuffled = [...quotes].map((q, i) => ({ q, k: keys[i] })).sort((x, y) => x.k - y.k).map((x) => x.q);
        const fields = ['price', 'financing', 'trial_returns'];
        const r1 = compareQuotes(quotes, fields);
        const r2 = compareQuotes(shuffled, fields);
        expect(r2.map((r) => r.differs)).toEqual(r1.map((r) => r.differs));
        const bySeller = (rows: typeof r1) =>
          rows.map((r) => [...r.cells].sort((x, y) => x.seller.localeCompare(y.seller)));
        expect(bySeller(r2)).toEqual(bySeller(r1));
      }),
      { numRuns: 300 }
    );
  });

  it('output contains no ranking or recommendation field', () => {
    fc.assert(
      fc.property(arbQuotes, (quotes) => {
        const rows = compareQuotes(quotes, ['price', 'financing', 'trial_returns']);
        const keys = new Set<string>();
        const walk = (v: unknown): void => {
          if (Array.isArray(v)) v.forEach(walk);
          else if (v && typeof v === 'object') {
            for (const [k, child] of Object.entries(v)) {
              keys.add(k);
              walk(child);
            }
          }
        };
        walk(rows);
        for (const k of keys) {
          expect(k).not.toMatch(/rank|best|score|recommend|cheap|winner|order|preferred/i);
        }
      }),
      { numRuns: 100 }
    );
  });
});
