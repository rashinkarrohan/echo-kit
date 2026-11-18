import { useId } from "react";
import type { ReactElement } from "react";
import { FINAL } from "../copy";
import { StatusMessage } from "./common";
import type { StatusText, ViewStatus } from "./common";

export interface ConsentChoices {
  record: boolean;
  transcribe: boolean;
  share: boolean;
}

/**
 * Consent per purpose, with all-party wording. Nothing is on by default. "I agree and
 * continue" stays disabled until both recording and speech-to-text are switched on.
 */
export function ConsentSheet({
  choices,
  onChange,
  onAgree,
  onLearnMore,
  disclaimer,
  status = "ready",
  statusText,
}: {
  choices: ConsentChoices;
  onChange: (next: ConsentChoices) => void;
  onAgree: () => void;
  onLearnMore?: () => void;
  disclaimer: string;
  status?: ViewStatus;
  statusText?: StatusText;
}): ReactElement {
  const titleId = useId();
  const canAgree = choices.record && choices.transcribe;
  const toggle = (key: keyof ConsentChoices, label: string) => (
    <label className="echo-switch">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={choices[key]}
        onChange={(e) => onChange({ ...choices, [key]: e.target.checked })}
      />
    </label>
  );
  return (
    <section className="echo-card echo-consent" aria-labelledby={titleId}>
      <h1 id={titleId}>{FINAL.consentTitle}</h1>
      <p className="echo-consent__wording">{FINAL.consentWording}</p>
      <StatusMessage
        status={status === "empty" ? "ready" : status}
        {...(statusText ? { text: statusText } : {})}
      />
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="echo-visually-hidden">{FINAL.consentTitle}</legend>
        {toggle("record", FINAL.consentRecord)}
        {toggle("transcribe", FINAL.consentTranscribe)}
        {toggle("share", FINAL.consentShare)}
      </fieldset>
      <div className="echo-actions">
        <button type="button" className="echo-button" disabled={!canAgree} onClick={onAgree}>
          {FINAL.consentAgree}
        </button>
        {onLearnMore && (
          <button
            type="button"
            className="echo-button echo-button--secondary"
            onClick={onLearnMore}
          >
            {FINAL.consentLearnMore}
          </button>
        )}
      </div>
      <p className="echo-disclaimer" style={{ marginTop: "var(--space-4)" }}>
        {disclaimer}
      </p>
    </section>
  );
}
