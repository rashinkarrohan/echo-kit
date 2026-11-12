import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normaliseText, numberWordsToDigits } from './normalise';

describe('normaliseText', () => {
  // Property PB: idempotence
  it('is idempotent (normalising twice gives same result)', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const once = normaliseText(text);
        const twice = normaliseText(once);
        expect(once).toBe(twice);
      })
    );
  });

  // Test vectors from DETECTOR-SPEC
  it('converts "fifty" to 50', () => {
    expect(normaliseText('Take FIFTY milligrams.')).toBe('take 50 milligrams');
  });

  it('converts "fifteen" to 15', () => {
    expect(normaliseText('fifteen tablets')).toBe('15 tablets');
  });

  it('converts "five hundred" to 500', () => {
    expect(normaliseText('five hundred milligrams')).toBe('500 milligrams');
  });

  it('converts "a hundred and twenty" to 120', () => {
    expect(normaliseText('a hundred and twenty')).toBe('120');
  });

  it('converts "two thousand dollars" to 2000', () => {
    expect(normaliseText('two thousand dollars')).toBe('2000 dollars');
  });

  it('converts "twelve percent" to 12', () => {
    expect(normaliseText('twelve percent')).toBe('12 percent');
  });

  it('converts "half a tablet" to 0.5', () => {
    expect(normaliseText('half a tablet')).toBe('0.5 a tablet');
  });

  it('keeps fifty and fifteen distinct', () => {
    const fifty = normaliseText('fifty');
    const fifteen = normaliseText('fifteen');
    expect(fifty).toBe('50');
    expect(fifteen).toBe('15');
    expect(fifty).not.toBe(fifteen);
  });

  it('preserves digits that are already present', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        (num) => {
          const text = `take ${num} mg`;
          const normalised = normaliseText(text);
          expect(normalised).toContain(String(num));
        }
      )
    );
  });

  it('lowercases text', () => {
    expect(normaliseText('METFORMIN')).toBe('metformin');
    expect(normaliseText('TwIcE DaIlY')).toBe('twice daily');
  });

  it('preserves important punctuation (%, ., $, £, €)', () => {
    expect(normaliseText('12%')).toContain('%');
    expect(normaliseText('$50')).toContain('$');
    expect(normaliseText('£100')).toContain('£');
    expect(normaliseText('€25')).toContain('€');
    expect(normaliseText('0.5 mg')).toContain('.');
  });

  it('removes other punctuation', () => {
    const result = normaliseText('Take it, okay? Yes!');
    expect(result).not.toContain(',');
    expect(result).not.toContain('?');
    expect(result).not.toContain('!');
  });

  it('collapses whitespace', () => {
    expect(normaliseText('take   twice    daily')).toBe('take twice daily');
    expect(normaliseText('take\t\ndaily')).toBe('take daily');
  });

  it('handles number word combinations', () => {
    expect(normaliseText('twenty five')).toBe('25');
    expect(normaliseText('thirty seven')).toBe('37');
    expect(normaliseText('ninety nine')).toBe('99');
  });

  it('handles hundreds', () => {
    expect(normaliseText('one hundred')).toBe('100');
    expect(normaliseText('three hundred')).toBe('300');
    expect(normaliseText('nine hundred')).toBe('900');
  });

  it('handles thousands', () => {
    expect(normaliseText('one thousand')).toBe('1000');
    expect(normaliseText('five thousand')).toBe('5000');
    expect(normaliseText('fifteen thousand')).toBe('15000');
  });
});

describe('numberWordsToDigits', () => {
  it('converts single digit words', () => {
    expect(numberWordsToDigits('zero')).toBe('0');
    expect(numberWordsToDigits('one')).toBe('1');
    expect(numberWordsToDigits('five')).toBe('5');
    expect(numberWordsToDigits('nine')).toBe('9');
  });

  it('converts teens', () => {
    expect(numberWordsToDigits('ten')).toBe('10');
    expect(numberWordsToDigits('eleven')).toBe('11');
    expect(numberWordsToDigits('fifteen')).toBe('15');
    expect(numberWordsToDigits('nineteen')).toBe('19');
  });

  it('converts tens', () => {
    expect(numberWordsToDigits('twenty')).toBe('20');
    expect(numberWordsToDigits('thirty')).toBe('30');
    expect(numberWordsToDigits('fifty')).toBe('50');
    expect(numberWordsToDigits('ninety')).toBe('90');
  });

  it('converts "a hundred" to 100', () => {
    expect(numberWordsToDigits('a hundred')).toBe('100');
  });

  it('converts "half" to 0.5', () => {
    expect(numberWordsToDigits('half')).toBe('0.5');
  });

  it('leaves non-number words unchanged', () => {
    expect(numberWordsToDigits('hello world')).toBe('hello world');
  });
});
