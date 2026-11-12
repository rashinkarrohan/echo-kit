import { describe, it, expect } from 'vitest';
import { factMatches, valuesAgree } from './harness';

describe('valuesAgree (what counts as invented)', () => {
  it('a number that is not in the planted value is never agreement', () => {
    expect(valuesAgree('dose', '50 milligrams', '15 milligrams')).toBe(false);
    expect(valuesAgree('dose', '500 mg', '5 mg')).toBe(false);
    expect(valuesAgree('description', 'take 2 together', 'take it when you remember')).toBe(false);
  });

  it('same value in other wording agrees', () => {
    expect(valuesAgree('dose', 'five hundred milligrams', '500 milligrams')).toBe(true);
    expect(valuesAgree('period', '60 day', '60 days')).toBe(true);
    expect(valuesAgree('frequency', 'twice a day', 'twice daily')).toBe(true);
  });

  it('different frequencies disagree', () => {
    expect(valuesAgree('frequency', 'once daily', 'twice daily')).toBe(false);
  });

  it('a description must cover most of the planted content words', () => {
    expect(
      valuesAgree(
        'description',
        'If you feel very dizzy or you are sick for more than a day, call the clinic straight away',
        'very dizzy or sick for more than a day'
      )
    ).toBe(true);
    expect(valuesAgree('description', 'Please come back on Tuesday', 'very dizzy or sick for more than a day')).toBe(false);
  });
});

describe('factMatches', () => {
  const planted = { key: 'medicine', fields: { name: 'metformin', dose: '500 milligrams' }, quote: 'q' };

  it('a field the planted fact does not have makes the fact invented', () => {
    expect(factMatches({ key: 'medicine', fields: { name: 'metformin', frequency: 'twice daily' } }, planted)).toBe(false);
  });

  it('fewer fields than planted still matches (counted in field recall)', () => {
    expect(factMatches({ key: 'medicine', fields: { name: 'metformin' } }, planted)).toBe(true);
  });

  it('a different key never matches', () => {
    expect(factMatches({ key: 'follow_up', fields: { name: 'metformin' } }, planted)).toBe(false);
  });
});
