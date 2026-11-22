import type { ReactElement } from "react";
import { CD } from "./copy";
import { CareIcon } from "./icons";
import { Shell } from "./Shell";

/**
 * A card to hold up to the person at the desk, in the same style as Please repeat: the user's own
 * planned question (or the request for a date) in large text. Nothing is recorded.
 */
export function AskScreen({
  message,
  interpreter,
  backHref,
}: {
  message: string;
  interpreter: boolean;
  backHref: string;
}): ReactElement {
  return (
    <Shell bottomNav={false} className="cd-dark">
      <main className="cd-repeat-screen cd-ask">
        <section className="cd-repeat-screen__choose">
          <a className="cd-btn cd-btn--back cd-back cd-back--dark" href={backHref}>
            <CareIcon name="chevronLeft" strokeWidth={2.5} />
            <span>Back</span>
          </a>
          <h1 className="cd-repeat-screen__title">{CD.askTitle}</h1>
          <p className="cd-repeat-screen__hint">{CD.askHold}</p>
          <a className="cd-btn cd-btn--back-big" href={backHref}>
            <CareIcon name="check" size={26} strokeWidth={2.5} />
            <span>{CD.askBack}</span>
          </a>
        </section>
        <section className="cd-yellow" aria-label={CD.askTitle}>
          <span className="cd-yellow__tag">{CD.deafLine}</span>
          <p className="cd-yellow__big cd-yellow__big--ask">{message}</p>
          {interpreter && <p className="cd-yellow__small">{CD.askInterpreter}</p>}
          <p className="cd-yellow__small">{CD.repeatSlowly}</p>
        </section>
      </main>
    </Shell>
  );
}
