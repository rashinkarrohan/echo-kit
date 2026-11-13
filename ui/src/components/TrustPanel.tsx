import type { ReactElement } from "react";
import { ADDED } from "../copy";
import { StatusMessage } from "./common";

/** The parts of evals/results.json the trust page shows. */
export interface EvalSummary {
  date: string;
  runs: number;
  passed: boolean;
  totals: {
    consults: number;
    plantedFacts: number;
    kept: number;
    dropped: number;
    invented: number;
    unanchored: number;
    flaggedTokenRecall: number;
    checklistAccuracy: number;
  };
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

/**
 * The latest eval numbers, as measured on scripted test conversations (actors).
 * States what was measured and nothing more: no claims about real-world benefit.
 */
export function TrustPanel({ summary }: { summary?: EvalSummary }): ReactElement {
  if (!summary) return <StatusMessage status="empty" text={{ empty: ADDED.trustMissing }} />;
  const t = summary.totals;
  const rows: Array<[string, string, string?]> = [
    [ADDED.trustKept, `${t.kept} of ${t.plantedFacts}`],
    [ADDED.trustDropped, String(t.dropped)],
    [ADDED.trustInvented, String(t.invented), ADDED.trustTargetZero],
    [ADDED.trustUnanchored, String(t.unanchored), ADDED.trustTargetZero],
    [ADDED.trustRecall, pct(t.flaggedTokenRecall)],
    [ADDED.trustChecklist, pct(t.checklistAccuracy)],
    [ADDED.trustRuns, String(summary.runs)],
    [
      ADDED.trustDate,
      new Date(summary.date).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" }),
    ],
  ];
  return (
    <section className="echo-card" aria-labelledby="echo-trust-title">
      <h1 id="echo-trust-title">{ADDED.trustTitle}</h1>
      <p>{ADDED.trustIntro(t.consults)}</p>
      <dl className="echo-trust">
        {rows.map(([label, value, note]) => (
          <div key={label} className="echo-receipt__field">
            <dt>{label}</dt>
            <dd>
              {value}
              {note && <span className="echo-trust__note"> ({note})</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="echo-disclaimer">{ADDED.trustLimits}</p>
    </section>
  );
}
