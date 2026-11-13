import type { ReactElement } from "react";
import type { Anchor } from "@echo/engine";
import { ADDED, FINAL, clock } from "../copy";
import { Icon } from "./common";

export const SLOW_RATE = 0.7;

/** The app plays the 5 seconds around the anchor at the given rate. */
export type PlayAnchor = (anchor: Anchor, rate: number) => void;

/**
 * "Hear it" and "Slower" buttons for an anchor. Without a player (audio not kept,
 * or no audio in this mode) it says so instead of showing dead buttons.
 */
export function AnchorChip({
  anchor,
  onPlay,
}: {
  anchor: Anchor;
  onPlay?: PlayAnchor;
}): ReactElement {
  const when = `${clock(anchor.startMs)} to ${clock(anchor.endMs)}`;
  if (!onPlay) {
    return <span className="echo-chip-unavailable">{ADDED.audioNotKept}</span>;
  }
  return (
    <span className="echo-chips">
      <button
        type="button"
        className="echo-button echo-button--secondary echo-button--small"
        aria-label={`${FINAL.hearIt}, ${when}`}
        onClick={() => onPlay(anchor, 1)}
      >
        <Icon name="play" />
        {FINAL.hearIt}
      </button>
      <button
        type="button"
        className="echo-button echo-button--secondary echo-button--small"
        aria-label={`${FINAL.slower}, ${when}`}
        onClick={() => onPlay(anchor, SLOW_RATE)}
      >
        <Icon name="slow" />
        {FINAL.slower}
      </button>
    </span>
  );
}
