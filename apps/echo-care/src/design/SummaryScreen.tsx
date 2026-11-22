import type { CSSProperties, ReactElement } from "react";
import type { Anchor, Receipt, VerifiedFact } from "@echo/engine";
import { AnchorChip, FINAL, clock } from "@echo/ui";
import type { PlayAnchor } from "@echo/ui";
import type { Stage } from "../env";
import { CD } from "./copy";
import { CareIcon } from "./icons";
import { Shell } from "./Shell";
import { BackLink, Chip, Tile } from "./parts";
import { useDesktop } from "./hooks";
import {
  answeredCount,
  dayLabel,
  glance,
  medicineRows,
  nextVisit,
  sentenceCase,
} from "./visitView";

export interface SummaryProps {
  stage: Stage;
  receipt: Receipt;
  sample: boolean;
  /** Hear it / Slower; absent when no audio is kept for this visit */
  onPlay?: PlayAnchor;
  playingText: string;
  playingId: string;
  /** Why a medicine line needs checking, in plain words */
  noteFor: (fact: VerifiedFact) => string | undefined;
  /** Open the speaker-facing "ask" card */
  onAsk: (message: string) => void;
}

const stampChip = (stamp: VerifiedFact["stamp"], label?: string): ReactElement =>
  stamp === "heard_clearly" ? (
    <Chip tone="teal" icon="check">
      {label ?? FINAL.heardClearly}
    </Chip>
  ) : (
    <Chip tone="check" icon="exclamationMark">
      {label ?? FINAL.checkThis}
    </Chip>
  );

const OTHER_FACT_TITLES: Readonly<Record<string, string>> = {
  side_effects: "Side effects",
  missed_dose: "If a dose is missed",
};

function dateLine(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function QuoteBox({ fact, desktop }: { fact: VerifiedFact; desktop: boolean }): ReactElement {
  return (
    <div className="cd-quote">
      <span className="cd-quote__label">{`${CD.said} · ${clock(fact.anchor.startMs)}`}</span>
      <p className="cd-quote__text">{desktop ? `“${fact.anchor.quote}”` : fact.anchor.quote}</p>
    </div>
  );
}

/** Hear it and Slower, or a plain "Audio not kept" when this visit has no audio. */
function Hear({ anchor, onPlay }: { anchor: Anchor; onPlay?: PlayAnchor }): ReactElement {
  return (
    <div className="cd-hear">
      <AnchorChip anchor={anchor} {...(onPlay ? { onPlay } : {})} />
    </div>
  );
}

/** Visit summary: counts, one card per medicine, the next visit, and a way into questions and safety. */
export function SummaryScreen(props: SummaryProps): ReactElement {
  const { stage, receipt, sample, onPlay, noteFor } = props;
  const desktop = useDesktop();
  const g = glance(receipt);
  const q = answeredCount(receipt.checklist);
  const next = nextVisit(receipt);
  const medicines = receipt.facts.filter((f) => f.key === "medicine");
  const others = receipt.facts.filter((f) => f.key in OTHER_FACT_TITLES);
  const canShowDoctor = receipt.readBack.length > 0;
  const heardShare = g.total === 0 ? 0 : g.heard / g.total;

  const glanceBlock = (
    <section className="cd-card cd-glance" aria-label={CD.atAGlance}>
      <div className="cd-glance__head">
        <h2 className="cd-glance__title">{CD.atAGlance}</h2>
        <span className="cd-glance__count">{CD.things(g.total)}</span>
      </div>
      {g.total > 0 && (
        <div className="cd-bar" aria-hidden="true">
          <span className="cd-bar__fill" style={{ width: `${Math.round(heardShare * 100)}%` }} />
        </div>
      )}
      <div className="cd-glance__rows">
        <div className="cd-glance__row" data-tone="heard">
          <span className="cd-glance__disc">
            <CareIcon name="check" size={22} strokeWidth={2.75} />
          </span>
          <span className="cd-glance__label">{CD.glanceHeard}</span>
          <span className="cd-glance__num">{g.heard}</span>
        </div>
        <div className="cd-glance__row" data-tone="check">
          <span className="cd-glance__disc">
            <CareIcon name="exclamationMark" size={22} strokeWidth={2.75} />
          </span>
          <span className="cd-glance__label">{CD.glanceCheck}</span>
          <span className="cd-glance__num">{g.check}</span>
        </div>
        <div className="cd-glance__row" data-tone="none">
          <span className="cd-glance__disc">
            <CareIcon name="minus" size={22} strokeWidth={2.75} />
          </span>
          <span className="cd-glance__label">{CD.glanceNotSaid}</span>
          <span className="cd-glance__num">{g.notSaid}</span>
        </div>
      </div>
    </section>
  );

  const medicineCards = medicines.map((fact, i) => {
    const name = fact.fields["name"]?.trim();
    const note = noteFor(fact);
    return (
      <article
        key={`${fact.key}-${i}`}
        className="cd-card cd-med echo-receipt-line"
        style={{ "--line": i } as CSSProperties}
        aria-label={name ? sentenceCase(name) : CD.medicineKicker}
      >
        <div className="cd-med__head">
          <Tile icon="pill" size={desktop ? 34 : 30} />
          <div className="cd-med__title">
            <span className="cd-med__kicker">{CD.medicineKicker}</span>
            <h2 className="cd-med__name">{name ? sentenceCase(name) : CD.notSaid}</h2>
          </div>
        </div>
        {stampChip(fact.stamp)}
        {note && <p className="cd-note-box">{note}</p>}
        <dl className="cd-rows">
          {medicineRows(fact, stage).map((row) => (
            <div key={row.label} className="cd-rows__row">
              <dt>{row.label}</dt>
              <dd data-missing={row.value === undefined ? "true" : undefined}>
                {row.value ?? CD.notSaid}
              </dd>
            </div>
          ))}
        </dl>
        <QuoteBox fact={fact} desktop={desktop} />
        <Hear anchor={fact.anchor} {...(onPlay ? { onPlay } : {})} />
        {canShowDoctor && (
          <a className="cd-btn cd-btn--primary cd-btn--medium" href="#/read-back">
            <CareIcon name={desktop ? "captions" : "eye"} size={24} />
            <span>{CD.showDoctor}</span>
          </a>
        )}
      </article>
    );
  });

  const otherCards = others.map((fact, i) => (
    <article
      key={`${fact.key}-${i}`}
      className="cd-card cd-med echo-receipt-line"
      style={{ "--line": medicines.length + i } as CSSProperties}
    >
      <h2 className="cd-card__title">{OTHER_FACT_TITLES[fact.key]}</h2>
      {stampChip(fact.stamp)}
      <QuoteBox fact={fact} desktop={desktop} />
      <Hear anchor={fact.anchor} {...(onPlay ? { onPlay } : {})} />
    </article>
  ));

  const nextCard = stage === "doctor" && (
    <section className="cd-card" aria-labelledby="cd-next-title">
      <div className="cd-med__head">
        <Tile icon="calendar" size={desktop ? 34 : 30} />
        <h2 className="cd-card__title" id="cd-next-title">
          {CD.nextVisit}
        </h2>
      </div>
      {next.heard && next.text ? (
        <>
          <p className="cd-next__text">{sentenceCase(next.text)}</p>
          <div className="cd-chips">
            {next.stamp &&
              stampChip(
                next.stamp,
                CD.timing(next.stamp === "heard_clearly" ? "heard clearly" : "check this"),
              )}
            {next.exactDate ? (
              <Chip tone="teal" icon="check">
                {CD.exactDateHeard}
              </Chip>
            ) : (
              <Chip tone="none" icon="minus">
                {CD.exactDateNotSaid}
              </Chip>
            )}
          </div>
          {next.anchor && <Hear anchor={next.anchor} {...(onPlay ? { onPlay } : {})} />}
        </>
      ) : (
        <>
          <p className="cd-next__text">{desktop ? "No date was said." : CD.notSaid}</p>
          <div className="cd-chips">
            <Chip tone="none" icon="minus">
              {CD.exactDateNotSaid}
            </Chip>
          </div>
        </>
      )}
      {!next.exactDate && (
        <button
          type="button"
          className="cd-btn cd-btn--outline"
          onClick={() => props.onAsk(CD.askDateMessage)}
        >
          {CD.askDate}
        </button>
      )}
    </section>
  );

  const questionsLink = (
    <a className="cd-link-card" href="#/questions">
      <span className="cd-link-card__tile" aria-hidden="true">
        <CareIcon name="circleHelp" size={28} />
      </span>
      <span className="cd-link-card__text">
        <span className="cd-link-card__title">{CD.questionsSafety}</span>
        <span className="cd-link-card__sub">
          {q.total > 0 ? CD.answeredOf(q.answered, q.total) : CD.whenToCall}
        </span>
      </span>
      <CareIcon name="chevronRight" size={28} strokeWidth={2.5} />
    </a>
  );

  return (
    <Shell active="visits">
      <main className="cd-main cd-main--summary">
        <header className="cd-head">
          <BackLink href="#/home" ariaLabel="Back to home" />
          {desktop && (
            <span className="cd-head__kicker">{`${CD.summaryKicker} · ${dayLabel(receipt.timestamp)}`}</span>
          )}
          <h1 className="cd-title">
            {desktop
              ? CD.summaryTitleDesktop
              : stage === "doctor"
                ? CD.summaryTitle
                : CD.summaryTitlePharmacy}
          </h1>
          <div className="cd-date">
            <CareIcon name="calendar" size={24} />
            <span>{dateLine(receipt.timestamp)}</span>
          </div>
          {sample && <Chip tone="plain">{CD.practiceBadge}</Chip>}
          <p
            className="cd-note cd-playing"
            role="status"
            aria-live="polite"
            data-playing={props.playingId}
          >
            {props.playingText}
          </p>
        </header>
        <div className="cd-summary-cols">
          <div className="cd-summary-col">
            {!desktop && glanceBlock}
            {medicineCards}
            {otherCards}
            {medicines.length === 0 && others.length === 0 && (
              <section className="cd-card">
                <h2 className="cd-card__title">{CD.nothingHeard}</h2>
                <p className="cd-lead">{CD.nothingHeardText}</p>
              </section>
            )}
          </div>
          <div className="cd-summary-col">
            {desktop && glanceBlock}
            {nextCard}
            {questionsLink}
          </div>
        </div>
        <p className="cd-note cd-note--center">{CD.disclaimer}</p>
      </main>
    </Shell>
  );
}
