import type { ReactElement } from "react";
import { FINAL, Icon, StampBadge } from "@echo/ui";
import { CARE } from "./copy";

const STEPS = [
  {
    number: "1",
    title: CARE.homeFollowTitle,
    text: CARE.homeFollowText,
  },
  {
    number: "2",
    title: CARE.homeRepeatTitle,
    text: CARE.homeRepeatText,
  },
  {
    number: "3",
    title: CARE.homeReceiptTitle,
    text: CARE.homeReceiptText,
  },
] as const;

/** Echo Care's no-permission-needed product home. */
export function HomePage(): ReactElement {
  return (
    <main className="care-main care-main--home">
      <header className="care-home__header">
        <a className="care-brand" href="#/home" aria-label={`${CARE.appName} home`}>
          <span className="care-brand__mark" aria-hidden="true">
            <Icon name="check" />
          </span>
          <span>{CARE.appName}</span>
        </a>
        <a className="care-home__trust-link" href="#/trust">
          {CARE.homeTestResults}
        </a>
      </header>

      <div className="care-home">
        <section className="care-home__hero" aria-labelledby="care-home-title">
          <div className="care-home__hero-copy">
            <p className="care-home__eyebrow">{CARE.homeEyebrow}</p>
            <h1 id="care-home-title">{CARE.homeTitle}</h1>
            <p className="care-home__intro">{CARE.homeIntro}</p>
            <div className="care-home__actions">
              <a className="echo-button care-home__primary" href="#/consent">
                {CARE.homeStart}
              </a>
              <a
                className="echo-button echo-button--secondary"
                href="?sample=care-01&demo=1#/doctor-card"
              >
                {FINAL.playSampleConsult}
              </a>
            </div>
            <p className="care-home__sample-note">{CARE.sampleIntro}</p>
          </div>

          <section className="care-home__preview" aria-label={CARE.homeExampleLabel}>
            <p className="care-home__preview-kicker">{CARE.homeAfterConversation}</p>
            <h2>{CARE.homeExampleTitle}</h2>
            <dl className="care-home__preview-lines">
              <div>
                <dt>{CARE.homeExampleMedicine}</dt>
                <dd>
                  <StampBadge stamp="heard_clearly" />
                </dd>
              </div>
              <div>
                <dt>{CARE.homeExampleDose}</dt>
                <dd>
                  <StampBadge stamp="check_this" />
                </dd>
              </div>
              <div>
                <dt>{CARE.homeExampleSideEffects}</dt>
                <dd>
                  <StampBadge stamp="not_said" />
                </dd>
              </div>
            </dl>
            <p className="care-home__preview-note">
              <Icon name="play" />
              <span>{CARE.homeAnchorText}</span>
            </p>
          </section>
        </section>

        <section className="care-home__how" aria-labelledby="care-how-title">
          <p className="care-home__section-kicker">{CARE.homeBuiltFor}</p>
          <h2 id="care-how-title">{CARE.homeStepsTitle}</h2>
          <ol className="care-home__steps">
            {STEPS.map((step) => (
              <li key={step.number} className="echo-card care-home__step">
                <span className="care-home__step-number" aria-hidden="true">
                  {step.number}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="care-home__privacy" aria-labelledby="care-privacy-title">
          <div className="care-home__privacy-icon" aria-hidden="true">
            <Icon name="check" />
          </div>
          <div>
            <h2 id="care-privacy-title">{CARE.homePrivacyTitle}</h2>
            <p className="care-home__privacy-lead">{CARE.homePrivacyText}</p>
            <p>{CARE.homePrivacyDetail}</p>
          </div>
        </section>

        <p className="echo-disclaimer care-home__disclaimer">{FINAL.disclaimerCare}</p>
      </div>
    </main>
  );
}
