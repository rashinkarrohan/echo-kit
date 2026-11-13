import type { ReactElement } from "react";
import type { ChecklistResult } from "@echo/engine";
import { ADDED, FINAL } from "../copy";
import { ChecklistStamp, StatusMessage } from "./common";
import type { ViewStatus } from "./common";
import { AnchorChip } from "./AnchorChip";
import type { PlayAnchor } from "./AnchorChip";

/**
 * Checklist questions with Answered / Unclear / Not discussed. The result says only
 * whether the topic was heard; it never says anyone avoided a question.
 */
export function ChecklistView({
  results,
  title = FINAL.questionsPlanned,
  onPlay,
  status = "ready",
  showSources = false,
}: {
  results: ChecklistResult[];
  title?: string;
  onPlay?: PlayAnchor;
  status?: ViewStatus;
  showSources?: boolean;
}): ReactElement {
  const shown = status === "ready" && results.length === 0 ? "empty" : status;
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <StatusMessage status={shown} text={{ empty: ADDED.checklistEmpty }} />
      {shown === "ready" && (
        <ul className="echo-checklist">
          {results.map(({ item, stamp, anchor }) => (
            <li key={item.id} className="echo-card echo-checklist__item">
              <span>
                {item.text}
                {showSources && item.sourceUrl.startsWith("http") && (
                  <>
                    {" "}
                    <a
                      className="echo-checklist__source"
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {FINAL.source}
                      <span className="echo-visually-hidden">
                        {" "}
                        for: {item.text} (opens in a new tab)
                      </span>
                    </a>
                  </>
                )}
              </span>
              <span className="echo-chips">
                <ChecklistStamp stamp={stamp} />
                {anchor && stamp !== "Not discussed" && (
                  <AnchorChip anchor={anchor} {...(onPlay ? { onPlay } : {})} />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
