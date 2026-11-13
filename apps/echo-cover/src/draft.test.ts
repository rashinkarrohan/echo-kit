import { describe, it, expect } from "vitest";
import { draftConfirmMessage } from "./draft";
import type { Anchor, ChecklistResult, QuoteRecord } from "@echo/engine";

const a: Anchor = { segmentIds: ["seg-0001"], startMs: 0, endMs: 5000, quote: "q" };

const record: QuoteRecord = {
  conversationId: "s1",
  seller: "Seller A",
  fields: {
    price: { value: "3800 dollars, pair", anchor: a },
    financing: { value: "12 percent, 3 years", anchor: a },
  },
};

const checklist: ChecklistResult[] = [
  {
    item: {
      id: "q-total-price",
      text: "What is the total price per pair?",
      sourceUrl: "https://example.org",
    },
    stamp: "Answered",
    anchor: a,
  },
  {
    item: {
      id: "q-commission",
      text: "Do staff earn commission on this sale?",
      sourceUrl: "https://example.org",
    },
    stamp: "Not discussed",
  },
];

describe("draftConfirmMessage", () => {
  it("lists what was heard, asks about what was not discussed, and asks for a written reply", () => {
    expect(draftConfirmMessage(record, checklist, ["price", "inclusions", "financing"])).toBe(
      [
        "Hello, thank you for your time.",
        "To confirm what we discussed: Price: 3800 dollars, pair. Financing: 12 percent, 3 years.",
        "I would also like to know: Do staff earn commission on this sale?",
        "Please reply in writing to confirm.",
      ].join("\n"),
    );
  });

  it("never recommends, ranks or advises", () => {
    const text = draftConfirmMessage(record, checklist, ["price", "financing"]);
    expect(text).not.toMatch(/recommend|best|cheaper|better|should buy|good deal|advice/i);
  });

  it("still asks for a written reply when nothing was heard", () => {
    expect(draftConfirmMessage({ ...record, fields: {} }, [], ["price"])).toBe(
      "Hello, thank you for your time.\nPlease reply in writing to confirm.",
    );
  });
});
