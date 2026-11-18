import type { ReactElement } from "react";
import { FINAL, Icon } from "@echo/ui";
import { COVER } from "./copy";

const STEPS = [
  ["1", COVER.homePlanTitle, COVER.homePlanText],
  ["2", COVER.homeRecordTitle, COVER.homeRecordText],
  ["3", COVER.homeCompareTitle, COVER.homeCompareText],
] as const;

export function HomePage({ savedCount = 0 }: { savedCount?: number }): ReactElement {
  return (
    <div className="cover-home">
      {savedCount > 0 && (
        <section className="cover-home__saved" aria-label={COVER.savedSummary(savedCount)}>
          <div>
            <strong>{COVER.savedSummary(savedCount)}</strong>
            <span>{COVER.savedAudioNote}</span>
          </div>
          <a className="echo-button echo-button--secondary" href="#/saved">
            {COVER.openSaved}
          </a>
        </section>
      )}

      <section className="cover-home__hero" aria-labelledby="cover-home-title">
        <div className="cover-home__copy">
          <p className="cover-kicker">{COVER.homeEyebrow}</p>
          <h1 id="cover-home-title">{COVER.homeTitle}</h1>
          <p className="cover-home__intro">{COVER.homeIntro}</p>
          <div className="cover-home__actions">
            <a className="echo-button" href="#/consent">
              {COVER.homeStart}
            </a>
            <a
              className="echo-button echo-button--secondary"
              href="?sample=sales&demo=1#/questions"
            >
              {FINAL.playSampleConsult}
            </a>
          </div>
          <p className="cover-home__sample">{COVER.sampleIntro}</p>
        </div>

        <section className="cover-home__ledger" aria-label={COVER.homeExampleLabel}>
          <p className="cover-kicker">{COVER.homeExampleKicker}</p>
          <h2>{COVER.homeExampleTitle}</h2>
          <div className="cover-home__ledger-head" aria-hidden="true">
            <span />
            <strong>{COVER.homeSellerOne}</strong>
            <strong>{COVER.homeSellerTwo}</strong>
          </div>
          {[
            [COVER.homePrice, "said", "said"],
            [COVER.homeIncluded, "said", "missing"],
            [COVER.homeTrial, "missing", "said"],
          ].map(([label, first, second]) => (
            <div className="cover-home__ledger-row" key={label}>
              <strong>{label}</strong>
              <span className={`cover-home__ledger-cell cover-home__ledger-cell--${first}`}>
                <Icon name={first === "said" ? "check" : "dash"} />
                {first === "said" ? COVER.homeSaid : FINAL.notDiscussed}
              </span>
              <span className={`cover-home__ledger-cell cover-home__ledger-cell--${second}`}>
                <Icon name={second === "said" ? "check" : "dash"} />
                {second === "said" ? COVER.homeSaid : FINAL.notDiscussed}
              </span>
            </div>
          ))}
          <p className="cover-home__ledger-note">{COVER.homeNeutrality}</p>
        </section>
      </section>

      <section className="cover-home__how" aria-labelledby="cover-how-title">
        <p className="cover-kicker">{COVER.homeStepsKicker}</p>
        <h2 id="cover-how-title">{COVER.homeStepsTitle}</h2>
        <ol>
          {STEPS.map(([number, title, text]) => (
            <li key={number}>
              <span aria-hidden="true">{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="cover-home__privacy" aria-labelledby="cover-privacy-title">
        <Icon name="check" />
        <div>
          <h2 id="cover-privacy-title">{COVER.homePrivacyTitle}</h2>
          <p>{COVER.homePrivacyText}</p>
          <p>{COVER.homePrivacyDetail}</p>
        </div>
      </section>
      <p className="echo-disclaimer">{FINAL.disclaimerCover}</p>
    </div>
  );
}
