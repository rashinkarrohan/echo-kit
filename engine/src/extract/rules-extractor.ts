/**
 * Rules-based fact extractor for Echo Kit.
 * Deterministic extraction with no model, no network.
 */

import type { Segment, ConversationSchema, RawFact, Extractor } from '../types';
import { normaliseText } from '../text/normalise';
import { flagTokens } from '../guard/index';
import {
  numberDetector,
  drugDetector,
  frequencyDetector,
  dateDetector,
  moneyDetector,
  percentDetector,
  durationDetector,
  commissionDetector
} from '../guard/index';

// Load drug dictionary
import drugData from '../../data/drugs.sample.json';
const drugDictionary = { drugs: drugData.drugs };

// Detector registry
const DETECTOR_REGISTRY = {
  number: numberDetector,
  drug: drugDetector,
  frequency: frequencyDetector,
  date: dateDetector,
  money: moneyDetector,
  percent: percentDetector,
  duration: durationDetector,
  commission: commissionDetector
};

/**
 * Rules-based extractor: uses schema cues to extract facts deterministically.
 */
export class RulesExtractor implements Extractor {
  /**
   * Extract facts from segments using schema-driven cues.
   * No model, no network - pure deterministic rules.
   */
  extract(segments: Segment[], schema: ConversationSchema): RawFact[] {
    if (segments.length === 0) {
      return [];
    }

    const facts: RawFact[] = [];

    // Get detectors for this schema
    const detectors = schema.detectors
      .map(id => DETECTOR_REGISTRY[id as keyof typeof DETECTOR_REGISTRY])
      .filter(d => d !== undefined);

    // Process each fact definition in the schema
    for (const factDef of schema.facts) {
      const extractedFacts = this.extractFactType(
        factDef,
        segments,
        detectors
      );
      facts.push(...extractedFacts);
    }

    return facts;
  }

  /**
   * Extract facts of a specific type based on fact definition.
   */
  private extractFactType(
    factDef: any,
    segments: Segment[],
    detectors: any[]
  ): RawFact[] {
    const facts: RawFact[] = [];
    const cues = factDef.cues;
    const windowWords = cues?.windowWords || 25;

    // Strategy depends on cue structure
    if (cues?.anchor) {
      // Anchor-based extraction (e.g., @drug for medicine)
      facts.push(...this.extractAnchorBased(factDef, segments, detectors, windowWords));
    } else if (cues?.any) {
      // Keyword-based extraction (e.g., "come back", "follow up")
      facts.push(...this.extractKeywordBased(factDef, segments, detectors, windowWords));
    }

    return facts;
  }

  /**
   * Extract facts anchored on a detector token (e.g., drug name).
   */
  private extractAnchorBased(
    factDef: any,
    segments: Segment[],
    detectors: any[],
    windowWords: number
  ): RawFact[] {
    const facts: RawFact[] = [];
    const anchorDetectorId = factDef.cues.anchor.replace('@', '');

    for (const segment of segments) {
      // Flag tokens in this segment
      const tokens = flagTokens(segment, detectors, drugDictionary);

      // Find anchor tokens
      const anchorTokens = tokens.filter(t => t.kind === anchorDetectorId);

      for (const anchorToken of anchorTokens) {
        // Build a fact around this anchor
        const fact = this.buildFactFromWindow(
          factDef,
          segment,
          tokens,
          anchorToken.value,
          windowWords
        );

        if (fact) {
          facts.push(fact);
        }
      }
    }

    return facts;
  }

  /**
   * Extract facts based on keyword cues (e.g., "come back", "follow up").
   */
  private extractKeywordBased(
    factDef: any,
    segments: Segment[],
    detectors: any[],
    windowWords: number
  ): RawFact[] {
    const facts: RawFact[] = [];
    const keywords = factDef.cues.any || [];

    for (const segment of segments) {
      const normalized = normaliseText(segment.text);

      // Check if any keyword matches
      let matched = false;
      for (const keyword of keywords) {
        const pattern = new RegExp(keyword, 'i');
        if (pattern.test(normalized)) {
          matched = true;
          break;
        }
      }

      if (matched) {
        // Flag tokens in this segment
        const tokens = flagTokens(segment, detectors, drugDictionary);

        // Build fact from this segment
        const fact = this.buildFactFromWindow(
          factDef,
          segment,
          tokens,
          null,
          windowWords
        );

        if (fact) {
          facts.push(fact);
        }
      }
    }

    return facts;
  }

  /**
   * Build a fact from a window of text around an anchor or keyword match.
   */
  private buildFactFromWindow(
    factDef: any,
    segment: Segment,
    tokens: any[],
    _anchorValue: string | null,
    windowWords: number
  ): RawFact | null {
    const fields: Record<string, string> = {};

    // Extract field values from tokens
    if (factDef.key === 'medicine') {
      // Medicine fact: name (drug), dose (number), frequency, duration
      const drug = tokens.find(t => t.kind === 'drug');
      const number = tokens.find(t => t.kind === 'number');
      const frequency = tokens.find(t => t.kind === 'frequency');

      if (drug) {
        fields.name = drug.value;
        if (number) fields.dose = number.value;
        if (frequency) fields.frequency = frequency.canonical || frequency.value;
      } else {
        return null; // Must have at least drug name
      }
    } else if (factDef.key === 'follow_up') {
      // Follow-up fact: when (date), what (context)
      const date = tokens.find(t => t.kind === 'date');
      if (date) {
        fields.when = date.value;
      }
      fields.what = 'follow-up'; // Generic placeholder
    } else if (factDef.key === 'price') {
      // Price fact: amount (money)
      const money = tokens.find(t => t.kind === 'money');
      if (money) {
        fields.amount = money.value;
      } else {
        return null;
      }
    } else if (factDef.key === 'financing') {
      // Financing fact: rate (percent), term (duration), monthly (money)
      const percent = tokens.find(t => t.kind === 'percent');
      const money = tokens.find(t => t.kind === 'money');
      const duration = tokens.find(t => t.kind === 'duration');

      if (percent) fields.rate = percent.value;
      if (money) fields.monthly = money.value;
      if (duration) fields.term = duration.value;

      if (!percent && !money) return null; // Need at least one
    }

    // If no fields extracted, skip this fact
    if (Object.keys(fields).length === 0) {
      return null;
    }

    // Extract quote: use the segment text, constrained by window
    // For now, use the full segment text as the quote (simplified)
    // A more sophisticated implementation would extract just the relevant window
    const quote = this.extractQuote(segment, windowWords);

    return {
      key: factDef.key,
      fields,
      quote,
      segmentIds: [segment.id]
    };
  }

  /**
   * Extract a quote from the segment, limited by window size.
   */
  private extractQuote(segment: Segment, windowWords: number): string {
    const words = segment.text.split(/\s+/);

    // If within window size, use full text
    if (words.length <= windowWords) {
      return segment.text;
    }

    // Otherwise, use first windowWords words
    return words.slice(0, windowWords).join(' ');
  }
}
