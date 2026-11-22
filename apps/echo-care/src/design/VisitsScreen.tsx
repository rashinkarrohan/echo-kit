import type { ReactElement } from "react";
import { StatusMessage } from "@echo/ui";
import type { ViewStatus } from "@echo/ui";
import { CARE } from "../copy";
import { CD } from "./copy";
import { CareIcon } from "./icons";
import { Shell } from "./Shell";
import { Chip, Tile } from "./parts";
import type { LastVisit } from "./HomeScreen";
import { lastVisitTitle } from "./visitView";

/** Saved visits on this device, newest first. Each opens its summary. */
export function VisitsScreen({
  visits,
  status,
  onOpen,
}: {
  visits: LastVisit[];
  status: ViewStatus;
  onOpen: (visit: LastVisit) => void;
}): ReactElement {
  const shown = status === "ready" && visits.length === 0 ? "empty" : status;
  return (
    <Shell active="visits">
      <main className="cd-main cd-main--visits">
        <header className="cd-head">
          <h1 className="cd-title">{CD.visitsTitle}</h1>
          <p className="cd-lead cd-lead--soft">{CD.visitsLead}</p>
        </header>
        <StatusMessage
          status={shown}
          text={{
            loading: CARE.savedVisitsLoading,
            empty: CD.visitsEmpty,
            error: CARE.savedVisitsError,
          }}
        />
        {shown === "ready" && (
          <ol className="cd-visit-list">
            {[...visits].reverse().map((visit) => {
              const checks =
                visit.receipt.facts.filter((f) => f.stamp === "check_this").length +
                visit.receipt.checklist.filter((c) => c.stamp === "Unclear").length;
              const when = new Date(visit.receipt.timestamp).toLocaleString(undefined, {
                dateStyle: "long",
                timeStyle: "short",
              });
              return (
                <li key={visit.receipt.conversationId} className="cd-card cd-visit">
                  <div className="cd-med__head">
                    <Tile icon={visit.stage === "doctor" ? "ear" : "pill"} size={30} />
                    <div className="cd-med__title">
                      <span className="cd-med__kicker">{when}</span>
                      <h2 className="cd-visit__title">
                        {lastVisitTitle(visit.receipt, visit.stage)}
                      </h2>
                    </div>
                  </div>
                  <div className="cd-chips">
                    <Chip>{CD.factCount(visit.receipt.facts.length)}</Chip>
                    {checks > 0 && (
                      <Chip tone="check" icon="exclamationMark">
                        {CD.checkCount(checks)}
                      </Chip>
                    )}
                  </div>
                  <button
                    type="button"
                    className="cd-btn cd-btn--outline"
                    aria-label={`${CD.open}: ${lastVisitTitle(visit.receipt, visit.stage)}, ${when}`}
                    onClick={() => onOpen(visit)}
                  >
                    <span>{CD.open}</span>
                    <CareIcon name="chevronRight" size={24} strokeWidth={2.5} />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <a className="cd-btn cd-btn--primary" href="#/doctor-card">
          <CareIcon name="captions2" size={28} strokeWidth={2.25} />
          <span>{CD.startVisit}</span>
        </a>
      </main>
    </Shell>
  );
}
