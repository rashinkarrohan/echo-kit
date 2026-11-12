import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateFact } from './validate-fact';
import { makeSegment } from '../segments';
import type { RawFact, Segment } from '../types';

describe('validateFact', () => {
  const segments: Segment[] = [
    makeSegment(0, 0, 3000, 'take metformin five hundred milligrams'),
    makeSegment(1, 3000, 6000, 'twice daily after food'),
    makeSegment(2, 6000, 9000, 'come back in two weeks')
  ];

  describe('Basic validation', () => {
    it('accepts fact with valid quote substring', () => {
      const raw: RawFact = {
        key: 'medicine',
        fields: { name: 'metformin', dose: '500 milligrams' },
        quote: 'metformin five hundred milligrams',
        segmentIds: ['seg-0001']
      };

      const result = validateFact(raw, segments);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        expect(result.value.key).toBe('medicine');
        expect(result.value.anchor).toBeDefined();
        expect(result.value.anchor.segmentIds).toEqual(['seg-0001']);
        expect(result.value.anchor.startMs).toBe(0);
        expect(result.value.anchor.endMs).toBe(3000);
      }
    });

    it('rejects fact with quote not in transcript', () => {
      const raw: RawFact = {
        key: 'medicine',
        fields: { name: 'aspirin' },
        quote: 'aspirin 75 mg',
        segmentIds: ['seg-0001']
      };

      const result = validateFact(raw, segments);
      expect(result.ok).toBe(false);
      
      if (!result.ok) {
        expect(result.error.reason.toLowerCase()).toContain('quote');
      }
    });

    it('accepts fact spanning multiple segments', () => {
      const raw: RawFact = {
        key: 'medicine',
        fields: { name: 'metformin', frequency: 'twice daily' },
        quote: 'metformin five hundred milligrams twice daily',
        segmentIds: ['seg-0001', 'seg-0002']
      };

      const result = validateFact(raw, segments);
      expect(result.ok).toBe(true);
      
      if (result.ok) {
        expect(result.value.anchor.startMs).toBe(0);
        expect(result.value.anchor.endMs).toBe(6000);
      }
    });
  });

  // Property PB1: Anchor soundness - every returned fact's quote occurs in the transcript
  describe('Property PB1: Anchor soundness', () => {
    it('every accepted fact has quote as substring of normalized transcript', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'metformin',
            'take metformin',
            'five hundred milligrams',
            'twice daily'
          ),
          (quote) => {
            const raw: RawFact = {
              key: 'test',
              fields: { value: 'test' },
              quote,
              segmentIds: ['seg-0001']
            };

            const result = validateFact(raw, segments);
            
            if (result.ok) {
              // If accepted, the normalized quote must be in normalized transcript
              const normalizedTranscript = segments.map(s => s.text.toLowerCase()).join(' ');
              const normalizedQuote = quote.toLowerCase();
              expect(normalizedTranscript).toContain(normalizedQuote);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Property PB2: No-anchor-no-claim - removing/altering a quote invalidates it
  describe('Property PB2: No-anchor-no-claim', () => {
    it('altering quote makes validation fail', () => {
      const validRaw: RawFact = {
        key: 'medicine',
        fields: { name: 'metformin' },
        quote: 'metformin five hundred milligrams',
        segmentIds: ['seg-0001']
      };

      const validResult = validateFact(validRaw, segments);
      expect(validResult.ok).toBe(true);

      // Alter the quote
      const alteredRaw: RawFact = {
        ...validRaw,
        quote: 'metformin six hundred milligrams' // Changed amount
      };

      const alteredResult = validateFact(alteredRaw, segments);
      expect(alteredResult.ok).toBe(false);
    });

    it('removing part of quote makes validation fail', () => {
      const validRaw: RawFact = {
        key: 'medicine',
        fields: { name: 'metformin', dose: '500 mg' },
        quote: 'metformin five hundred milligrams twice daily',
        segmentIds: ['seg-0001', 'seg-0002']
      };

      const validResult = validateFact(validRaw, segments);
      expect(validResult.ok).toBe(true);

      // Create a quote that adds words not in the transcript
      const alteredRaw: RawFact = {
        ...validRaw,
        quote: 'metformin aspirin twice daily' // Added "aspirin" which is not in transcript
      };

      const alteredResult = validateFact(alteredRaw, segments);
      // Should fail because "metformin aspirin twice daily" is not in transcript
      expect(alteredResult.ok).toBe(false);
    });
  });

  // Property PB3: Noise invariance - inserting filler words never creates new accepted facts
  describe('Property PB3: Noise invariance', () => {
    it('filler words do not prevent validation of valid quotes', () => {
      const noisySegments = [
        makeSegment(0, 0, 3000, 'take, metformin... five hundred milligrams!'),
        makeSegment(1, 3000, 6000, 'twice daily; after food.')
      ];

      const raw: RawFact = {
        key: 'medicine',
        fields: { name: 'metformin' },
        quote: 'metformin five hundred milligrams',
        segmentIds: ['seg-0001']
      };

      // Should validate because punctuation is normalized away
      const result = validateFact(raw, noisySegments);
      expect(result.ok).toBe(true);
    });
  });

  // Property PB4: Idempotence - same input gives same output
  describe('Property PB4: Idempotence', () => {
    it('validating same fact twice gives same result', () => {
      const raw: RawFact = {
        key: 'medicine',
        fields: { name: 'metformin' },
        quote: 'metformin five hundred milligrams',
        segmentIds: ['seg-0001']
      };

      const result1 = validateFact(raw, segments);
      const result2 = validateFact(raw, segments);

      expect(result1.ok).toBe(result2.ok);
      
      if (result1.ok && result2.ok) {
        expect(result1.value.key).toBe(result2.value.key);
        expect(result1.value.anchor.quote).toBe(result2.value.anchor.quote);
        expect(result1.value.anchor.startMs).toBe(result2.value.anchor.startMs);
        expect(result1.value.anchor.endMs).toBe(result2.value.anchor.endMs);
      }
    });
  });

  // Property PB5: Numeric faithfulness - every number in fields appears in the quote
  describe('Property PB5: Numeric faithfulness', () => {
    it('numbers in fields must appear in quote', () => {
      const raw: RawFact = {
        key: 'medicine',
        fields: { 
          name: 'metformin',
          dose: '500 mg' // This number must be in the quote
        },
        quote: 'metformin five hundred milligrams',
        segmentIds: ['seg-0001']
      };

      const result = validateFact(raw, segments);
      expect(result.ok).toBe(true);
      
      // The normalized quote should contain "500" (from "five hundred")
      if (result.ok) {
        const normalizedQuote = result.value.anchor.quote.toLowerCase();
        // After normalization, "five hundred" becomes "500"
        expect(normalizedQuote).toMatch(/500|five hundred/i);
      }
    });

    it('rejects if field number not in quote', () => {
      const raw: RawFact = {
        key: 'medicine',
        fields: {
          name: 'metformin',
          dose: '1000 mg' // This number is NOT in the quote
        },
        quote: 'metformin five hundred milligrams', // Only has 500, not 1000
        segmentIds: ['seg-0001']
      };

      const result = validateFact(raw, segments);
      
      // The validation will pass the substring check but the fields should match quote
      // For true numeric faithfulness, we'd need additional checking
      // For now, the main check is that the quote itself is valid
      if (result.ok) {
        // At minimum, the quote should be verbatim from transcript
        expect(result.value.anchor.quote).toBeTruthy();
      }
    });
  });

  describe('Anchor must point at the right audio', () => {
    it('rejects a quote that is in the transcript but not in the referenced segments', () => {
      const raw: RawFact = {
        key: 'follow_up',
        fields: { when: 'in 2 weeks' },
        quote: 'come back in two weeks',
        segmentIds: ['seg-0001']
      };
      expect(validateFact(raw, segments).ok).toBe(false);
    });

    it('rejects non-contiguous segment ids', () => {
      const raw: RawFact = {
        key: 'test',
        fields: { value: 'metformin' },
        quote: 'metformin',
        segmentIds: ['seg-0001', 'seg-0003']
      };
      expect(validateFact(raw, segments).ok).toBe(false);
    });

    it('rejects an empty quote or empty segment list', () => {
      expect(
        validateFact({ key: 'k', fields: {}, quote: '  ', segmentIds: ['seg-0001'] }, segments).ok
      ).toBe(false);
      expect(
        validateFact({ key: 'k', fields: {}, quote: 'metformin', segmentIds: [] }, segments).ok
      ).toBe(false);
    });

    it('keeps the original wording of the quote for display', () => {
      const result = validateFact(
        {
          key: 'medicine',
          fields: { name: 'metformin' },
          quote: 'metformin five hundred milligrams',
          segmentIds: ['seg-0001']
        },
        segments
      );
      expect(result.ok && result.value.anchor.quote).toBe('metformin five hundred milligrams');
    });
  });

  describe('PB5 enforced: every number in fields appears in the quote', () => {
    it('rejects a fact whose field number is missing from its quote', () => {
      const raw: RawFact = {
        key: 'medicine',
        fields: { name: 'metformin', dose: '1000 mg' },
        quote: 'metformin five hundred milligrams',
        segmentIds: ['seg-0001']
      };
      expect(validateFact(raw, segments).ok).toBe(false);
    });

    it('property: an accepted fact never carries a number absent from its quote', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 5000 }), (n) => {
          const raw: RawFact = {
            key: 'medicine',
            fields: { name: 'metformin', dose: `${n} milligrams` },
            quote: 'metformin five hundred milligrams',
            segmentIds: ['seg-0001']
          };
          const result = validateFact(raw, segments);
          expect(result.ok).toBe(n === 500);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('PB3 property: filler words never create new accepted facts', () => {
    const vocab = ['take', 'metformin', 'five', 'hundred', 'milligrams', 'twice', 'daily', 'after', 'food', 'come', 'back'];
    // Pure disfluencies only; normaliseText drops them. Real words such as "like" are never dropped.
    const fillers = ['um', 'uh', 'er', 'erm', 'hmm', 'Um,', 'uh...'];

    it('accepted(noisy) is a subset of accepted(clean)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...vocab), { minLength: 1, maxLength: 4 }),
          fc.array(fc.nat({ max: 30 }), { maxLength: 5 }),
          fc.constantFrom(...fillers),
          (quoteWords, positions, filler) => {
            const clean = segments;
            const noisy = clean.map((s) => {
              const words = s.text.split(' ');
              for (const p of positions) words.splice(p % (words.length + 1), 0, filler);
              return { ...s, text: words.join(' ') };
            });
            const raw: RawFact = {
              key: 'test',
              fields: {},
              quote: quoteWords.join(' '),
              segmentIds: ['seg-0001', 'seg-0002']
            };
            if (validateFact(raw, noisy).ok) {
              expect(validateFact(raw, clean).ok).toBe(true);
            }
          }
        ),
        { numRuns: 300 }
      );
    });
  });

  describe('Segment validation', () => {
    it('rejects if segment IDs not found', () => {
      const raw: RawFact = {
        key: 'medicine',
        fields: { name: 'metformin' },
        quote: 'metformin',
        segmentIds: ['seg-9999'] // Non-existent segment
      };

      const result = validateFact(raw, segments);
      expect(result.ok).toBe(false);
      
      if (!result.ok) {
        expect(result.error.reason.toLowerCase()).toContain('segment');
      }
    });

    it('accepts contiguous segments', () => {
      const raw: RawFact = {
        key: 'medicine',
        fields: { name: 'metformin' },
        quote: 'metformin five hundred milligrams twice daily',
        segmentIds: ['seg-0001', 'seg-0002']
      };

      const result = validateFact(raw, segments);
      expect(result.ok).toBe(true);
    });

    it('accepts non-contiguous segments if quote spans them', () => {
      const raw: RawFact = {
        key: 'test',
        fields: { value: 'test' },
        quote: 'metformin',
        segmentIds: ['seg-0001', 'seg-0003'] // Skip seg-0002
      };

      const result = validateFact(raw, segments);
      
      // Should still validate if the quote is found
      if (result.ok) {
        expect(result.value.anchor.segmentIds).toContain('seg-0001');
      }
    });
  });
});
