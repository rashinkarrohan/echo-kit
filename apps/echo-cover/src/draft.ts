/**
 * The "please confirm in writing" message (UI-SPEC wording). Lists what this seller
 * was heard to say and asks about questions not discussed. Echo never sends it.
 */

import type { ChecklistResult, QuoteRecord } from "@echo/engine";
import { factLabel } from "@echo/ui";

export function draftConfirmMessage(
  record: QuoteRecord,
  checklist: ChecklistResult[],
  fieldOrder: string[],
): string {
  const said = fieldOrder
    .filter((key) => record.fields[key] !== undefined)
    .map((key) => `${factLabel(key)}: ${record.fields[key].value}.`);
  const ask = checklist
    .filter((c) => c.stamp === "Not discussed")
    .map((c) => `I would also like to know: ${c.item.text}`);
  return [
    "Hello, thank you for your time.",
    said.length > 0 ? `To confirm what we discussed: ${said.join(" ")}` : "",
    ...ask,
    "Please reply in writing to confirm.",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}
