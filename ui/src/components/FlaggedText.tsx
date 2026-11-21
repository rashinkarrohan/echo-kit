import type { ReactElement } from "react";
import type { FlaggedToken, MedicineNameNote } from "@echo/engine";
import { highlightParts } from "../highlight";
import { ADDED, medicineHintText } from "../copy";
import { Icon } from "./common";

/** Why a flagged medicine name needs checking, from the detector's token. */
function noteFor(t: FlaggedToken): MedicineNameNote | undefined {
  if (t.kind !== "drug") return undefined;
  if (t.suggestion !== undefined) return { kind: "sounds-like", name: t.suggestion };
  if (t.unknownName === true) return { kind: "unknown" };
  if (t.soundsAlike !== undefined && t.soundsAlike.length > 0)
    return { kind: "could-also-be", names: t.soundsAlike };
  return undefined;
}

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
 * alone). A medicine name that needs checking keeps the heard word and gets a short
 * hint after it: "Sounds like metformin?", "Could also be ...?" or "Not a medicine
 * name Echo knows".
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
        const note = noteFor(t);
        const hint = note
          ? medicineHintText(note)
          : t.kind === "number" && t.suggestion !== undefined
            ? ADDED.hintUnclearDose(t.suggestion)
            : undefined;
        return (
          <span key={i}>
            <mark className="echo-flag" data-kind={t.kind}>
              <Icon name="flag" />
              {part.text}
              <span className="echo-visually-hidden">
                {` (${ADDED.flagged}: ${KIND_LABELS[t.kind]}${t.lowConfidence ? ", unclear" : ""})`}
              </span>
            </mark>
            {hint !== undefined && (
              <>
                {" "}
                <span className="echo-name-hint">{hint}</span>
              </>
            )}
          </span>
        );
      })}
    </>
  );
}
