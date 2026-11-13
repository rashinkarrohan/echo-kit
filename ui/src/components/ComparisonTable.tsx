import type { ReactElement } from "react";
import type { QuoteComparisonRow } from "@echo/engine";
import { ADDED, FINAL, factLabel } from "../copy";
import { ChecklistStamp, StatusMessage } from "./common";
import type { ViewStatus } from "./common";
import { AnchorChip } from "./AnchorChip";
import type { PlayAnchor } from "./AnchorChip";

/**
 * Ledger of what each seller said. Columns keep the order the user recorded them;
 * no seller is ranked, highlighted or recommended. Missing values show "Not discussed".
 * The table may scroll sideways inside its frame (allowed for data tables); the page does not.
 */
export function ComparisonTable({
  rows,
  onPlay,
  status = "ready",
  title = ADDED.compareTitle,
}: {
  rows: QuoteComparisonRow[];
  onPlay?: PlayAnchor;
  status?: ViewStatus;
  title?: string;
}): ReactElement {
  const sellers = rows[0]?.cells.map((c) => ({ id: c.conversationId, name: c.seller })) ?? [];
  const shown = status === "ready" && sellers.length < 2 ? "empty" : status;
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <StatusMessage status={shown} text={{ empty: ADDED.compareEmpty }} />
      {shown === "ready" && (
        <div
          className="echo-ledger-wrap"
          role="region"
          aria-label={ADDED.compareScrollLabel}
          tabIndex={0}
        >
          <table className="echo-ledger">
            <caption className="echo-visually-hidden">{title}</caption>
            <thead>
              <tr>
                <td />
                {sellers.map((s) => (
                  <th key={s.id} scope="col">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.field}>
                  <th scope="row">
                    {factLabel(row.field)}
                    {row.differs && (
                      <>
                        <br />
                        <span className="echo-differs">{FINAL.differs}</span>
                      </>
                    )}
                  </th>
                  {row.cells.map((cell) => (
                    <td key={cell.conversationId}>
                      {cell.value === null ? (
                        <ChecklistStamp stamp="Not discussed" />
                      ) : (
                        <>
                          <span className="echo-ledger__value">{cell.value}</span>
                          {cell.anchor && (
                            <AnchorChip anchor={cell.anchor} {...(onPlay ? { onPlay } : {})} />
                          )}
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
