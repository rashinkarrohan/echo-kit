import { useState } from "react";
import type { ReactElement } from "react";
import type { ChecklistResult, Receipt } from "@echo/engine";
import { AnchorChip, FINAL } from "@echo/ui";
import type { PlayAnchor } from "@echo/ui";
import { CD } from "./copy";
import { CareIcon } from "./icons";
import { Shell } from "./Shell";
import { BackLink, Chip } from "./parts";
import { answeredCount, askTopic, warningSigns } from "./visitView";

function Disc({ stamp }: { stamp: ChecklistResult["stamp"] }): ReactElement {
  return stamp === "Answered" ? (
    <span className="cd-q__disc" data-tone="heard" aria-hidden="true">
      <CareIcon name="check" size={20} strokeWidth={3} />
    </span>
  ) : stamp === "Unclear" ? (
    <span className="cd-q__disc" data-tone="check" aria-hidden="true">
      <CareIcon name="exclamationMark" size={20} strokeWidth={3} />
    </span>
  ) : (
    <span className="cd-q__disc" data-tone="none" aria-hidden="true">
      <CareIcon name="minus" size={20} strokeWidth={3} />
    </span>
  );
}

/** Questions and safety: when to call (what was said), my questions, and what to do next. */
export function QuestionsScreen({
  receipt,
  sample,
  onPlay,
  playingText,
  playingId,
  onAsk,
  onDelete,
}: {
  receipt: Receipt;
  sample: boolean;
  onPlay?: PlayAnchor;
  playingText: string;
  playingId: string;
  onAsk: (message: string) => void;
  onDelete: () => void;
}): ReactElement {
  const [confirm, setConfirm] = useState(false);
  const signs = warningSigns(receipt);
  const q = answeredCount(receipt.checklist);
  const toAsk = receipt.checklist.filter((c) => c.stamp !== "Answered");

  return (
    <Shell active="visits">
      <main className="cd-main cd-main--questions">
        <header className="cd-head">
          <BackLink href="#/receipt" ariaLabel="Back to visit summary" />
          <h1 className="cd-title">{CD.questionsTitle}</h1>
          <p className="cd-lead cd-lead--soft">
            {sample ? CD.questionsFromPractice : CD.questionsFrom}
          </p>
          <p
            className="cd-note cd-playing"
            role="status"
            aria-live="polite"
            data-playing={playingId}
          >
            {playingText}
          </p>
        </header>

        <section className="cd-warn" aria-labelledby="cd-warn-title">
          <div className="cd-warn__head">
            <span className="cd-warn__tile" aria-hidden="true">
              <CareIcon name="triangleAlert" size={30} />
            </span>
            <h2 className="cd-warn__title" id="cd-warn-title">
              {CD.whenToCall}
            </h2>
          </div>
          {signs.length > 0 ? (
            signs.map((s, i) => (
              <div key={i} className="cd-warn__item">
                <p className="cd-warn__text">“{s.quote}”</p>
                {s.stamp === "check_this" && (
                  <Chip tone="check" icon="exclamationMark">
                    {FINAL.checkThis}
                  </Chip>
                )}
                {onPlay && <AnchorChip anchor={s.anchor} onPlay={onPlay} />}
              </div>
            ))
          ) : (
            <>
              <p className="cd-warn__text">{CD.whenToCallNone}</p>
              <p className="cd-warn__sub">{CD.whenToCallNoneNote}</p>
            </>
          )}
        </section>

        <section className="cd-card" aria-labelledby="cd-q-title">
          <div className="cd-q__head">
            <h2 className="cd-card__title" id="cd-q-title">
              {CD.myQuestions}
            </h2>
            {q.total > 0 && <Chip>{CD.answeredOf(q.answered, q.total)}</Chip>}
          </div>
          {receipt.checklist.length === 0 && <p className="cd-lead">{CD.noQuestions}</p>}
          <ul className="cd-q__list">
            {receipt.checklist.map((c) => (
              <li key={c.item.id} className="cd-q__item" data-stamp={c.stamp}>
                <Disc stamp={c.stamp} />
                <span className="cd-q__body">
                  <span className="cd-q__text">{c.item.text}</span>
                  {c.stamp !== "Answered" && (
                    <span className="cd-q__sub">
                      {c.stamp === "Unclear" ? CD.unclear : CD.notDiscussed}
                    </span>
                  )}
                  {c.stamp === "Answered" && c.anchor && onPlay && (
                    <AnchorChip anchor={c.anchor} onPlay={onPlay} />
                  )}
                </span>
              </li>
            ))}
          </ul>
          {toAsk.map((c) => {
            const topic = askTopic(c.item.id);
            return (
              <button
                key={c.item.id}
                type="button"
                className="cd-btn cd-btn--outline"
                onClick={() => onAsk(c.item.text)}
              >
                {topic ? CD.askAbout(topic) : CD.askThis}
              </button>
            );
          })}
        </section>

        <div className="cd-stack">
          <a className="cd-btn cd-btn--primary cd-btn--two" href="#/label">
            <CareIcon name="squarePlus" size={26} />
            <span className="cd-btn__two">
              <span className="cd-btn__two-main">{CD.atPharmacy}</span>
              <span className="cd-btn__two-sub">{CD.checkLabelMatches}</span>
            </span>
          </a>
          <a className="cd-btn cd-btn--outline" href="#/share">
            <CareIcon name="share" size={24} />
            <span>{CD.shareWithFamily}</span>
          </a>
        </div>

        {confirm ? (
          <div className="cd-confirm" role="alertdialog" aria-label={CD.deleteTitle}>
            <p className="cd-confirm__title">{CD.deleteTitle}</p>
            <p className="cd-confirm__text">{CD.deleteText}</p>
            <button
              type="button"
              className="cd-btn cd-btn--outline"
              onClick={() => setConfirm(false)}
            >
              {CD.keepIt}
            </button>
            <button type="button" className="cd-btn cd-btn--danger-fill" onClick={onDelete}>
              {CD.deleteIt}
            </button>
          </div>
        ) : (
          <button type="button" className="cd-btn cd-btn--danger" onClick={() => setConfirm(true)}>
            <CareIcon name="trash2" size={24} />
            <span>{CD.deleteVisit}</span>
          </button>
        )}

        <p className="cd-note cd-note--center">{receipt.disclaimer || CD.disclaimer}</p>
      </main>
    </Shell>
  );
}
