import type { ReactElement } from "react";
import { StatusMessage } from "@echo/ui";
import type { EvalSummary } from "@echo/ui";
import { CV } from "./copy";
import { CoverIcon } from "./icons";
import { Shell } from "./Shell";

const pct = (x: number): string => `${Math.round(x * 100)}%`;

function Bar({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div className="cv-stat cv-stat--bar">
      <div className="cv-stat__barhead">
        <span className="cv-stat__bartitle">{label}</span>
        <span className="cv-stat__barvalue">{pct(value)}</span>
      </div>
      <div className="cv-bar" aria-hidden="true">
        <div className="cv-bar__fill" style={{ width: pct(Math.min(1, Math.max(0, value))) }} />
      </div>
    </div>
  );
}

/** What was measured on the scripted test conversations, and nothing more. */
export function TrustScreen({ summary }: { summary?: EvalSummary }): ReactElement {
  if (!summary) {
    return (
      <Shell active="trust" topBar bottomNav>
        <main className="cv-main cv-main--flow">
          <h1 className="cv-title">{CV.trustTitle}</h1>
          <StatusMessage
            status="empty"
            text={{ empty: "No test results are bundled with this copy of the app." }}
          />
        </main>
      </Shell>
    );
  }
  const t = summary.totals;
  return (
    <Shell active="trust" topBar bottomNav>
      <main className="cv-main cv-main--trust">
        <h1 className="cv-title">{CV.trustTitle}</h1>
        <p className="cv-lead">{CV.trustLead(t.consults)}</p>
        <dl className="cv-stats echo-trust">
          <div className="cv-stat cv-stat--wide">
            <dt>{CV.factsKept}</dt>
            <dd className="cv-stat__big">{`${t.kept} of ${t.plantedFacts}`}</dd>
            <dd className="cv-stat__note">{CV.factsKeptNote}</dd>
          </div>
          <div className="cv-stat">
            <dt>{CV.factsMissed}</dt>
            <dd className="cv-stat__big">{t.dropped}</dd>
          </div>
          <div className="cv-stat">
            <dt>{CV.madeUp}</dt>
            <dd className="cv-stat__big">{t.invented}</dd>
            <dd className="cv-stat__note">{CV.targetZero}</dd>
          </div>
          <div className="cv-stat">
            <dt>{CV.noQuote}</dt>
            <dd className="cv-stat__big">{t.unanchored}</dd>
            <dd className="cv-stat__note">{CV.targetZero}</dd>
          </div>
        </dl>
        <Bar label={CV.flagged} value={t.flaggedTokenRecall} />
        <Bar label={CV.marked} value={t.checklistAccuracy} />
        <section className="cv-card" aria-label={CV.runs}>
          <div className="cv-kv">
            <span>{CV.runs}</span>
            <strong>{summary.runs}</strong>
          </div>
          <div className="cv-kv">
            <span>{CV.lastRun}</span>
            <strong>
              {new Date(summary.date).toLocaleString(undefined, {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </strong>
          </div>
        </section>
        <div className="cv-progress" data-ready="false">
          <span className="cv-progress__icon" aria-hidden="true">
            <CoverIcon name="warningDuotone" size={30} />
          </span>
          <p className="cv-progress__text">{CV.trustLimits}</p>
        </div>
        <p className="cv-note">{CV.disclaimer}</p>
      </main>
    </Shell>
  );
}
