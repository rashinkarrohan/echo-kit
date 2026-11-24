import type { ReactElement } from "react";
import { useDesktop } from "@echo/ui";
import { CV } from "./copy";
import { CoverIcon } from "./icons";
import { HeroArt } from "./Brand";
import { Shell } from "./Shell";
import { Chip } from "./parts";

const SAMPLE_HREF = "?sample=sales&demo=1#/questions";

type Said = "said" | "none";
const LEDGER: ReadonlyArray<readonly [string, Said, Said]> = [
  [CV.totalPrice, "said", "said"],
  [CV.whatIsIncluded, "said", "none"],
  [CV.trialReturns, "none", "said"],
];
const STEPS: ReadonlyArray<readonly [string, string, string]> = [
  ["1", CV.step1Title, CV.step1Text],
  ["2", CV.step2Title, CV.step2Text],
  ["3", CV.step3Title, CV.step3Text],
];

const cellChip = (state: Said): ReactElement => (
  <Chip tone={state}>{state === "said" ? CV.said : CV.notDiscussed}</Chip>
);

/** The three steps, shared by Home and the empty seller ledger. */
export function Steps(): ReactElement {
  return (
    <ol className="cv-steps">
      {STEPS.map(([n, title, text]) => (
        <li key={n} className="cv-step">
          <span className="cv-step__num" aria-hidden="true">
            {n}
          </span>
          <div className="cv-step__text">
            <span className="cv-step__title">{title}</span>
            <span className="cv-step__body">{text}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Home: no permission needed, so it renders while on-device storage opens. */
export function HomeScreen({ savedCount }: { savedCount: number }): ReactElement {
  const desktop = useDesktop();

  const startButton = (
    <a className="cv-btn cv-btn--primary cv-btn--start" href="#/consent">
      <CoverIcon name="columnsDuotone" size={30} />
      <span>{CV.startComparing}</span>
    </a>
  );
  const sampleButton = (
    <a className="cv-btn cv-btn--outline cv-btn--sample" href={SAMPLE_HREF}>
      <CoverIcon name="playCircleDuotone" size={28} />
      <span>{CV.playSample}</span>
    </a>
  );

  return (
    <Shell active="home" topBar bottomNav>
      <main className="cv-main cv-main--home">
        <div className="cv-home-top">
          <section className="cv-hero" aria-labelledby="cv-home-title">
            <span className="cv-hero__tag">
              <CoverIcon name="earDuotone" size={desktop ? 26 : 22} />
              <span>{CV.tag}</span>
            </span>
            <h1 className="cv-hero__title" id="cv-home-title">
              {CV.homeTitle}
            </h1>
            <p className="cv-hero__lead">{CV.homeLead}</p>
            {desktop && (
              <div className="cv-hero__actions">
                {startButton}
                {sampleButton}
              </div>
            )}
            <div className="cv-hero__art">
              <HeroArt />
            </div>
            {desktop && <p className="cv-hero__note">{CV.sampleNote}</p>}
          </section>

          {!desktop && (
            <>
              {startButton}
              {sampleButton}
              <p className="cv-note cv-note--tight">{CV.sampleNote}</p>
            </>
          )}

          {savedCount > 0 && (
            <a className="cv-saved-card" href="#/saved">
              <span className="cv-saved-card__text">
                <span className="cv-saved-card__title">{CV.savedCard(savedCount)}</span>
                <span className="cv-saved-card__sub">{CV.savedOpen}</span>
              </span>
              <CoverIcon name="caretLeftBold" size={26} className="cv-flip" />
            </a>
          )}

          <section className="cv-card cv-ledger" aria-label={CV.ledgerExample}>
            <span className="cv-kicker">{CV.ledgerKicker}</span>
            <h2 className="cv-ledger__title">{CV.ledgerTitle}</h2>
            {desktop ? (
              <div className="cv-ledger__grid">
                <span aria-hidden="true" />
                <span className="cv-ledger__colhead" aria-hidden="true">
                  {CV.seller1}
                </span>
                <span className="cv-ledger__colhead" aria-hidden="true">
                  {CV.seller2}
                </span>
                {LEDGER.map(([label, first, second]) => (
                  <div key={label} className="cv-ledger__row--wide">
                    <span className="cv-ledger__label">{label}</span>
                    <span>{cellChip(first)}</span>
                    <span>{cellChip(second)}</span>
                  </div>
                ))}
              </div>
            ) : (
              LEDGER.map(([label, first, second]) => (
                <div key={label} className="cv-ledger__row">
                  <span className="cv-ledger__label">{label}</span>
                  <div className="cv-ledger__line">
                    <span className="cv-ledger__who">{CV.seller1}</span>
                    {cellChip(first)}
                  </div>
                  <div className="cv-ledger__line">
                    <span className="cv-ledger__who">{CV.seller2}</span>
                    {cellChip(second)}
                  </div>
                </div>
              ))
            )}
            <p className="cv-note">{CV.ledgerNote}</p>
          </section>
        </div>

        <h2 className="cv-section-title">{CV.howTitle}</h2>
        <Steps />

        <section className="cv-private" aria-labelledby="cv-private-title">
          <span className="cv-private__icon" aria-hidden="true">
            <CoverIcon name="lockDuotone" size={desktop ? 36 : 30} />
          </span>
          <h2 className="cv-private__title" id="cv-private-title">
            {CV.privateTitle}
          </h2>
          <div className="cv-private__body">
            {desktop ? (
              <p>{CV.privateDesktop}</p>
            ) : (
              <>
                <p>{CV.privateText}</p>
                <p className="cv-strong">{CV.privateDetail}</p>
              </>
            )}
          </div>
        </section>
        <p className="cv-note">{CV.disclaimer}</p>
      </main>
    </Shell>
  );
}
