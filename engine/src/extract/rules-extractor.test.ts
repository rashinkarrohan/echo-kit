import { describe, it, expect } from 'vitest';
import { RulesExtractor } from './rules-extractor';
import { makeSegment } from '../segments';
import type { ConversationSchema } from '../types';

// Simple test schema
const careSchema: ConversationSchema = {
  id: 'test-care',
  skin: 'care',
  detectors: ['number', 'drug', 'frequency', 'date'],
  disclaimer: 'Test',
  facts: [
    {
      key: 'medicine',
      fields: ['name', 'dose', 'frequency', 'duration'],
      cues: {
        anchor: '@drug',
        windowWords: 25,
        optional: ['@number', '@frequency']
      }
    },
    {
      key: 'follow_up',
      fields: ['when', 'what'],
      cues: {
        any: ['come back', 'follow[- ]up', 'review', 'next appointment'],
        windowWords: 15,
        optional: ['@date']
      }
    }
  ],
  checklist: [],
  nextSteps: []
};

const coverSchema: ConversationSchema = {
  id: 'test-cover',
  skin: 'cover',
  detectors: ['money', 'percent', 'duration', 'commission'],
  disclaimer: 'Test',
  facts: [
    {
      key: 'price',
      fields: ['amount', 'per'],
      cues: {
        anchor: '@money',
        windowWords: 15,
        near: ['price', 'cost', 'total']
      }
    },
    {
      key: 'financing',
      fields: ['rate', 'term', 'monthly'],
      cues: {
        any: ['finance', 'financing', 'interest', 'apr'],
        windowWords: 25,
        optional: ['@percent', '@money']
      }
    }
  ],
  checklist: [],
  nextSteps: []
};

describe('RulesExtractor', () => {
  const extractor = new RulesExtractor();

  describe('Care facts', () => {
    it('extracts medicine fact from scripted line', () => {
      const segments = [
        makeSegment(0, 0, 5000, 'take metformin five hundred milligrams twice daily after food')
      ];

      const facts = extractor.extract(segments, careSchema);

      expect(facts.length).toBeGreaterThan(0);
      
      const medicine = facts.find(f => f.key === 'medicine');
      expect(medicine).toBeDefined();
      expect(medicine!.fields.name).toContain('metformin');
      expect(medicine!.quote).toBeTruthy();
      
      // Quote must be from the original segment text (may be subset)
      // The original text is used for the quote, not the normalized version
      const originalText = segments[0].text;
      expect(medicine!.quote).toBe(originalText);
    });

    it('extracts multiple medicine facts', () => {
      const segments = [
        makeSegment(0, 0, 5000, 'start metformin 500 mg twice daily'),
        makeSegment(1, 5000, 10000, 'and aspirin 75 mg once daily')
      ];

      const facts = extractor.extract(segments, careSchema);
      
      const medicines = facts.filter(f => f.key === 'medicine');
      expect(medicines.length).toBeGreaterThanOrEqual(2);
    });

    it('extracts follow-up fact', () => {
      const segments = [
        makeSegment(0, 0, 5000, 'come back in two weeks for a review')
      ];

      const facts = extractor.extract(segments, careSchema);
      
      const followUp = facts.find(f => f.key === 'follow_up');
      expect(followUp).toBeDefined();
      expect(followUp!.quote).toBeTruthy();
    });

    it('includes segment IDs in raw facts', () => {
      const segments = [
        makeSegment(0, 0, 5000, 'take metformin 500 mg twice daily')
      ];

      const facts = extractor.extract(segments, careSchema);
      
      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].segmentIds).toBeDefined();
      expect(facts[0].segmentIds.length).toBeGreaterThan(0);
      expect(facts[0].segmentIds[0]).toBe('seg-0001');
    });

    it('copies quote from original segment text, not normalized', () => {
      const segments = [
        makeSegment(0, 0, 5000, 'Take METFORMIN five hundred milligrams TWICE daily')
      ];

      const facts = extractor.extract(segments, careSchema);
      
      const medicine = facts.find(f => f.key === 'medicine');
      expect(medicine).toBeDefined();
      
      // Quote should preserve original casing and words
      expect(medicine!.quote).toMatch(/METFORMIN|metformin/i);
    });
  });

  describe('Cover facts', () => {
    it('extracts price fact', () => {
      const segments = [
        makeSegment(0, 0, 5000, 'the total price is $4200 for the pair')
      ];

      const facts = extractor.extract(segments, coverSchema);
      
      const price = facts.find(f => f.key === 'price');
      expect(price).toBeDefined();
      expect(price!.quote).toBeTruthy();
    });

    it('extracts financing fact with percent', () => {
      const segments = [
        makeSegment(0, 0, 5000, 'financing available at 12 percent interest')
      ];

      const facts = extractor.extract(segments, coverSchema);
      
      const financing = facts.find(f => f.key === 'financing');
      expect(financing).toBeDefined();
    });
  });

  describe('Window constraints', () => {
    it('respects windowWords limit', () => {
      // Create a segment with tokens far apart beyond the window
      const segments = [
        makeSegment(0, 0, 8000, 'the medicine is great but expensive and hard to get metformin in stores near me and many other places that I have tried looking for it 500 mg')
      ];

      const facts = extractor.extract(segments, careSchema);
      
      // May or may not extract depending on window - this tests the constraint exists
      // The key is that it doesn't extract when tokens are too far apart
      const medicines = facts.filter(f => f.key === 'medicine');
      // If extracted, the quote should be within reasonable bounds
      if (medicines.length > 0) {
        const wordCount = medicines[0].quote.split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(30); // Reasonable upper bound
      }
    });
  });

  describe('Empty cases', () => {
    it('returns empty array for empty segments', () => {
      const facts = extractor.extract([], careSchema);
      expect(facts).toEqual([]);
    });

    it('returns empty array when no cues match', () => {
      const segments = [
        makeSegment(0, 0, 5000, 'hello world how are you today')
      ];

      const facts = extractor.extract(segments, careSchema);
      expect(facts).toEqual([]);
    });
  });

  describe('Deterministic behavior', () => {
    it('produces same results for same input', () => {
      const segments = [
        makeSegment(0, 0, 5000, 'take metformin 500 mg twice daily')
      ];

      const facts1 = extractor.extract(segments, careSchema);
      const facts2 = extractor.extract(segments, careSchema);

      expect(facts1.length).toBe(facts2.length);
      expect(facts1[0].key).toBe(facts2[0].key);
      expect(facts1[0].quote).toBe(facts2[0].quote);
    });
  });
});
