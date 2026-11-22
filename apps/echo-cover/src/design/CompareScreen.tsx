import type { CSSProperties, ReactElement } from "react";
import type { Anchor, QuoteComparisonRow } from "@echo/engine";
import { factLabel } from "@echo/ui";
import type { PlayAnchor } from "@echo/ui";
import { CV } from "./copy";
import { CoverIcon } from "./icons";
import { Shell } from "./Shell";
import { BackLink, Chip, HearButtons } from "./parts";
import { rowNote } from "./ledger";

/**
 * The seller ledger: one card per topic, sellers side by side in the order they were recorded. It
 * says what each seller said and what nobody said. It never picks, ranks or scores a seller.
 */
export function CompareScreen({
  rows,
  sellers,
  sample,
  onPlay,
  canPlay,
  playingText,
  playingId,
  backHref,
}: {
  rows: QuoteComparisonRow[];
  sellers: ReadonlyArray<{ name: string; number: number }>;
  sample: boolean;
  onPlay: PlayAnchor;
  canPlay: (anchor: Anchor) => boolean;
  playingText: string;
  playingId: string;
  backHref: string;
}): ReactElement {
  const vars = { "--sellers": sellers.length } as CSSProperties;
  return (
    <Shell active="compare" bottomNav>
      <main className="cv-main cv-main--compare" style={vars}>
        <BackLink href={backHref} />
        <div className="cv-compare-head">
          <header className="cv-head">
            <span className="cv-kicker">{CV.sellersRecorded(sellers.length)}</span>
            <h1 className="cv-title">{CV.ledgerHeading}</h1>
            <p className="cv-lead cv-lead--tight">{CV.ledgerLead}</p>
          </header>
          <div className="cv-compare-actions">
            <a className="cv-btn cv-btn--outline" href="#/record">
              <CoverIcon name="plusBold" size={26} />
              <span>{CV.recordAnother}</span>
            </a>
            <a
              className="cv-btn cv-btn--primary cv-btn--draft"
              href={`#/confirm/${sellers.length}`}
            >
              <CoverIcon name="chatTextDuotone" size={28} />
              <span>{CV.draft}</span>
            </a>
          </div>
        </div>
        {sample && <Chip tone="sample">{CV.sampleChip}</Chip>}
        <nav className="cv-receipts" aria-label={CV.receiptsLabel}>
          <span className="cv-receipts__label">{CV.receiptsLabel}</span>
          {sellers.map((s) => (
            <a key={s.number} className="cv-btn cv-btn--source" href={`#/review/${s.number}`}>
              {s.name}
            </a>
          ))}
        </nav>
        <p className="cv-note cv-playing" role="status" aria-live="polite" data-playing={playingId}>
          {playingText}
        </p>
        <div className="cv-ledgerwrap">
          {rows.map((row) => {
            const note = rowNote(row);
            return (
              <section
                key={row.field}
                className="cv-card cv-topic"
                aria-label={factLabel(row.field)}
                data-differs={row.differs}
              >
                <h2 className="cv-card__title cv-topic__title">{factLabel(row.field)}</h2>
                <div className="cv-topic__cells">
                  {row.cells.map((cell) => (
                    <div key={cell.conversationId} className="cv-cell">
                      <span className="cv-cell__seller">{cell.seller}</span>
                      <span className="cv-cell__value">
                        {cell.value === null ? (
                          <span aria-hidden="true">{CV.notThere}</span>
                        ) : (
                          cell.value
                        )}
                      </span>
                      <Chip tone={cell.value === null ? "none" : "said"}>
                        {cell.value === null ? CV.notSaid : CV.said}
                      </Chip>
                      {cell.value !== null && cell.anchor && (
                        <HearButtons
                          anchor={cell.anchor}
                          slower={false}
                          {...(canPlay(cell.anchor) ? { onPlay } : {})}
                        />
                      )}
                    </div>
                  ))}
                </div>
                {note.text && <p className={`cv-rownote cv-rownote--${note.tone}`}>{note.text}</p>}
              </section>
            );
          })}
        </div>
        <a
          className="cv-btn cv-btn--primary cv-btn--draft-mobile"
          href={`#/confirm/${sellers.length}`}
        >
          <CoverIcon name="chatTextDuotone" size={28} />
          <span>{CV.draft}</span>
        </a>
        <a className="cv-btn cv-btn--outline cv-btn--add-mobile" href="#/record">
          <CoverIcon name="plusBold" size={26} />
          <span>{CV.recordAnother}</span>
        </a>
        <p className="cv-note">{CV.disclaimer}</p>
      </main>
    </Shell>
  );
}
