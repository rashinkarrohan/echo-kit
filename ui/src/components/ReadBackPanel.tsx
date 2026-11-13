import type { ReactElement } from "react";
import type { ReadBackItem, ReadBackMark } from "@echo/engine";
import { ADDED, FINAL } from "../copy";
import { StatusMessage } from "./common";
import type { ViewStatus } from "./common";

const MARK_TEXT: Record<ReadBackMark, string> = {
  unmarked: ADDED.readBackUnmarked,
  right: ADDED.readBackMarkedRight,
  not_right: ADDED.readBackMarkedNotRight,
};

/**
 * "I heard: ..." lines with Right / Not right. Items change only when the user taps.
 * "Show the doctor" switches to a large speaker-facing view of the same items and marks.
 */
export function ReadBackPanel({
  items,
  onMark,
  speakerFacing = false,
  onToggleSpeaker,
  status = "ready",
}: {
  items: ReadBackItem[];
  onMark: (factKey: string, mark: ReadBackMark) => void;
  speakerFacing?: boolean;
  onToggleSpeaker?: (next: boolean) => void;
  status?: ViewStatus;
}): ReactElement {
  const shown = status === "ready" && items.length === 0 ? "empty" : status;
  return (
    <section
      className={speakerFacing ? "echo-readback echo-readback--speaker" : "echo-readback"}
      aria-label="Read-back"
    >
      {onToggleSpeaker && (
        <div className="echo-actions" style={{ marginTop: 0, marginBottom: "var(--space-4)" }}>
          <button
            type="button"
            className="echo-button echo-button--secondary"
            aria-pressed={speakerFacing}
            onClick={() => onToggleSpeaker(!speakerFacing)}
          >
            {FINAL.showTheDoctor}
          </button>
        </div>
      )}
      <StatusMessage status={shown} text={{ empty: ADDED.readBackEmpty }} />
      {shown === "ready" && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => (
            <li key={item.factKey} className="echo-card echo-readback__item">
              <p className="echo-readback__heard">
                {FINAL.readBackPrefix}
                {item.heard}.
              </p>
              {speakerFacing ? (
                <p className="echo-readback__mark" style={{ margin: 0 }}>
                  {MARK_TEXT[item.mark]}
                </p>
              ) : (
                <div
                  className="echo-actions"
                  role="group"
                  aria-label={`${FINAL.readBackPrefix}${item.heard}`}
                >
                  <button
                    type="button"
                    className="echo-button echo-button--secondary"
                    aria-pressed={item.mark === "right"}
                    onClick={() => onMark(item.factKey, "right")}
                  >
                    {FINAL.right}
                  </button>
                  <button
                    type="button"
                    className="echo-button echo-button--secondary"
                    aria-pressed={item.mark === "not_right"}
                    onClick={() => onMark(item.factKey, "not_right")}
                  >
                    {FINAL.notRight}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
