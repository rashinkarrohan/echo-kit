import type { ReactElement, ReactNode } from "react";
import type { Anchor } from "@echo/engine";
import { SLOW_RATE, clock } from "@echo/ui";
import type { PlayAnchor } from "@echo/ui";
import { CV } from "./copy";
import { CoverIcon } from "./icons";
import type { IconName } from "./icons";

/** Back pill: caret and the word "Back", 52 px high. */
export function BackLink({
  href,
  ariaLabel = "Back",
}: {
  href: string;
  ariaLabel?: string;
}): ReactElement {
  return (
    <a className="cv-btn cv-btn--back" href={href} aria-label={ariaLabel}>
      <CoverIcon name="caretLeftBold" size={26} />
      <span>{CV.back}</span>
    </a>
  );
}

/** "Step 2 of 3" with the three-segment bar and the step's name. */
export function StepBar({ step, name }: { step: 1 | 2 | 3; name: string }): ReactElement {
  return (
    <div className="cv-stepbar">
      <span>{CV.step(step)}</span>
      <span className="cv-stepbar__segs" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className="cv-stepbar__seg" data-done={n <= step} />
        ))}
      </span>
      <span>{name}</span>
    </div>
  );
}

export type ChipTone = "said" | "check" | "none" | "sample";

const CHIP_ICON: Record<Exclude<ChipTone, "sample">, IconName> = {
  said: "checkBold",
  check: "warningDuotone",
  none: "minusBold",
};

/** Said / Check this / Not said: always an icon and a word, never colour alone. */
export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }): ReactElement {
  return (
    <span className={`cv-chip cv-chip--${tone}`}>
      {tone !== "sample" && <CoverIcon name={CHIP_ICON[tone]} size={20} />}
      <span>{children}</span>
    </span>
  );
}

/** On/Off switch (68 by 40) with its state in words. Used as role="switch". */
export function Switch({
  on,
  onChange,
  label,
  labelledBy,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  labelledBy?: string;
}): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      {...(label !== undefined ? { "aria-label": label } : {})}
      {...(labelledBy !== undefined ? { "aria-labelledby": labelledBy } : {})}
      className="cv-switch"
      onClick={() => onChange(!on)}
    >
      <span className="cv-switch__word">{on ? CV.on : CV.off}</span>
      <span className="cv-switch__track" data-on={on}>
        <span className="cv-switch__knob" />
      </span>
    </button>
  );
}

/**
 * "Hear it" (and optionally "Slower") for one anchor. Without audio (kept in memory only until the
 * page closes) it says so instead of showing a dead button.
 */
export function HearButtons({
  anchor,
  onPlay,
  slower = true,
}: {
  anchor: Anchor;
  onPlay?: PlayAnchor;
  slower?: boolean;
}): ReactElement {
  const when = `${clock(anchor.startMs)} to ${clock(anchor.endMs)}`;
  if (!onPlay) return <span className="cv-nokept">{CV.audioNotKept}</span>;
  return (
    <span className="cv-hear">
      <button
        type="button"
        className="cv-btn cv-btn--hear"
        aria-label={`${CV.hearIt}, ${when}`}
        onClick={() => onPlay(anchor, 1)}
      >
        <CoverIcon name="playDuotone" size={22} />
        <span>{CV.hearIt}</span>
      </button>
      {slower && (
        <button
          type="button"
          className="cv-btn cv-btn--hear"
          aria-label={`${CV.slower}, ${when}`}
          onClick={() => onPlay(anchor, SLOW_RATE)}
        >
          <CoverIcon name="gaugeDuotone" size={22} />
          <span>{CV.slower}</span>
        </button>
      )}
    </span>
  );
}
