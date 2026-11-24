/**
 * Family share: a large-print, self-contained HTML file built on the device.
 * No audio, no scripts, no links to recordings. Everything heard is escaped.
 * Sending happens through the phone's share sheet (or a download); nothing is uploaded.
 */

import type { Receipt } from "@echo/engine";
import { ADDED, FINAL, clock, factLabel, fieldLabel } from "./copy";

export interface ShareSections {
  facts: boolean;
  checklist: boolean;
  readBack: boolean;
  labelFlags: boolean;
}

export interface ShareOptions {
  sections: ShareSections;
  recipient?: string;
  appName: string;
  /** Field order per fact key (schema fields) */
  fieldsByKey?: Record<string, string[]>;
}

export interface SharedReceipt {
  title: string;
  receipt: Receipt;
}

const STAMP_WORDS: Record<string, string> = {
  heard_clearly: FINAL.heardClearly,
  check_this: FINAL.checkThis,
};

const MARK_WORDS: Record<string, string> = {
  unmarked: ADDED.readBackUnmarked,
  right: ADDED.readBackMarkedRight,
  not_right: ADDED.readBackMarkedNotRight,
};

const LABEL_FIELDS: Record<string, string> = {
  medicine: FINAL.labelMedicine,
  dose: FINAL.labelDose,
  frequency: FINAL.labelHowOften,
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function day(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { dateStyle: "long" });
}

function section(shared: SharedReceipt, options: ShareOptions): string {
  const { receipt } = shared;
  const { sections } = options;
  const parts: string[] = [
    `<h2>${escapeHtml(shared.title)}, ${escapeHtml(day(receipt.timestamp))}</h2>`,
  ];

  if (sections.facts) {
    parts.push(`<h3>${escapeHtml(ADDED.receiptTitle)}</h3>`);
    if (receipt.facts.length === 0) parts.push(`<p>${escapeHtml(ADDED.receiptEmpty)}</p>`);
    for (const fact of receipt.facts) {
      const fields = options.fieldsByKey?.[fact.key] ?? Object.keys(fact.fields);
      const rows = fields
        .map(
          (f) =>
            `<tr><th>${escapeHtml(fieldLabel(f))}</th><td>${escapeHtml(fact.fields[f] ?? FINAL.notSaid)}</td></tr>`,
        )
        .join("");
      parts.push(
        `<div class="fact"><p class="head"><strong>${escapeHtml(factLabel(fact.key))}</strong> <span class="stamp">${escapeHtml(STAMP_WORDS[fact.stamp] ?? fact.stamp)}</span></p>` +
          `<table>${rows}</table>` +
          `<p class="quote">“${escapeHtml(fact.anchor.quote)}” (${clock(fact.anchor.startMs)} to ${clock(fact.anchor.endMs)})</p></div>`,
      );
    }
  }

  if (sections.checklist && receipt.checklist.length > 0) {
    parts.push(`<h3>${escapeHtml(FINAL.questionsPlanned)}</h3><ul>`);
    for (const c of receipt.checklist) {
      parts.push(`<li>${escapeHtml(c.item.text)}: <strong>${escapeHtml(c.stamp)}</strong></li>`);
    }
    parts.push("</ul>");
  }

  if (sections.readBack && receipt.readBack.length > 0) {
    parts.push(`<h3>${escapeHtml(ADDED.shareReadBack)}</h3><ul>`);
    for (const item of receipt.readBack) {
      parts.push(
        `<li>${escapeHtml(FINAL.readBackPrefix + item.heard)}. <strong>${escapeHtml(MARK_WORDS[item.mark])}</strong></li>`,
      );
    }
    parts.push("</ul>");
  }

  if (sections.labelFlags && receipt.labelFlags.length > 0) {
    parts.push(`<h3>${escapeHtml(ADDED.shareLabel)}</h3><ul>`);
    for (const flag of receipt.labelFlags) {
      parts.push(
        `<li><strong>${escapeHtml(LABEL_FIELDS[flag.field])}</strong>: ${escapeHtml(FINAL.labelFlag(flag.said, flag.printed))}</li>`,
      );
    }
    parts.push("</ul>");
  }

  parts.push(`<p class="disclaimer">${escapeHtml(receipt.disclaimer)}</p>`);
  return `<section>${parts.join("")}</section>`;
}

export function buildShareFile(receipts: SharedReceipt[], options: ShareOptions): string {
  const recipient = options.recipient?.trim();
  const made = receipts.length > 0 ? Math.max(...receipts.map((r) => r.receipt.timestamp)) : 0;
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(options.appName)}: ${escapeHtml(ADDED.shareTitle)}</title>`,
    "<style>",
    "body{font:24px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#14211E;background:#fff;max-width:40rem;margin:0 auto;padding:16px}",
    "h1{font-size:32px}h2{font-size:28px;border-top:2px solid #C9D3CF;padding-top:16px}h3{font-size:24px}",
    ".fact{border:1px solid #C9D3CF;border-radius:12px;padding:12px;margin:0 0 16px}",
    ".stamp{border:2px solid currentColor;border-radius:999px;padding:0 8px;font-weight:700}",
    "table{border-collapse:collapse}th{text-align:left;font-weight:500;color:#3F4F4B;padding-right:16px}td{font-weight:700}",
    ".quote,.disclaimer,.note{color:#3F4F4B;font-size:20px}",
    "</style></head><body>",
    `<h1>${escapeHtml(options.appName)}: ${escapeHtml(ADDED.shareTitle)}</h1>`,
    recipient ? `<p>${escapeHtml(ADDED.shareFor(recipient))}</p>` : "",
    `<p class="note">${escapeHtml(ADDED.shareNote(day(made)))}</p>`,
    ...receipts.map((r) => section(r, options)),
    "</body></html>",
  ].join("\n");
}

export function shareFileName(appName: string, ms: number): string {
  const d = new Date(ms).toISOString().slice(0, 10);
  return `${appName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${d}.html`;
}

/** Hand the file to the phone's share sheet, or download it if sharing files is not supported. */
export async function shareOrDownload(
  html: string,
  fileName: string,
): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([html], fileName, { type: "text/html" });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
