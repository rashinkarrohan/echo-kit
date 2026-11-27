import { useState } from "react";
import type { ReactElement } from "react";
import type { Receipt } from "@echo/engine";
import { ADDED, FINAL, factLabel, fieldLabel } from "@echo/ui";
import type { PlayAnchor } from "@echo/ui";
import { CV } from "./copy";
import { CoverIcon } from "./icons";
import { Shell } from "./Shell";
import { BackLink, Chip, HearButtons } from "./parts";
import { questionChip } from "./ledger";

/** One seller's receipt: the planned questions, then every fact with its quote and a Hear it. */
export function ReceiptScreen({
  seller,
  receipt,
  number,
  salesCount,
  sample,
  planned,
  fieldsByKey,
  onPlay,
  playingText,
  playingId,
  onDelete,
}: {
  seller: string;
  receipt: Receipt;
  /** Which seller this is, from 1 */
  number: number;
  salesCount: number;
  sample: boolean;
  planned: readonly string[];
  fieldsByKey: Record<string, string[]>;
  /** Absent when no audio is kept for this conversation */
  onPlay?: PlayAnchor;
  playingText: string;
  playingId: string;
  onDelete: () => void;
}): ReactElement {
  const [confirm, setConfirm] = useState(false);
  const canCompare = salesCount >= 2;
  return (
    <Shell>
      <main className="cv-main cv-main--flow">
        <BackLink href="#/home" />
        <header className="cv-head">
          <span className="cv-kicker">{CV.receiptKicker(number)}</span>
          <h1 className="cv-title">{CV.receiptTitle(seller)}</h1>
        </header>
        {sample && <Chip tone="sample">{CV.sampleChip}</Chip>}
        <p className="cv-note cv-playing" role="status" aria-live="polite" data-playing={playingId}>
          {playingText}
        </p>
        <section className="cv-progress" aria-label="Comparison progress" data-ready={canCompare}>
          <span className="cv-progress__icon" aria-hidden="true">
            <CoverIcon name="warningDuotone" size={30} />
          </span>
          <span className="cv-progress__text">
            {canCompare ? CV.progressMany(salesCount) : CV.progressOne}
          </span>
        </section>

        <section className="cv-card" aria-labelledby="cv-yq">
          <h2 className="cv-card__title" id="cv-yq">
            {CV.yourQuestions}
          </h2>
          <ul className="cv-qrows">
            {receipt.checklist.map((c) => {
              const chip = questionChip(c.stamp);
              return (
                <li key={c.item.id} className="cv-qrow">
                  <span className="cv-qrow__text">{c.item.text}</span>
                  <div className="cv-qrow__chips">
                    <Chip tone={chip.tone}>{chip.word}</Chip>
                    {c.stamp === "Answered" && c.anchor && onPlay && (
                      <HearButtons anchor={c.anchor} onPlay={onPlay} slower={false} />
                    )}
                  </div>
                  {planned.includes(c.item.id) && (
                    <span className="cv-qrow__planned">{CV.planned}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="cv-legend">
            <span className="cv-legend__title">{CV.labelsMean}</span>
            <Chip tone="said">{FINAL.heardClearly}</Chip>
            <Chip tone="check">{FINAL.checkThis}</Chip>
            <Chip tone="none">{FINAL.notSaid}</Chip>
          </div>
          <p className="cv-note">{ADDED.heardClearlyNote}</p>
        </section>

        <h2 className="echo-visually-hidden">{CV.factsHeading(seller)}</h2>
        {receipt.facts.map((fact, i) => (
          <section
            key={`${fact.key}-${i}`}
            className="cv-card echo-receipt-line"
            style={{ "--line": i } as React.CSSProperties}
            aria-label={factLabel(fact.key)}
          >
            <div className="cv-card__head">
              <h3 className="cv-card__title">{factLabel(fact.key)}</h3>
              <Chip tone={fact.stamp === "heard_clearly" ? "said" : "check"}>
                {fact.stamp === "heard_clearly" ? FINAL.heardClearly : FINAL.checkThis}
              </Chip>
            </div>
            {(fieldsByKey[fact.key] ?? Object.keys(fact.fields)).map((field) => (
              <div key={field} className="cv-field">
                <span className="cv-field__label">{fieldLabel(field)}</span>
                {fact.fields[field] ? (
                  <span className="cv-field__value">{fact.fields[field]}</span>
                ) : (
                  <Chip tone="none">{FINAL.notSaid}</Chip>
                )}
              </div>
            ))}
            <p className="cv-quote">“{fact.anchor.quote}”</p>
            <HearButtons anchor={fact.anchor} {...(onPlay ? { onPlay } : {})} />
          </section>
        ))}
        {receipt.facts.length === 0 && (
          <section className="cv-card">
            <p className="cv-lead">{CV.nothingHeard}</p>
          </section>
        )}

        <a className="cv-btn cv-btn--primary" href="#/record">
          <CoverIcon name="plusBold" size={30} />
          <span>{CV.recordAnother}</span>
        </a>
        {canCompare ? (
          <a className="cv-btn cv-btn--outline" href="#/compare">
            <CoverIcon name="columnsDuotone" size={26} />
            <span>{CV.compareSellers}</span>
          </a>
        ) : (
          <>
            <button
              type="button"
              className="cv-btn cv-btn--outline"
              disabled
              aria-describedby="cv-need-two"
            >
              <CoverIcon name="columnsDuotone" size={26} />
              <span>{CV.compareSellers}</span>
            </button>
            <p className="cv-note cv-note--tight" id="cv-need-two">
              {CV.needTwo(salesCount)}
            </p>
          </>
        )}
        <a className="cv-btn cv-btn--outline" href={`#/confirm/${number}`}>
          <CoverIcon name="chatTextDuotone" size={26} />
          <span>{CV.draft}</span>
        </a>
        {confirm ? (
          <div className="cv-confirm" role="alertdialog" aria-label={CV.deleteTitle(seller)}>
            <p className="cv-confirm__title">{CV.deleteTitle(seller)}</p>
            <p className="cv-confirm__text">{CV.deleteText}</p>
            <button
              type="button"
              className="cv-btn cv-btn--outline"
              onClick={() => setConfirm(false)}
            >
              {CV.keepIt}
            </button>
            <button type="button" className="cv-btn cv-btn--danger-fill" onClick={onDelete}>
              {CV.deleteIt}
            </button>
          </div>
        ) : (
          <button type="button" className="cv-btn cv-btn--danger" onClick={() => setConfirm(true)}>
            <CoverIcon name="trashDuotone" size={24} />
            <span>{CV.deleteSeller}</span>
          </button>
        )}
        <p className="cv-note">{CV.disclaimer}</p>
      </main>
    </Shell>
  );
}
