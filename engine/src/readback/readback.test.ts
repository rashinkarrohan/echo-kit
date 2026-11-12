import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildReadBack, applyMark, scoreReadBack, unexpectedNumbers } from './readback';
import type { Anchor, Fact } from '../types';

const a = (id: string): Anchor => ({ segmentIds: [id], startMs: 0, endMs: 5000, quote: id });

const facts: Fact[] = [
  { key: 'medicine', fields: { name: 'metformin', dose: '500 milligrams', frequency: 'twice daily' }, anchor: a('s2') },
  { key: 'follow_up', fields: { when: 'in 3 months' }, anchor: a('s4') },
  { key: 'medicine', fields: { name: 'amlodipine', dose: '5 mg', frequency: 'once daily' }, anchor: a('s7') },
];

describe('buildReadBack', () => {
  it('builds heard text from field values', () => {
    const items = buildReadBack(facts);
    expect(items.map((i) => i.heard)).toEqual([
      'metformin, 500 milligrams, twice daily',
      'in 3 months',
      'amlodipine, 5 mg, once daily',
    ]);
  });

  it('gives each item a unique factKey and keeps the anchor', () => {
    const items = buildReadBack(facts);
    expect(items.map((i) => i.factKey)).toEqual(['medicine-1', 'follow_up-1', 'medicine-2']);
    expect(items[2].anchor).toEqual(a('s7'));
    expect(items[0].names).toEqual(['metformin']);
  });

  it('can be limited to some fact keys', () => {
    expect(buildReadBack(facts, ['medicine']).map((i) => i.factKey)).toEqual(['medicine-1', 'medicine-2']);
  });

  it('starts every item unmarked', () => {
    expect(buildReadBack(facts).every((i) => i.mark === 'unmarked')).toBe(true);
  });
});

describe('applyMark', () => {
  it('marks only the named item and does not mutate the input', () => {
    const items = buildReadBack(facts);
    const marked = applyMark(items, 'medicine-2', 'not_right');
    expect(marked.find((i) => i.factKey === 'medicine-2')?.mark).toBe('not_right');
    expect(marked.filter((i) => i.mark !== 'unmarked')).toHaveLength(1);
    expect(items.every((i) => i.mark === 'unmarked')).toBe(true);
  });

  it('ignores an unknown factKey', () => {
    const items = buildReadBack(facts);
    expect(applyMark(items, 'nope', 'right')).toEqual(items);
  });
});

describe('scoreReadBack', () => {
  const items = buildReadBack(facts, ['medicine']);

  it('a matching answer with numbers as words is a full match', () => {
    const scores = scoreReadBack(items, 'Metformin five hundred milligrams twice a day');
    expect(scores[0]).toMatchObject({ factKey: 'medicine-1', match: 'full', missing: [] });
  });

  it('a wrong number is a partial match listing what is missing', () => {
    const scores = scoreReadBack(items, 'metformin fifty milligrams');
    expect(scores[0].match).toBe('partial');
    expect(scores[0].missing).toEqual(['500']);
  });

  it('"5" does not count as found inside "500"', () => {
    const scores = scoreReadBack(items, 'metformin 500 milligrams');
    expect(scores[1].found).not.toContain('5');
  });

  it('an unrelated answer is no match', () => {
    expect(scoreReadBack(items, 'I am not sure')[0].match).toBe('none');
  });

  it('scoring never changes the marks', () => {
    scoreReadBack(items, 'metformin 500 milligrams twice daily');
    expect(items.every((i) => i.mark === 'unmarked')).toBe(true);
  });

  it('reports numbers in the answer that no item contains', () => {
    expect(unexpectedNumbers(items, 'metformin 1000 milligrams and amlodipine 5 mg')).toEqual(['1000']);
  });
});

describe('Property PB8: read-back reflexivity', () => {
  const names = ['metformin', 'amlodipine', 'atorvastatin', 'lisinopril'];
  const doses = ['500 milligrams', '5 mg', 'five hundred milligrams', '0.5 mg', '20 mg', '2 tablets'];
  const freqs = ['twice daily', 'once daily', 'every 8 hours', 'as needed'];

  it('an answer identical to the facts matches every item fully', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ name: fc.constantFrom(...names), dose: fc.constantFrom(...doses), frequency: fc.constantFrom(...freqs) }),
          { minLength: 1, maxLength: 4 }
        ),
        (rows) => {
          const fs: Fact[] = rows.map((fields, i) => ({ key: 'medicine', fields, anchor: a(`s${i}`) }));
          const items = buildReadBack(fs);
          const answer = items.map((i) => i.heard).join('. ');
          const scores = scoreReadBack(items, answer);
          expect(scores.every((s) => s.match === 'full')).toBe(true);
          expect(unexpectedNumbers(items, answer)).toEqual([]);
        }
      ),
      { numRuns: 300 }
    );
  });
});
