/**
 * Quote comparison for Echo Cover.
 *
 * Lays out what each seller said, field by field, with anchors, and marks rows where
 * the values differ. It never ranks sellers, never picks a best option and never
 * recommends a purchase.
 */

import type { Fact, QuoteCell, QuoteComparisonRow, QuoteRecord } from '../types';
import { normaliseText } from '../text/normalise';

/**
 * Comparison form of a value: normalised, with currency symbols and percent signs
 * written as words, so "$3800" and "3800 dollars" compare equal.
 */
function comparable(value: string): string {
  return normaliseText(value)
    .replace(/\$\s*(\d+(?:\.\d+)?)/g, '$1 dollars')
    .replace(/£\s*(\d+(?:\.\d+)?)/g, '$1 pounds')
    .replace(/€\s*(\d+(?:\.\d+)?)/g, '$1 euros')
    .replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 percent')
    .replace(/\bper cent\b/g, 'percent')
    .replace(/\b(dollar|pound|euro|day|week|month|year)\b/g, '$1s')
    .replace(/\s+/g, ' ')
    .trim();
}

export function compareQuotes(quotes: QuoteRecord[], fields: string[]): QuoteComparisonRow[] {
  return fields.map((field) => {
    const cells: QuoteCell[] = quotes.map((q) => {
      const entry = q.fields[field];
      return entry
        ? { conversationId: q.conversationId, seller: q.seller, value: entry.value, anchor: entry.anchor }
        : { conversationId: q.conversationId, seller: q.seller, value: null };
    });

    const discussed = cells.filter((c) => c.value !== null).map((c) => comparable(c.value as string));
    const differs = discussed.length >= 2 && new Set(discussed).size > 1;

    return { field, cells, differs };
  });
}

/**
 * Build a QuoteRecord from one conversation's validated facts.
 * The value of a fact is its field values joined in schema field order. When several
 * facts share a key, the first one heard is used (its anchor lets the user check).
 */
export function quoteRecordFromFacts(
  conversationId: string,
  seller: string,
  facts: Fact[],
  fieldOrder: Record<string, string[]>
): QuoteRecord {
  const fields: QuoteRecord['fields'] = {};
  for (const fact of facts) {
    if (fields[fact.key]) continue;
    const order = fieldOrder[fact.key] ?? Object.keys(fact.fields);
    const parts = order
      .map((name) => fact.fields[name])
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    if (parts.length === 0) continue;
    fields[fact.key] = { value: parts.join(', '), anchor: fact.anchor };
  }
  return { conversationId, seller, fields };
}
