import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { canonicalFrequency, canonicalDose, compareLabel } from './compare';
import type { Anchor, Fact, LabelFields } from '../types';

function anchor(id: string, quote: string): Anchor {
  return { segmentIds: [id], startMs: 0, endMs: 5000, quote };
}

function medicine(fields: Record<string, string>, a: Anchor = anchor('seg-0001', 'q')): Fact {
  return { key: 'medicine', fields, anchor: a };
}

describe('canonicalFrequency', () => {
  it.each([
    ['once daily', '1/day'],
    ['once a day', '1/day'],
    ['one time a day', '1/day'],
    ['Take ONE tablet daily', '1/day'],
    ['twice daily', '2/day'],
    ['two times a day', '2/day'],
    ['twice a day', '2/day'],
    ['three times a day', '3/day'],
    ['four times daily', '4/day'],
    ['every 8 hours', 'every-8-hours'],
    ['every eight hours', 'every-8-hours'],
    ['as needed', 'prn'],
    ['when required', 'prn'],
    ['one tablet in the morning and one tablet in the evening, with food', '2/day'],
    ['once in the morning and once in the evening', '2/day'],
    ['in the morning', '1/day'],
    ['at night', '1/day'],
  ])('%s -> %s', (text, expected) => {
    expect(canonicalFrequency(text)).toBe(expected);
  });

  it('returns undefined when it cannot tell (never guesses)', () => {
    expect(canonicalFrequency('with food')).toBeUndefined();
    expect(canonicalFrequency('')).toBeUndefined();
    expect(canonicalFrequency('as your doctor told you')).toBeUndefined();
  });
});

describe('canonicalDose', () => {
  it('normalises spoken and printed units', () => {
    expect(canonicalDose('500 milligrams')).toBe('500 mg');
    expect(canonicalDose('five hundred milligram')).toBe('500 mg');
    expect(canonicalDose('500mg')).toBe('500 mg');
    expect(canonicalDose('500 MG')).toBe('500 mg');
    expect(canonicalDose('0.5 g')).toBe('0.5 g');
    expect(canonicalDose('10 ml')).toBe('10 ml');
    expect(canonicalDose('100 micrograms')).toBe('100 mcg');
  });

  it('returns undefined without a number', () => {
    expect(canonicalDose('one tablet')).toBe('1 tablet');
    expect(canonicalDose('some')).toBeUndefined();
  });
});

describe('compareLabel', () => {
  const label: LabelFields = { medicine: 'Metformin', dose: '500 mg', frequency: 'twice daily' };

  it('spoken "once daily" vs label "twice daily" yields exactly one flag', () => {
    const facts = [
      medicine({ name: 'metformin', dose: '500 milligrams', frequency: 'once daily' }, anchor('seg-0002', 'metformin 500 milligrams once daily')),
    ];
    const flags = compareLabel(facts, label);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toEqual({
      field: 'frequency',
      said: 'once daily',
      printed: 'twice daily',
      anchors: [anchor('seg-0002', 'metformin 500 milligrams once daily')],
    });
  });

  it('matching facts yield no flags', () => {
    const facts = [medicine({ name: 'METFORMIN', dose: 'five hundred milligrams', frequency: 'two times a day' })];
    expect(compareLabel(facts, label)).toEqual([]);
  });

  it('flags a dose difference by value or unit', () => {
    expect(compareLabel([medicine({ name: 'metformin', dose: '850 mg', frequency: 'twice daily' })], label)).toHaveLength(1);
    expect(compareLabel([medicine({ name: 'metformin', dose: '500 mcg', frequency: 'twice daily' })], label)[0].field).toBe('dose');
  });

  it('reads pharmacy-counter field names (strength, how_to_take)', () => {
    const facts = [
      medicine({
        name: 'metformin',
        strength: '500 milligram',
        how_to_take: 'one tablet in the morning and one tablet in the evening, with food',
      }),
    ];
    expect(compareLabel(facts, { ...label, frequency: 'once daily' }).map((f) => f.field)).toEqual(['frequency']);
  });

  it('collects the anchors of the doctor and pharmacy facts that said the same thing', () => {
    const doctor = medicine({ name: 'metformin', dose: '500 mg', frequency: 'twice daily' }, anchor('d-1', 'doctor'));
    const pharmacy = medicine({ name: 'metformin', strength: '500 mg', how_to_take: 'twice a day' }, anchor('p-1', 'pharmacy'));
    const flags = compareLabel([doctor, pharmacy], { ...label, frequency: 'once daily' });
    expect(flags).toHaveLength(1);
    expect(flags[0].anchors.map((a) => a.segmentIds[0])).toEqual(['d-1', 'p-1']);
  });

  it('flags the medicine name when no spoken medicine matches the label', () => {
    const flags = compareLabel([medicine({ name: 'metoprolol', dose: '500 mg' })], label);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ field: 'medicine', said: 'metoprolol', printed: 'Metformin' });
  });

  it('does not compare a field that was not said (no guessing)', () => {
    expect(compareLabel([medicine({ name: 'metformin' })], label)).toEqual([]);
  });

  it('ignores non-medicine facts and returns nothing with no medicine facts', () => {
    expect(compareLabel([{ key: 'follow_up', fields: { when: 'tuesday' }, anchor: anchor('s', 'q') }], label)).toEqual([]);
  });

  it('flags carry no verdict about which value is right', () => {
    const flags = compareLabel([medicine({ name: 'metformin', dose: '500 mg', frequency: 'once daily' })], label);
    for (const f of flags) {
      expect(Object.keys(f).sort()).toEqual(['anchors', 'field', 'printed', 'said']);
    }
  });
});

describe('Property PB7: comparison depends only on the compared values', () => {
  const names = ['metformin', 'Metformin', 'amlodipine', 'atorvastatin'];
  const doses = ['500 mg', '500 milligrams', 'five hundred milligrams', '850 mg', '10 mg', '500 mcg'];
  const freqs = ['once daily', 'twice daily', 'two times a day', 'every 8 hours', 'as needed', 'at night'];
  const arbAnchor = fc.record({
    segmentIds: fc.array(fc.constantFrom('seg-0001', 'seg-0002', 'seg-0009'), { minLength: 1, maxLength: 2 }),
    startMs: fc.nat({ max: 60000 }),
    endMs: fc.nat({ max: 60000 }),
    quote: fc.string(),
  });

  it('changing anchors, quotes or field naming (doctor vs pharmacy) never changes the flags', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...names),
        fc.constantFrom(...doses),
        fc.constantFrom(...freqs),
        fc.constantFrom(...names),
        fc.constantFrom(...doses),
        fc.constantFrom(...freqs),
        arbAnchor,
        arbAnchor,
        (n, d, f, ln, ld, lf, a1, a2) => {
          const lbl: LabelFields = { medicine: ln, dose: ld, frequency: lf };
          const doctor = compareLabel([medicine({ name: n, dose: d, frequency: f }, a1)], lbl);
          const pharmacy = compareLabel([medicine({ name: n, strength: d, how_to_take: f }, a2)], lbl);
          const strip = (fl: typeof doctor) => fl.map(({ field, said, printed }) => ({ field, said, printed }));
          expect(strip(pharmacy)).toEqual(strip(doctor));
        }
      ),
      { numRuns: 300 }
    );
  });

  it('is symmetric: swapping spoken and printed values flags the same fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...doses),
        fc.constantFrom(...freqs),
        fc.constantFrom(...doses),
        fc.constantFrom(...freqs),
        (d1, f1, d2, f2) => {
          const ab = compareLabel([medicine({ name: 'metformin', dose: d1, frequency: f1 })], {
            medicine: 'metformin',
            dose: d2,
            frequency: f2,
          });
          const ba = compareLabel([medicine({ name: 'metformin', dose: d2, frequency: f2 })], {
            medicine: 'metformin',
            dose: d1,
            frequency: f1,
          });
          expect(ba.map((x) => x.field)).toEqual(ab.map((x) => x.field));
        }
      ),
      { numRuns: 300 }
    );
  });
});
