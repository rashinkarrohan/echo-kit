import { useId } from "react";
import type { ReactElement } from "react";
import { FINAL } from "../copy";
import { useFocusOnMount } from "./common";

export interface SpeakerAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

/** Ready-made cards from the copy deck. */
export const SPEAKER_CARDS = {
  pleaseRepeat: FINAL.pleaseRepeatCard,
  doctor: FINAL.doctorCard,
  pharmacist: FINAL.pharmacistCard,
} as const;

/**
 * Full-screen, large-text card turned towards the other person (Please repeat,
 * doctor card, pharmacist card). Focus moves to the first action when it opens.
 * `inline` renders it in the page flow (for previews and tests). An optional eyebrow
 * tells the user who to show the full-screen card to.
 */
export function SpeakerCard({
  eyebrow,
  message,
  actions,
  inline = false,
}: {
  /** Short instruction shown above the speaker-facing message */
  eyebrow?: string;
  message: string;
  actions: SpeakerAction[];
  inline?: boolean;
}): ReactElement {
  const id = useId();
  const first = useFocusOnMount<HTMLButtonElement>();
  return (
    <div
      className={inline ? "echo-speaker echo-speaker--inline" : "echo-speaker"}
      role="dialog"
      aria-modal={inline ? undefined : true}
      aria-labelledby={id}
    >
      {eyebrow !== undefined && <p className="echo-speaker__eyebrow">{eyebrow}</p>}
      <p id={id} className="echo-speaker__message">
        {message}
      </p>
      <div className="echo-actions">
        {actions.map((a, i) => (
          <button
            key={a.label}
            ref={i === 0 ? first : undefined}
            type="button"
            className={a.primary === false ? "echo-button echo-button--secondary" : "echo-button"}
            onClick={a.onClick}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
