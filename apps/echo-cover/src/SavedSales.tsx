import type { ReactElement } from "react";
import type { Receipt } from "@echo/engine";
import { StatusMessage } from "@echo/ui";
import type { ViewStatus } from "@echo/ui";
import { COVER } from "./copy";

export interface SavedSale {
  seller: string;
  receipt: Receipt;
}

export function SavedSales({
  sales,
  status,
  onOpen,
  onCompare,
}: {
  sales: SavedSale[];
  status: ViewStatus;
  onOpen: (sale: SavedSale) => void;
  onCompare: () => void;
}): ReactElement {
  const shown = status === "ready" && sales.length === 0 ? "empty" : status;
  return (
    <section className="cover-saved" aria-labelledby="cover-saved-title">
      <p className="cover-kicker">{COVER.savedKicker}</p>
      <h1 id="cover-saved-title">{COVER.savedTitle}</h1>
      <p>{COVER.savedIntro}</p>
      <StatusMessage
        status={shown}
        text={{
          loading: COVER.savedLoading,
          empty: COVER.savedEmpty,
          error: COVER.savedError,
        }}
      />
      {shown === "ready" && (
        <>
          <ol className="cover-saved__list">
            {[...sales].reverse().map((sale) => (
              <li key={sale.receipt.conversationId} className="cover-saved__row">
                <div>
                  <h2>{sale.seller}</h2>
                  <p>
                    {new Date(sale.receipt.timestamp).toLocaleString(undefined, {
                      dateStyle: "long",
                      timeStyle: "short",
                    })}
                  </p>
                  <span>{COVER.factCount(sale.receipt.facts.length)}</span>
                </div>
                <button
                  type="button"
                  className="echo-button echo-button--secondary"
                  onClick={() => onOpen(sale)}
                >
                  {COVER.openSellerReceipt}
                </button>
              </li>
            ))}
          </ol>
          <p className="cover-saved__audio">{COVER.savedAudioNote}</p>
        </>
      )}
      <div className="echo-actions">
        {sales.length >= 2 && (
          <button type="button" className="echo-button" onClick={onCompare}>
            {COVER.compareSaved}
          </button>
        )}
        <a className="echo-button echo-button--secondary" href="#/consent">
          {COVER.startNewComparison}
        </a>
      </div>
    </section>
  );
}
