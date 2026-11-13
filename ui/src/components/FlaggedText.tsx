import type { ReactElement } from "react";
import type { FlaggedToken } from "@echo/engine";
import { highlightParts } from "../highlight";
import { ADDED } from "../copy";
import { Icon } from "./common";

const KIND_LABELS: Record<FlaggedToken["kind"], string> = {
  number: "number",
  drug: "medicine name",
  frequency: "how often",
  date: "date",
  money: "money",
  percent: "percentage",
  duration: "time period",
  commission: "commission",
};

/**
 * Caption text with flagged words highlighted (icon + underline + tint, never colour
 * alone). A word that only sounds like a known drug shows "sounds like ...?" and keeps
 * the heard word.
 */
export function FlaggedText({
  text,
  tokens,
}: {
  text: string;
  tokens: FlaggedToken[];
}): ReactElement {
  return (
    <>
      {highlightParts(text, tokens).map((part, i) => {
        if (!part.token) return <span key={i}>{part.text}</span>;
        const t = part.token;
        return (
          <span key={i}>
            <mark className="echo-flag" data-kind={t.kind}>
              <Icon name="flag" />
              {part.text}
              <span className="echo-visually-hidden">
                {` (${ADDED.flagged}: ${KIND_LABELS[t.kind]}${t.lowConfidence ? ", unclear" : ""})`}
              </span>
            </mark>
            {t.suggestion !== undefined && (
              <span className="echo-sounds-like">{` (${ADDED.soundsLike} ${t.suggestion}?)`}</span>
            )}
            {t.suggestion === undefined && t.soundsAlike && t.soundsAlike.length > 0 && (
              <span className="echo-sounds-like">{` (${ADDED.couldAlsoBe} ${t.soundsAlike.slice(0, 2).join(" or ")}?)`}</span>
            )}
          </span>
        );
      })}
    </>
  );
}
