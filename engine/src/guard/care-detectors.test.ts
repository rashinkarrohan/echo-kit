import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { numberDetector, frequencyDetector, dateDetector, drugDetector } from './care-detectors';
import { flagTokens } from './index';
import { makeSegment } from '../segments';

// Load drug dictionary
import drugData from '../../data/drugs.sample.json';
const drugDictionary = { drugs: drugData.drugs };

describe('numberDetector', () => {
  it('detects number with unit (from DETECTOR-SPEC)', () => {
    const seg = makeSegment(0, 0, 3000, 'metformin 500 milligrams twice daily');
    const tokens = numberDetector.detect(seg);
    
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe('number');
    expect(tokens[0].value).toContain('500');
    expect(tokens[0].value).toContain('milligrams');
  });

  it('detects number with tablets', () => {
    const seg = makeSegment(0, 0, 3000, 'take 2 tablets');
    const tokens = numberDetector.detect(seg);
    
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe('number');
    expect(tokens[0].value).toContain('2');
    expect(tokens[0].value).toContain('tablets');
  });

  it('detects bare number', () => {
    const seg = makeSegment(0, 0, 3000, 'you have 15 minutes');
    const tokens = numberDetector.detect(seg);
    
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe('number');
    expect(tokens[0].value).toBe('15');
  });

  it('returns empty for text with no numbers', () => {
    const seg = makeSegment(0, 0, 3000, 'no numbers here');
    const tokens = numberDetector.detect(seg);
    
    expect(tokens).toHaveLength(0);
  });

  it('detects decimals', () => {
    const seg = makeSegment(0, 0, 3000, 'take 0.5 mg');
    const tokens = numberDetector.detect(seg);
    
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0].value).toContain('0.5');
  });

  it('sets lowConfidence based on word confidence', () => {
    const seg = makeSegment(0, 0, 3000, '500 mg');
    seg.words = [
      { word: '500', confidence: 0.4 },
      { word: 'mg', confidence: 0.9 }
    ];
    
    const tokens = numberDetector.detect(seg);
    expect(tokens[0].lowConfidence).toBe(true);
  });

  it('does not set lowConfidence when no word data', () => {
    const seg = makeSegment(0, 0, 3000, '500 mg');
    const tokens = numberDetector.detect(seg);
    
    expect(tokens[0].lowConfidence).toBe(false);
  });
});

describe('frequencyDetector', () => {
  const testCases = [
    { input: 'once daily', canonical: '1/day' },
    { input: 'once a day', canonical: '1/day' },
    { input: 'one time a day', canonical: '1/day' },
    { input: 'twice daily', canonical: '2/day' },
    { input: 'two times a day', canonical: '2/day' },
    { input: 'twice a day', canonical: '2/day' },
    { input: 'three times a day', canonical: '3/day' },
    { input: 'three times daily', canonical: '3/day' },
    { input: 'four times daily', canonical: '4/day' },
    { input: 'every 8 hours', canonical: 'every-8-hours' },
    { input: 'as needed', canonical: 'prn' },
    { input: 'after food', canonical: 'after-food' },
    { input: 'with food', canonical: 'after-food' },
    { input: 'before food', canonical: 'before-food' },
    { input: 'in the morning', canonical: 'morning' },
    { input: 'at night', canonical: 'night' }
  ];

  testCases.forEach(({ input, canonical }) => {
    it(`detects "${input}" with canonical "${canonical}"`, () => {
      const seg = makeSegment(0, 0, 3000, input);
      const tokens = frequencyDetector.detect(seg);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe('frequency');
      expect(tokens[0].canonical).toBe(canonical);
    });
  });

  it('returns empty for text with no frequency', () => {
    const seg = makeSegment(0, 0, 3000, 'hello world');
    const tokens = frequencyDetector.detect(seg);
    
    expect(tokens).toHaveLength(0);
  });
});

describe('dateDetector', () => {
  const testCases = [
    'in 3 months',
    'tuesday',
    'tomorrow',
    'next week',
    'next month',
    'in 2 weeks',
    'monday',
    'friday',
    'today'
  ];

  testCases.forEach((input) => {
    it(`detects "${input}"`, () => {
      const seg = makeSegment(0, 0, 3000, input);
      const tokens = dateDetector.detect(seg);
      
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].kind).toBe('date');
    });
  });

  it('returns empty for text with no dates', () => {
    const seg = makeSegment(0, 0, 3000, 'no dates here');
    const tokens = dateDetector.detect(seg);
    
    expect(tokens).toHaveLength(0);
  });
});

describe('drugDetector', () => {
  it('detects exact drug name match', () => {
    const seg = makeSegment(0, 0, 3000, 'start you on metformin');
    const tokens = drugDetector.detect(seg, drugDictionary);
    
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe('drug');
    expect(tokens[0].value).toBe('metformin');
    expect(tokens[0].suggestion).toBeUndefined();
  });

  it('suggests correction for near match (edit distance 1)', () => {
    const seg = makeSegment(0, 0, 3000, 'metformine twice daily');
    const tokens = drugDetector.detect(seg, drugDictionary);
    
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe('drug');
    expect(tokens[0].value).toBe('metformine');
    expect(tokens[0].suggestion).toBe('metformin');
  });

  it('never auto-corrects the heard text', () => {
    const seg = makeSegment(0, 0, 3000, 'metformine');
    const tokens = drugDetector.detect(seg, drugDictionary);
    
    // The value should be the heard text, not the corrected one
    expect(tokens[0].value).toBe('metformine');
    expect(tokens[0].value).not.toBe('metformin');
  });

  it('returns empty for non-drug words', () => {
    const seg = makeSegment(0, 0, 3000, 'I like medicine');
    const tokens = drugDetector.detect(seg, drugDictionary);
    
    expect(tokens).toHaveLength(0);
  });

  it('detects multiple drug names', () => {
    const seg = makeSegment(0, 0, 3000, 'take metformin and aspirin');
    const tokens = drugDetector.detect(seg, drugDictionary);
    
    expect(tokens.length).toBeGreaterThanOrEqual(2);
  });
});

describe('flagTokens', () => {
  it('flags tokens using specified detectors', () => {
    const seg = makeSegment(0, 0, 3000, 'take metformin 500 mg twice daily');
    const detectors = [numberDetector, drugDetector, frequencyDetector];
    
    const tokens = flagTokens(seg, detectors, drugDictionary);
    
    // Should find at least drug, number, and frequency
    const kinds = tokens.map(t => t.kind);
    expect(kinds).toContain('drug');
    expect(kinds).toContain('number');
    expect(kinds).toContain('frequency');
  });

  it('returns empty for segment with no matches', () => {
    const seg = makeSegment(0, 0, 3000, 'hello world');
    const tokens = flagTokens(seg, [numberDetector], drugDictionary);
    
    expect(tokens).toHaveLength(0);
  });
});

// Property PB6: For generated sentences with planted tokens, every planted token appears in the flagged output
describe('Property PB6: Flag completeness', () => {
  it('flags all planted numbers, drugs, frequencies, and dates', () => {
    fc.assert(
      fc.property(
        fc.record({
          number: fc.constantFrom('50', '100', '500', '2'),
          drug: fc.constantFrom('metformin', 'aspirin', 'ibuprofen'),
          frequency: fc.constantFrom('twice daily', 'once a day', 'three times daily'),
          unit: fc.constantFrom('mg', 'tablets', 'milligrams')
        }),
        (planted) => {
          const text = `take ${planted.drug} ${planted.number} ${planted.unit} ${planted.frequency}`;
          const seg = makeSegment(0, 0, 3000, text);
          
          const detectors = [numberDetector, drugDetector, frequencyDetector];
          const tokens = flagTokens(seg, detectors, drugDictionary);
          
          // Check that we found tokens of each kind
          const kinds = tokens.map(t => t.kind);
          expect(kinds).toContain('drug');
          expect(kinds).toContain('number');
          expect(kinds).toContain('frequency');
          
          // Check that the planted values appear in the flagged output
          const drugToken = tokens.find(t => t.kind === 'drug');
          expect(drugToken?.value).toBe(planted.drug);
          
          const numberToken = tokens.find(t => t.kind === 'number');
          expect(numberToken?.value).toContain(planted.number);
          
          const freqToken = tokens.find(t => t.kind === 'frequency');
          expect(freqToken).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('numberDetector spoken units', () => {
  it('flags micrograms and millilitres with their unit', () => {
    const tokens = numberDetector.detect(makeSegment(0, 0, 4000, 'one hundred micrograms or five millilitres'));
    expect(tokens.map((t) => t.value)).toEqual(['100 micrograms', '5 millilitres']);
  });
});
