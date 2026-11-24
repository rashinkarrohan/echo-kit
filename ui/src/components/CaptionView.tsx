import type { ReactElement } from "react";
import type { FlaggedToken, Segment } from "@echo/engine";
import { ADDED, FINAL } from "../copy";
import { StatusMessage } from "./common";
import type { ViewStatus } from "./common";
import { FlaggedText } from "./FlaggedText";

export interface CaptionLine {
  segment: Segment;
  tokens: FlaggedToken[];
  /** The speech engine could not read this part (not the same as silence) */
  failed?: boolean;
}

/**
 * Live captions: large text, newest at the bottom, announced politely to screen
 * readers. Always shows the uncertainty line; captions are never presented as certain.
 */
export function CaptionView({
  lines,
  status = "ready",
  uncertainty = FINAL.captionUncertainty,
}: {
  lines: CaptionLine[];
  status?: ViewStatus;
  /** Product-specific reminder of which caption details need checking */
  uncertainty?: string;
}): ReactElement {
  const shown = status === "ready" && lines.length === 0 ? "empty" : status;
  return (
    <section className="echo-captions" aria-label="Captions">
      <StatusMessage
        status={shown}
        text={{ loading: FINAL.modelLoading, empty: ADDED.captionsEmpty }}
      />
      <div role="log" aria-live="polite" aria-label="Captions so far">
        <ol className="echo-captions__log">
          {lines.map(({ segment, tokens, failed }) => (
            <li
              key={segment.id}
              className={
                segment.text
                  ? "echo-captions__line"
                  : "echo-captions__line echo-captions__line--silent"
              }
            >
              {segment.text ? (
                <FlaggedText text={segment.text} tokens={tokens} />
              ) : failed ? (
                ADDED.unreadSegment
              ) : (
                ADDED.silentSegment
              )}
            </li>
          ))}
        </ol>
      </div>
      <p className="echo-uncertainty">{uncertainty}</p>
    </section>
  );
}
