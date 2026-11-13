import { useEffect, useId, useState } from "react";
import type { ReactElement } from "react";
import type { LabelFields, LabelFlag } from "@echo/engine";
import { ADDED, FINAL } from "../copy";
import { Icon, StatusMessage } from "./common";
import type { ViewStatus } from "./common";
import { AnchorChip } from "./AnchorChip";
import type { PlayAnchor } from "./AnchorChip";

const FIELD_NAMES: Record<keyof LabelFields, string> = {
  medicine: FINAL.labelMedicine,
  dose: FINAL.labelDose,
  frequency: FINAL.labelHowOften,
};

/**
 * The three label fields the user types (or copies from their photo) and confirms.
 * The photo is shown only on this screen, from memory, and is never stored.
 */
export function LabelForm({
  onConfirm,
  initial = { medicine: "", dose: "", frequency: "" },
}: {
  onConfirm: (fields: LabelFields) => void;
  initial?: LabelFields;
}): ReactElement {
  const [fields, setFields] = useState<LabelFields>(initial);
  const [photo, setPhoto] = useState<string>();
  const id = useId();

  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo);
    },
    [photo],
  );

  const ready = Object.values(fields).every((v) => v.trim().length > 0);
  return (
    <form
      className="echo-card echo-label-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onConfirm(fields);
      }}
    >
      <label className="echo-button echo-button--secondary echo-file">
        <Icon name="camera" />
        {FINAL.labelTakePhoto}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="echo-visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setPhoto(file ? URL.createObjectURL(file) : undefined);
          }}
        />
      </label>
      <p className="echo-disclaimer">{ADDED.photoNotKept}</p>
      {photo && <img className="echo-label-photo" src={photo} alt={ADDED.photoAlt} />}
      <h2 className="echo-label-form__title">{FINAL.labelTypeIt}</h2>
      {(Object.keys(FIELD_NAMES) as Array<keyof LabelFields>).map((key) => (
        <div key={key} className="echo-field">
          <label htmlFor={`${id}-${key}`}>{FIELD_NAMES[key]}</label>
          <input
            id={`${id}-${key}`}
            type="text"
            autoComplete="off"
            value={fields[key]}
            onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
          />
        </div>
      ))}
      <div className="echo-actions">
        <button type="submit" className="echo-button" disabled={!ready}>
          {ADDED.labelCompare}
        </button>
      </div>
    </form>
  );
}

/**
 * Label check result: either "Matches what was said", or one card per difference with
 * what was said, what is printed and the audio anchors. Never says which one is right.
 */
export function LabelFlagList({
  flags,
  onPlay,
  status = "ready",
}: {
  flags: LabelFlag[];
  onPlay?: PlayAnchor;
  status?: ViewStatus;
}): ReactElement {
  if (status !== "ready") return <StatusMessage status={status} />;
  if (flags.length === 0) {
    return (
      <div className="echo-status echo-label-match" role="status">
        <Icon name="check" />
        <p style={{ margin: 0 }}>{FINAL.labelMatches}</p>
      </div>
    );
  }
  return (
    <ul className="echo-label-flags" aria-label={ADDED.labelDifferences}>
      {flags.map((flag) => (
        <li key={flag.field} className="echo-card echo-label-flag">
          <h3>
            <Icon name="alert" />
            {FIELD_NAMES[flag.field]}
          </h3>
          <p>{FINAL.labelFlag(flag.said, flag.printed)}</p>
          <ul className="echo-label-flag__anchors" aria-label={ADDED.labelWhereSaid}>
            {flag.anchors.map((anchor, i) => (
              <li key={`${anchor.segmentIds.join(",")}-${i}`}>
                <span className="echo-label-flag__quote">“{anchor.quote}”</span>
                <AnchorChip anchor={anchor} {...(onPlay ? { onPlay } : {})} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
