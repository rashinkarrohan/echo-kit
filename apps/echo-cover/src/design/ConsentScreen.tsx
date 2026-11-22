import type { ReactElement } from "react";
import { FINAL, StatusMessage } from "@echo/ui";
import type { ConsentChoices } from "@echo/ui";
import { CV } from "./copy";
import { CoverIcon } from "./icons";
import { Shell } from "./Shell";
import { BackLink, StepBar, Switch } from "./parts";

/**
 * Step 1 of 3: one switch per purpose (record, speech to text) with the all-party wording. "I agree
 * and continue" works only when both are on, and then grants both in the consent ledger (the
 * caller does that). Nothing is on by default.
 */
export function ConsentScreen({
  choices,
  onChange,
  onAgree,
  storageOk,
  storageText,
}: {
  choices: ConsentChoices;
  onChange: (next: ConsentChoices) => void;
  onAgree: () => void;
  storageOk: boolean;
  storageText: string;
}): ReactElement {
  const ready = choices.record && choices.transcribe;
  return (
    <Shell>
      <main className="cv-main cv-main--flow">
        <BackLink href="#/home" />
        <StepBar step={1} name={CV.stepYourChoices} />
        <h1 className="cv-title">{CV.consentTitle}</h1>
        <p className="cv-lead">{FINAL.consentWording}</p>
        <div className="cv-switchcard">
          <div className="cv-switchcard__text">
            <span className="cv-switchcard__name" id="cv-rec-name">
              {CV.recordSwitch}
            </span>
            <span className="cv-switchcard__why">{CV.recordWhy}</span>
          </div>
          <Switch
            on={choices.record}
            onChange={(record) => onChange({ ...choices, record })}
            labelledBy="cv-rec-name"
          />
        </div>
        <div className="cv-switchcard">
          <div className="cv-switchcard__text">
            <span className="cv-switchcard__name" id="cv-stt-name">
              {CV.sttSwitch}
            </span>
            <span className="cv-switchcard__why">{CV.sttWhy}</span>
          </div>
          <Switch
            on={choices.transcribe}
            onChange={(transcribe) => onChange({ ...choices, transcribe })}
            labelledBy="cv-stt-name"
          />
        </div>
        {!storageOk && <StatusMessage status="error" text={{ error: storageText }} />}
        {!ready && (
          <p className="cv-wait" role="status">
            {CV.turnOnBoth}
          </p>
        )}
        <button
          type="button"
          className="cv-btn cv-btn--primary"
          disabled={!ready}
          onClick={onAgree}
        >
          <CoverIcon name="checkBold" size={30} />
          <span>{CV.agree}</span>
        </button>
        <p className="cv-note">{CV.disclaimer}</p>
      </main>
    </Shell>
  );
}
