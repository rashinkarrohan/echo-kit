import type { ReactElement } from "react";
import { FINAL, StatusMessage } from "@echo/ui";
import type { ConsentChoices } from "@echo/ui";
import { CD } from "./copy";
import { CareIcon } from "./icons";
import { Shell } from "./Shell";
import { BackLink, StepBar, ToggleRow } from "./parts";

/**
 * Step 2 of 2: the microphone, with one consent switch per purpose (record, speech to text)
 * and the all-party wording. "Allow microphone" stays off until both are on; it grants both
 * in the consent ledger (done by the caller). Nothing is recorded before this.
 */
export function MicScreen({
  choices,
  onChange,
  onAllow,
  backHref,
  storageOk,
  storageText,
}: {
  choices: ConsentChoices;
  onChange: (next: ConsentChoices) => void;
  onAllow: () => void;
  backHref: string;
  storageOk: boolean;
  storageText: string;
}): ReactElement {
  const ready = choices.record && choices.transcribe;
  return (
    <Shell bottomNav={false}>
      <main className="cd-main cd-main--mic">
        <div className="cd-mic-wrap cd-stack" style={{ gap: 20, flex: 1 }}>
          <BackLink href={backHref} />
          <StepBar step={2} />
          <span className="cd-mic-icon" aria-hidden="true">
            <CareIcon name="mic" size={64} />
          </span>
          <h1 className="cd-title">{CD.micTitle}</h1>
          <p className="cd-lead">{CD.micLead}</p>
          <ul className="cd-list">
            <li className="cd-list__item">
              <span className="cd-list__icon" aria-hidden="true">
                <CareIcon name="lock2" />
              </span>
              <span>{CD.micNeverSaved}</span>
            </li>
            <li className="cd-list__item">
              <span className="cd-list__icon" aria-hidden="true">
                <CareIcon name="ear" />
              </span>
              <span>{CD.micOnlyWhileOn}</span>
            </li>
          </ul>

          <fieldset className="cd-consent" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="cd-consent__why" style={{ padding: 0, marginBottom: 12 }}>
              {FINAL.consentWording}
            </legend>
            <ToggleRow
              icon="mic"
              label={CD.consentRecord}
              description={CD.consentRecordWhy}
              checked={choices.record}
              onChange={(record) => onChange({ ...choices, record })}
            />
            <ToggleRow
              icon="captions2"
              label={CD.consentTranscribe}
              description={CD.consentTranscribeWhy}
              checked={choices.transcribe}
              onChange={(transcribe) => onChange({ ...choices, transcribe })}
            />
          </fieldset>
          {!storageOk && <StatusMessage status="error" text={{ error: storageText }} />}

          <div className="cd-spacer" />
          <div className="cd-stack" style={{ gap: 14 }}>
            <button
              type="button"
              className="cd-btn cd-btn--primary"
              disabled={!ready}
              onClick={onAllow}
            >
              <CareIcon name="check" size={28} strokeWidth={2.5} />
              <span>{CD.allowMic}</span>
            </button>
            {!ready && <p className="cd-note cd-note--center">{CD.consentNeedBoth}</p>}
            <a className="cd-btn cd-btn--outline" href="#/home">
              {CD.notNow}
            </a>
            <p className="cd-note cd-note--center">{CD.micWithout}</p>
          </div>
        </div>
      </main>
    </Shell>
  );
}
