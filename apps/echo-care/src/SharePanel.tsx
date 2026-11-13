import { useId, useState } from "react";
import type { ReactElement } from "react";
import type { Receipt } from "@echo/engine";
import { FINAL, buildShareFile, shareFileName, shareOrDownload } from "@echo/ui";
import type { ShareSections } from "@echo/ui";
import { CARE } from "./copy";
import { SCHEMAS } from "./env";
import type { Stage } from "./env";

export interface ShareableVisit {
  stage: Stage;
  receipt: Receipt;
}

/** Patient chooses receipts, sections and recipient; the file has no audio. */
export function SharePanel({ visits }: { visits: ShareableVisit[] }): ReactElement {
  const id = useId();
  const [chosen, setChosen] = useState<string[]>(() => visits.map((v) => v.receipt.conversationId));
  const [sections, setSections] = useState<ShareSections>({
    facts: true,
    checklist: true,
    readBack: false,
    labelFlags: false,
  });
  const [recipient, setRecipient] = useState("");
  const [result, setResult] = useState<string>();

  const share = async (): Promise<void> => {
    const picked = visits.filter((v) => chosen.includes(v.receipt.conversationId));
    const fieldsByKey = Object.fromEntries(
      (["doctor", "pharmacy"] as const).flatMap((s) =>
        SCHEMAS[s].facts.map((f) => [f.key, f.fields]),
      ),
    );
    const html = buildShareFile(
      picked.map((v) => ({
        title: v.stage === "doctor" ? CARE.doctorTitle : CARE.pharmacyTitle,
        receipt: v.receipt,
      })),
      { sections, recipient, appName: CARE.appName, fieldsByKey },
    );
    const outcome = await shareOrDownload(html, shareFileName(CARE.appName, Date.now()));
    setResult(
      outcome === "shared"
        ? CARE.shared
        : outcome === "downloaded"
          ? CARE.downloaded
          : CARE.shareCancelled,
    );
  };

  const sectionBox = (key: keyof ShareSections, label: string) => (
    <label className="echo-switch">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={sections[key]}
        onChange={(e) => setSections({ ...sections, [key]: e.target.checked })}
      />
    </label>
  );

  return (
    <section className="echo-card" aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`}>{CARE.shareTitle}</h1>
      <fieldset className="care-fieldset">
        <legend>{CARE.shareWhich}</legend>
        {visits.map((v) => (
          <label key={v.receipt.conversationId} className="echo-switch">
            <span>
              {v.stage === "doctor" ? CARE.doctorTitle : CARE.pharmacyTitle},{" "}
              {new Date(v.receipt.timestamp).toLocaleTimeString(undefined, { timeStyle: "short" })}
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={chosen.includes(v.receipt.conversationId)}
              onChange={(e) =>
                setChosen(
                  e.target.checked
                    ? [...chosen, v.receipt.conversationId]
                    : chosen.filter((c) => c !== v.receipt.conversationId),
                )
              }
            />
          </label>
        ))}
      </fieldset>
      <fieldset className="care-fieldset">
        <legend>{CARE.shareSections}</legend>
        {sectionBox("facts", CARE.shareFacts)}
        {sectionBox("checklist", CARE.shareChecklist)}
        {sectionBox("readBack", CARE.shareReadBack)}
        {sectionBox("labelFlags", CARE.shareLabel)}
      </fieldset>
      <div className="echo-field">
        <label htmlFor={`${id}-to`}>{CARE.shareRecipient}</label>
        <input
          id={`${id}-to`}
          type="text"
          autoComplete="off"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>
      <p className="echo-status echo-status--error" role="note">
        {FINAL.shareWarning}
      </p>
      <div className="echo-actions">
        <button
          type="button"
          className="echo-button"
          disabled={chosen.length === 0}
          onClick={() => void share()}
        >
          {FINAL.shareNoAudio}
        </button>
      </div>
      <p role="status" className="care-badge">
        {result ?? ""}
      </p>
    </section>
  );
}
