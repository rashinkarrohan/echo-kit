import type { ReactElement } from "react";
import type { Receipt } from "@echo/engine";
import { StatusMessage } from "@echo/ui";
import type { ViewStatus } from "@echo/ui";
import { CV } from "./copy";
import { CoverIcon } from "./icons";
import { Shell } from "./Shell";
import { BackLink } from "./parts";

export interface SavedSale {
  seller: string;
  receipt: Receipt;
}

/** Seller conversations saved on this device, newest first. Each opens its receipt. */
export function SavedScreen({
  sales,
  status,
  errorText,
  loadingText,
  onOpen,
}: {
  sales: SavedSale[];
  status: ViewStatus;
  errorText: string;
  loadingText: string;
  onOpen: (sale: SavedSale) => void;
}): ReactElement {
  const shown = status === "ready" && sales.length === 0 ? "empty" : status;
  return (
    <Shell active="home" bottomNav>
      <main className="cv-main cv-main--flow">
        <BackLink href="#/home" />
        <header className="cv-head">
          <h1 className="cv-title">{CV.savedTitle}</h1>
          <p className="cv-lead cv-lead--tight">{CV.savedLead}</p>
        </header>
        <StatusMessage
          status={shown}
          text={{ loading: loadingText, empty: CV.savedEmpty, error: errorText }}
        />
        {shown === "ready" && (
          <ol className="cv-visit-list">
            {[...sales].reverse().map((sale) => (
              <li key={sale.receipt.conversationId} className="cv-card cv-saved">
                <div className="cv-saved__head">
                  <h2 className="cv-card__title">{sale.seller}</h2>
                  <span className="cv-note cv-note--tight">
                    {new Date(sale.receipt.timestamp).toLocaleString(undefined, {
                      dateStyle: "long",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="cv-note cv-note--tight">
                    {CV.facts(sale.receipt.facts.length)}
                  </span>
                </div>
                <button
                  type="button"
                  className="cv-btn cv-btn--outline"
                  aria-label={`${CV.openReceipt}: ${sale.seller}`}
                  onClick={() => onOpen(sale)}
                >
                  <span>{CV.openReceipt}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {sales.length >= 2 && (
          <a className="cv-btn cv-btn--outline" href="#/compare">
            <CoverIcon name="columnsDuotone" size={26} />
            <span>{CV.compareSaved}</span>
          </a>
        )}
        <a className="cv-btn cv-btn--primary" href="#/consent">
          <CoverIcon name="columnsDuotone" size={30} />
          <span>{CV.startNew}</span>
        </a>
      </main>
    </Shell>
  );
}
