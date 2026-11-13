import { describe, it, expect } from "vitest";
import { buildShareFile, shareFileName } from "./share";
import type { Receipt } from "@echo/engine";

const receipt: Receipt = {
  conversationId: "doctor-1",
  schemaId: "doctor-visit",
  timestamp: Date.UTC(2026, 10, 13, 10, 0),
  facts: [
    {
      key: "medicine",
      fields: { name: "metformin", dose: "500 milligrams", frequency: "twice daily" },
      anchor: {
        segmentIds: ["seg-0002"],
        startMs: 6000,
        endMs: 13000,
        quote: "metformin, five hundred milligrams, <b>twice</b> daily",
      },
      stamp: "check_this",
    },
  ],
  checklist: [
    {
      item: { id: "q1", text: "What side effects should I expect?", sourceUrl: "user-planned" },
      stamp: "Not discussed",
    },
  ],
  readBack: [
    {
      factKey: "medicine-1",
      key: "medicine",
      heard: "metformin, 500 milligrams, twice daily",
      names: ["metformin"],
      mark: "right",
      anchor: { segmentIds: ["seg-0002"], startMs: 6000, endMs: 13000, quote: "q" },
    },
  ],
  labelFlags: [{ field: "frequency", said: "twice daily", printed: "once daily", anchors: [] }],
  disclaimer:
    "Echo records and summarises what was said. It is not medical advice and not an interpreter.",
  nextSteps: [],
};

const all = { facts: true, checklist: true, readBack: true, labelFlags: true };

describe("buildShareFile", () => {
  it("includes the chosen sections with stamps, quotes, times and the disclaimer", () => {
    const html = buildShareFile([{ title: "Doctor visit", receipt }], {
      sections: all,
      recipient: "Priya",
      appName: "Echo Care",
    });
    expect(html).toContain("For: Priya");
    expect(html).toContain("metformin");
    expect(html).toContain("Check this");
    expect(html).toContain("0:06 to 0:13");
    expect(html).toContain("Not discussed");
    expect(html).toContain("Marked right");
    expect(html).toContain("Said: twice daily. Printed: once daily.");
    expect(html).toContain(receipt.disclaimer);
  });

  it("leaves out sections that were not chosen", () => {
    const html = buildShareFile([{ title: "Doctor visit", receipt }], {
      sections: { facts: true, checklist: false, readBack: false, labelFlags: false },
      appName: "Echo Care",
    });
    expect(html).toContain("metformin");
    expect(html).not.toContain("What side effects");
    expect(html).not.toContain("Marked right");
    expect(html).not.toContain("Printed:");
  });

  it("escapes everything heard, so a transcript can never inject markup", () => {
    const html = buildShareFile([{ title: "Doctor visit", receipt }], {
      sections: all,
      recipient: "<script>x</script>",
      appName: "Echo Care",
    });
    expect(html).not.toContain("<b>twice</b>");
    expect(html).toContain("&lt;b&gt;twice&lt;/b&gt;");
    expect(html).not.toMatch(/<script/i);
  });

  it("never contains audio or links to it", () => {
    const html = buildShareFile([{ title: "Doctor visit", receipt }], {
      sections: all,
      appName: "Echo Care",
    });
    expect(html).not.toMatch(/<audio|<source|data:audio|\.wav|\.m4a|blob:|base64/i);
  });

  it("names the file by app and date", () => {
    expect(shareFileName("Echo Care", Date.UTC(2026, 10, 13))).toBe("echo-care-2026-11-13.html");
  });
});
