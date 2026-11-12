import { parse } from 'yaml';
import type { ConversationSchema, Result } from '../types';

/** Known entity detector IDs */
const KNOWN_DETECTORS = new Set([
  'number',
  'drug',
  'frequency',
  'date',
  'money',
  'percent',
  'duration',
  'commission'
]);

/** Options for schema validation */
export interface ValidateOptions {
  release?: boolean;
}

/**
 * Load and parse a conversation schema from YAML text.
 * Returns Result with parsed schema or error message.
 */
export function loadSchema(yamlText: string): Result<ConversationSchema> {
  try {
    const data = parse(yamlText);
    
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'Schema must be a YAML object' };
    }

    // Required fields
    if (!data.id || typeof data.id !== 'string') {
      return { ok: false, error: 'Schema must have a string id' };
    }
    if (!data.skin || (data.skin !== 'care' && data.skin !== 'cover')) {
      return { ok: false, error: 'Schema must have skin: care or cover' };
    }
    if (!Array.isArray(data.detectors)) {
      return { ok: false, error: 'Schema must have detectors array' };
    }
    if (!data.disclaimer || typeof data.disclaimer !== 'string') {
      return { ok: false, error: 'Schema must have a disclaimer string' };
    }
    if (!Array.isArray(data.facts)) {
      return { ok: false, error: 'Schema must have facts array' };
    }
    if (!Array.isArray(data.checklist)) {
      return { ok: false, error: 'Schema must have checklist array' };
    }
    if (!Array.isArray(data.nextSteps)) {
      return { ok: false, error: 'Schema must have nextSteps array' };
    }

    // Validate facts structure
    for (const fact of data.facts) {
      if (!fact.key || typeof fact.key !== 'string') {
        return { ok: false, error: 'Each fact must have a string key' };
      }
      if (!Array.isArray(fact.fields)) {
        return { ok: false, error: `Fact ${fact.key} must have fields array` };
      }
    }

    // Validate checklist structure
    for (const item of data.checklist) {
      if (!item.id || typeof item.id !== 'string') {
        return { ok: false, error: 'Each checklist item must have a string id' };
      }
      if (!item.text || typeof item.text !== 'string') {
        return { ok: false, error: `Checklist item ${item.id} must have text` };
      }
    }

    // Validate nextSteps structure
    for (const step of data.nextSteps) {
      if (!step.label || typeof step.label !== 'string') {
        return { ok: false, error: 'Each nextStep must have a label' };
      }
    }

    const schema: ConversationSchema = {
      id: data.id,
      skin: data.skin,
      detectors: data.detectors,
      disclaimer: data.disclaimer,
      facts: data.facts,
      checklist: data.checklist,
      nextSteps: data.nextSteps
    };

    return { ok: true, value: schema };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Validate a loaded schema for correctness and completeness.
 * In release mode, rejects unverified checklist items.
 */
export function validateSchema(
  schema: ConversationSchema,
  options: ValidateOptions = {}
): Result<void> {
  // Validate detector IDs
  for (const detectorId of schema.detectors) {
    if (!KNOWN_DETECTORS.has(detectorId)) {
      return {
        ok: false,
        error: `Unknown detector id: ${detectorId}. Known detectors: ${Array.from(KNOWN_DETECTORS).join(', ')}`
      };
    }
  }

  // Validate checklist items
  for (const item of schema.checklist) {
    // Must have sourceUrl
    if (!item.sourceUrl || item.sourceUrl.trim() === '') {
      return {
        ok: false,
        error: `Checklist item ${item.id} must have a sourceUrl`
      };
    }

    // In release mode, non-user-planned items must be verified
    if (options.release && item.sourceUrl !== 'user-planned') {
      if (item.verified === false || item.verified === undefined) {
        return {
          ok: false,
          error: `Checklist item ${item.id} has unverified source ${item.sourceUrl} (not allowed in release mode)`
        };
      }
    }
  }

  return { ok: true, value: undefined };
}
