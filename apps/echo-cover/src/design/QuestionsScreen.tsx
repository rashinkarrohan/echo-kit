import type { ReactElement } from "react";
import type { ChecklistItem } from "@echo/engine";
import { FINAL } from "@echo/ui";
import { CV } from "./copy";
import { CoverIcon } from "./icons";
import { Shell } from "./Shell";
import { BackLink, StepBar, Switch } from "./parts";

/**
 * Step 2 of 3: the questions to ask before buying, each with its source. The user turns on the
 * ones they plan to ask; the receipt then notes which of them were not discussed.
 */
export function QuestionsScreen({
  items,
  chosen,
  onChange,
  backHref,
  onStart,
}: {
  items: readonly ChecklistItem[];
  chosen: readonly string[];
  onChange: (next: string[]) => void;
  backHref: string;
  onStart: () => void;
}): ReactElement {
  const count = items.filter((i) => chosen.includes(i.id)).length;
  return (
    <Shell>
      <main className="cv-main cv-main--flow">
        <BackLink href={backHref} />
        <StepBar step={2} name={CV.stepPlan} />
        <h1 className="cv-title">{FINAL.questionsBeforeYouBuy}</h1>
        <p className="cv-lead">{CV.questionsLead}</p>
        <p className="cv-count" role="status">
          {CV.chosen(count, items.length)}
        </p>
        <ul className="cv-qlist">
          {items.map((item) => {
            const on = chosen.includes(item.id);
            return (
              <li key={item.id} className="cv-qcard" data-on={on}>
                <span className="cv-qcard__text" id={`cv-q-${item.id}`}>
                  {item.text}
                </span>
                <div className="cv-qcard__row">
                  {item.sourceUrl.startsWith("http") ? (
                    <a
                      className="cv-btn cv-btn--source"
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <CoverIcon name="arrowSquareOutBold" size={20} />
                      <span>{CV.seeSource}</span>
                      <span className="echo-visually-hidden">
                        {" "}
                        for: {item.text} (opens in a new tab)
                      </span>
                    </a>
                  ) : (
                    <span />
                  )}
                  <Switch
                    on={on}
                    labelledBy={`cv-q-${item.id}`}
                    onChange={(next) =>
                      onChange(next ? [...chosen, item.id] : chosen.filter((c) => c !== item.id))
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <button type="button" className="cv-btn cv-btn--primary" onClick={onStart}>
          <CoverIcon name="microphoneDuotone" size={30} />
          <span>{CV.startRecordingSeller}</span>
        </button>
        <p className="cv-note">{CV.disclaimer}</p>
      </main>
    </Shell>
  );
}
