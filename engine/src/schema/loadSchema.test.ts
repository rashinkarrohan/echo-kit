import { describe, it, expect } from 'vitest';
import { loadSchema, validateSchema } from './loadSchema';

describe('loadSchema', () => {
  it('loads a valid schema', () => {
    const yaml = `
id: test-schema
skin: care
detectors: [number, drug]
disclaimer: "Test disclaimer"
facts:
  - key: medicine
    fields: [name, dose]
    cues:
      anchor: "@drug"
checklist:
  - id: q1
    text: "Test question"
    sourceUrl: user-planned
nextSteps:
  - label: "Test next step"
`;
    const result = loadSchema(yaml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('test-schema');
      expect(result.value.skin).toBe('care');
      expect(result.value.detectors).toEqual(['number', 'drug']);
      expect(result.value.facts).toHaveLength(1);
      expect(result.value.checklist).toHaveLength(1);
    }
  });

  it('rejects schema with missing id', () => {
    const yaml = `
skin: care
detectors: []
disclaimer: "Test"
facts: []
checklist: []
nextSteps: []
`;
    const result = loadSchema(yaml);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('id');
    }
  });

  it('rejects schema with invalid YAML', () => {
    const yaml = 'invalid: yaml: [[[';
    const result = loadSchema(yaml);
    expect(result.ok).toBe(false);
  });
});

describe('validateSchema', () => {
  const validSchema = {
    id: 'test',
    skin: 'care' as const,
    detectors: ['number'],
    disclaimer: 'Test',
    facts: [{ key: 'test', fields: ['field1'] }],
    checklist: [
      { id: 'q1', text: 'Question 1', sourceUrl: 'user-planned' }
    ],
    nextSteps: [{ label: 'Step 1' }]
  };

  it('accepts a valid schema', () => {
    const result = validateSchema(validSchema);
    expect(result.ok).toBe(true);
  });

  it('rejects checklist item without sourceUrl', () => {
    const schema = {
      ...validSchema,
      checklist: [
        { id: 'q1', text: 'Question 1', sourceUrl: '' }
      ]
    };
    const result = validateSchema(schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('sourceUrl');
    }
  });

  it('rejects checklist item with unverified source in release mode', () => {
    const schema = {
      ...validSchema,
      checklist: [
        {
          id: 'q1',
          text: 'Question 1',
          sourceUrl: 'https://example.com',
          verified: false
        }
      ]
    };
    const result = validateSchema(schema, { release: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('verified');
    }
  });

  it('accepts unverified source in dev mode', () => {
    const schema = {
      ...validSchema,
      checklist: [
        {
          id: 'q1',
          text: 'Question 1',
          sourceUrl: 'https://example.com',
          verified: false
        }
      ]
    };
    const result = validateSchema(schema, { release: false });
    expect(result.ok).toBe(true);
  });

  it('accepts user-planned source without verification', () => {
    const schema = {
      ...validSchema,
      checklist: [
        { id: 'q1', text: 'Question 1', sourceUrl: 'user-planned' }
      ]
    };
    const result = validateSchema(schema, { release: true });
    expect(result.ok).toBe(true);
  });

  it('rejects unknown detector id', () => {
    const schema = {
      ...validSchema,
      detectors: ['unknown-detector']
    };
    const result = validateSchema(schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('unknown-detector');
    }
  });

  it('accepts known detector ids', () => {
    const schema = {
      ...validSchema,
      detectors: ['number', 'drug', 'frequency', 'date', 'money', 'percent', 'duration', 'commission']
    };
    const result = validateSchema(schema);
    expect(result.ok).toBe(true);
  });
});
