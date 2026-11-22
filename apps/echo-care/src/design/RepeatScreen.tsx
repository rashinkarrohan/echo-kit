import { useState } from "react";
import type { Stage } from "../env";
import type { ReactElement } from "react";
import { CD } from "./copy";
import { CareIcon } from "./icons";
import type { IconName } from "./icons";
import { Shell } from "./Shell";
import { useDesktop } from "./hooks";
import { REPEAT_PHRASES, REPEAT_TILES } from "./repeat";
import type { RepeatTile } from "./repeat";

const TILES: Record<RepeatTile, { label: string; icon: IconName }> = {
  name: { label: CD.repeatMedicine, icon: "pill" },
  amount: { label: CD.repeatAmount, icon: "hash" },
  often: { label: CD.repeatOften, icon: "clock" },
  all: { label: CD.repeatAll, icon: "rotateCcw" },
};

/**
 * Please repeat: a big yellow card for the speaker to read, on a dark screen. The user picks what
 * they missed; the card changes. Nothing is recorded or changed by this screen.
 */
export function RepeatScreen({
  initial,
  stage,
}: {
  initial: RepeatTile;
  stage: Stage;
}): ReactElement {
  const desktop = useDesktop();
  const [pick, setPick] = useState<RepeatTile>(initial);
  const iconSize = desktop ? 40 : 30;
  const who = stage === "doctor" ? CD.messageFor : CD.messageForPharmacist;
  return (
    <Shell bottomNav={false} locked className="cd-dark">
      <main className="cd-repeat-screen">
        <section className="cd-repeat-screen__choose">
          <a
            className="cd-btn cd-btn--back cd-back cd-back--dark"
            href="#/record"
            aria-label="Back to captions"
          >
            <CareIcon name="chevronLeft" strokeWidth={2.5} />
            <span>{desktop ? "Back to captions" : "Back"}</span>
          </a>
          <h1 className="cd-repeat-screen__title">{CD.repeatTitle}</h1>
          <div className="cd-tiles" role="group" aria-label={CD.repeatTitle}>
            {REPEAT_TILES.map((t) => (
              <button
                key={t}
                type="button"
                className="cd-tile-btn"
                aria-pressed={pick === t}
                onClick={() => setPick(t)}
              >
                <CareIcon name={TILES[t].icon} size={iconSize} />
                <span>{TILES[t].label}</span>
              </button>
            ))}
          </div>
          <p className="cd-repeat-screen__hint">
            {desktop ? CD.repeatTapOne : stage === "doctor" ? CD.repeatHold : CD.repeatHoldPharmacy}
          </p>
          <a className="cd-btn cd-btn--back-big" href="#/record">
            <CareIcon name="check" size={desktop ? 30 : 26} strokeWidth={2.5} />
            <span>{CD.repeatBack}</span>
          </a>
        </section>
        <section className="cd-yellow" aria-label={who} aria-live="polite">
          <span className="cd-yellow__tag">{who}</span>
          <p className="cd-yellow__big">{REPEAT_PHRASES[pick]}</p>
          <p className="cd-yellow__small">{CD.repeatSlowly}</p>
        </section>
      </main>
    </Shell>
  );
}
