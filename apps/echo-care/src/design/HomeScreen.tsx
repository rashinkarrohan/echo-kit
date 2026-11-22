import type { ReactElement } from "react";
import type { SavedVisit } from "../visit";
import { CD } from "./copy";
import { CareIcon } from "./icons";
import { Hero } from "./Brand";
import { Shell } from "./Shell";
import { useDesktop } from "./hooks";
import { dayLabel, lastVisitTitle } from "./visitView";

export type LastVisit = SavedVisit;

const PRACTICE_HREF = "?sample=care-01&demo=1#/doctor-card";

function StartButton({ desktop }: { desktop: boolean }): ReactElement {
  return desktop ? (
    <a className="cd-btn cd-btn--primary cd-btn--cta" href="#/doctor-card">
      <CareIcon name="captions2" size={30} strokeWidth={2.25} />
      <span className="cd-btn__label">{CD.startVisit}</span>
    </a>
  ) : (
    <a className="cd-btn cd-btn--primary cd-btn--cta" href="#/doctor-card">
      <span className="cd-btn__disc" aria-hidden="true">
        <CareIcon name="captions2" size={28} strokeWidth={2.25} />
      </span>
      <span className="cd-btn__label">{CD.startVisit}</span>
      <CareIcon name="chevronRight" size={28} strokeWidth={2.5} />
    </a>
  );
}

function PracticeButton({ desktop }: { desktop: boolean }): ReactElement {
  return (
    <a className="cd-btn cd-btn--outline" href={PRACTICE_HREF}>
      <CareIcon name="circlePlay" size={desktop ? 28 : 24} strokeWidth={2.25} />
      <span>{CD.practiceVisit}</span>
    </a>
  );
}

/** Home: no permission needed, so it renders while on-device storage opens. */
export function HomeScreen({
  last,
  notice,
  onOpenLast,
}: {
  last?: LastVisit;
  /** A one-time message, such as "Visit deleted" */
  notice?: string;
  onOpenLast: () => void;
}): ReactElement {
  const desktop = useDesktop();
  const lastCard = last && (
    <a
      className="cd-last"
      href="#/receipt"
      onClick={(e) => {
        e.preventDefault();
        onOpenLast();
      }}
    >
      <span className="cd-tile" aria-hidden="true">
        <CareIcon name="history" size={desktop ? 34 : 26} />
      </span>
      <span className="cd-last__text">
        <span className="cd-last__kicker">{CD.lastVisit(dayLabel(last.receipt.timestamp))}</span>
        <span className="cd-last__title">{lastVisitTitle(last.receipt, last.stage)}</span>
      </span>
      <CareIcon name="chevronRight" size={desktop ? 32 : 28} strokeWidth={2.5} />
    </a>
  );

  return (
    <Shell active="home" topBar>
      <main className="cd-main cd-main--home">
        {notice && (
          <p className="cd-status cd-notice" role="status">
            {notice}
          </p>
        )}
        <section className="cd-hero" aria-labelledby="cd-home-title">
          <span className="cd-hero__tag">
            <CareIcon name="ear" size={desktop ? 26 : 20} />
            <span>{CD.homeTag}</span>
          </span>
          <h1 className="cd-hero__title" id="cd-home-title">
            {CD.homeTitle}
          </h1>
          <p className="cd-hero__lead">{CD.homeLead}</p>
          {!desktop && <Hero />}
          {desktop && (
            <div className="cd-hero__actions">
              <StartButton desktop />
              <PracticeButton desktop />
            </div>
          )}
        </section>

        {desktop ? (
          <div className="cd-home-side">
            <section className="cd-live" aria-label={CD.liveExample}>
              <span className="cd-live__label">
                <span className="cd-live__dot" aria-hidden="true" />
                {CD.liveExample}
              </span>
              <Hero />
            </section>
            {lastCard}
          </div>
        ) : (
          <>
            <div className="cd-stack cd-mobile-actions">
              <StartButton desktop={false} />
              <PracticeButton desktop={false} />
            </div>
            {lastCard}
          </>
        )}

        <p className="cd-home-links">
          <a href="#/pharmacy">{CD.pharmacyVisit}</a>
          <a href="#/trust">{CD.testResults}</a>
        </p>
        <p className="cd-privacy">
          <CareIcon name="lock" size={22} />
          <span>{CD.homePrivacy}</span>
        </p>
      </main>
    </Shell>
  );
}
