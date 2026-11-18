import type { ReactElement } from "react";
import type { Receipt } from "@echo/engine";
import { StatusMessage } from "@echo/ui";
import type { ViewStatus } from "@echo/ui";
import { CARE } from "./copy";
import type { Stage } from "./env";

export interface SavedVisit {
  stage: Stage;
  receipt: Receipt;
}

export function SavedVisits({
  visits,
  status,
  onOpen,
}: {
  visits: SavedVisit[];
  status: ViewStatus;
  onOpen: (visit: SavedVisit) => void;
}): ReactElement {
  const shown = status === "ready" && visits.length === 0 ? "empty" : status;
  return (
    <section className="care-visits" aria-labelledby="care-visits-title">
      <p className="care-startup__step">{CARE.savedOnPhone}</p>
      <h1 id="care-visits-title">{CARE.savedVisitsTitle}</h1>
      <p>{CARE.savedVisitsIntro}</p>
      <StatusMessage
        status={shown}
        text={{
          loading: CARE.savedVisitsLoading,
          empty: CARE.savedVisitsEmpty,
          error: CARE.savedVisitsError,
        }}
      />
      {shown === "ready" && (
        <ol className="care-visits__list">
          {[...visits].reverse().map((visit) => {
            const facts = visit.receipt.facts.length;
            const checks = visit.receipt.facts.filter((f) => f.stamp === "check_this").length;
            return (
              <li key={visit.receipt.conversationId} className="echo-card care-visit">
                <div className="care-visit__head">
                  <div>
                    <h2>{visit.stage === "doctor" ? CARE.doctorTitle : CARE.pharmacyTitle}</h2>
                    <p className="care-visit__date">
                      {new Date(visit.receipt.timestamp).toLocaleString(undefined, {
                        dateStyle: "long",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <span className="care-visit__count">
                    {CARE.factCount(facts)}
                    {checks > 0 ? ` · ${CARE.checkCount(checks)}` : ""}
                  </span>
                </div>
                <p className="care-visit__audio">{CARE.savedAudioNote}</p>
                <button type="button" className="echo-button" onClick={() => onOpen(visit)}>
                  {CARE.openReceipt}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="echo-actions">
        <a className="echo-button echo-button--secondary" href="#/consent">
          {CARE.startAnotherVisit}
        </a>
      </div>
    </section>
  );
}
