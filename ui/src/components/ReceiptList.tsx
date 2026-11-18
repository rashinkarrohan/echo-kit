import type { CSSProperties, ReactElement } from "react";
import type { VerifiedFact } from "@echo/engine";
import { ADDED, factLabel, fieldLabel } from "../copy";
import { StampBadge, StatusMessage } from "./common";
import type { ViewStatus } from "./common";
import { AnchorChip } from "./AnchorChip";
import type { PlayAnchor } from "./AnchorChip";

export interface ReceiptListProps {
  facts: VerifiedFact[];
  /** Schema fields per fact key; fields that were not heard show "Not said" */
  fieldsByKey?: Record<string, string[]>;
  onPlay?: PlayAnchor;
  status?: ViewStatus;
  title?: string;
  /** Plain-words reason a line needs checking, shown under its heading */
  noteFor?: (fact: VerifiedFact) => string | undefined;
}

/**
 * One line per fact: label, values in large text, the original quote, a stamp and
 * the anchor chips. Lines "print" one by one (the signature motion; none with
 * reduced motion).
 */
export function ReceiptList({
  facts,
  fieldsByKey = {},
  onPlay,
  status = "ready",
  title = ADDED.receiptTitle,
  noteFor,
}: ReceiptListProps): ReactElement {
  const shown = status === "ready" && facts.length === 0 ? "empty" : status;
  return (
    <section className="echo-receipt" aria-label={title}>
      <h2>{title}</h2>
      <h3 className="echo-visually-hidden">{ADDED.stampLegend}</h3>
      <ul className="echo-receipt__legend" aria-label={ADDED.stampLegend}>
        <li>
          <StampBadge stamp="heard_clearly" />
        </li>
        <li>
          <StampBadge stamp="check_this" />
        </li>
        <li>
          <StampBadge stamp="not_said" />
        </li>
      </ul>
      <StatusMessage
        status={shown}
        text={{ loading: ADDED.receiptLoading, empty: ADDED.receiptEmpty }}
      />
      {shown === "ready" && (
        <ol className="echo-receipt__list">
          {facts.map((fact, i) => {
            const fields = fieldsByKey[fact.key] ?? Object.keys(fact.fields);
            const note = noteFor?.(fact);
            return (
              <li
                key={`${fact.key}-${i}`}
                className="echo-card echo-receipt-line"
                style={{ "--line": i } as CSSProperties}
              >
                <div className="echo-receipt__head">
                  <h3 style={{ margin: 0 }}>{factLabel(fact.key)}</h3>
                  <StampBadge stamp={fact.stamp} />
                </div>
                {note !== undefined && <p className="echo-receipt__note">{note}</p>}
                <dl className="echo-receipt__fields">
                  {fields.map((field) => (
                    <div key={field} className="echo-receipt__field">
                      <dt>{fieldLabel(field)}</dt>
                      <dd>{fact.fields[field] ?? <StampBadge stamp="not_said" />}</dd>
                    </div>
                  ))}
                </dl>
                <blockquote className="echo-quote">“{fact.anchor.quote}”</blockquote>
                <AnchorChip anchor={fact.anchor} {...(onPlay ? { onPlay } : {})} />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
