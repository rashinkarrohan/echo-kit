import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactElement } from "react";
import { ADDED, FINAL, FlaggedText, StatusMessage, useDesktop, useTextSize } from "@echo/ui";
import type { CaptionLine, RecordingStatus } from "@echo/ui";
import { CV } from "./copy";
import { CoverIcon } from "./icons";
import { Shell } from "./Shell";
import { BackLink, Chip, StepBar } from "./parts";
import { captionLineHeight, captionPx } from "./ledger";

const CAPTURING: readonly RecordingStatus[] = [
  "starting",
  "loading-model",
  "recording",
  "paused",
  "stopping",
];

export interface RecordProps {
  /** Which seller this is, from 1 */
  sellerNumber: number;
  seller: string;
  onSeller: (name: string) => void;
  sellerError: string | undefined;
  onStart: () => void;
  /** A recording exists */
  active: boolean;
  status: RecordingStatus;
  lines: CaptionLine[];
  sample: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDiscard: () => void;
  onRetry: () => void;
}

/** Step 3 of 3: name the seller, then live captions with the words worth checking highlighted. */
export function RecordScreen(props: RecordProps): ReactElement {
  const { seller, status, lines, sample } = props;
  const desktop = useDesktop();
  const [size] = useTextSize();
  const [confirm, setConfirm] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const live = status === "recording" || status === "paused";
  const failed = status === "error" || status === "permission-denied";
  const capturing = props.active && CAPTURING.includes(status);

  // Keep the newest words in view while the conversation goes on.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [lines.length]);

  if (!props.active) {
    const name = seller.trim();
    return (
      <Shell>
        <main className="cv-main cv-main--flow">
          <BackLink href="#/questions" />
          <StepBar step={3} name={CV.stepSeller(props.sellerNumber)} />
          <h1 className="cv-title">{CV.whoTitle}</h1>
          {sample && <Chip tone="sample">{CV.sampleChip}</Chip>}
          <form
            className="cv-form"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              props.onStart();
            }}
            noValidate
          >
            <label className="cv-form__label" htmlFor="cover-seller">
              {CV.sellerLabel}
            </label>
            <input
              id="cover-seller"
              className="cv-input"
              type="text"
              autoComplete="off"
              aria-required="true"
              aria-invalid={props.sellerError !== undefined}
              aria-describedby={props.sellerError ? "cover-seller-error" : "cover-seller-hint"}
              value={seller}
              onChange={(e) => props.onSeller(e.target.value)}
            />
            <p id="cover-seller-hint" className="cv-note">
              {CV.sellerHint}
            </p>
            {props.sellerError && (
              <p id="cover-seller-error" className="cv-error" role="alert">
                {props.sellerError}
              </p>
            )}
            <button type="submit" className="cv-btn cv-btn--primary" data-named={name.length > 0}>
              <CoverIcon name="microphoneDuotone" size={30} />
              <span>{CV.startRecording}</span>
            </button>
          </form>
          <p className="cv-note">{CV.disclaimer}</p>
        </main>
      </Shell>
    );
  }

  const name = seller.trim();
  const pill =
    status === "paused"
      ? CV.pausedStatus(name)
      : status === "recording"
        ? CV.recordingStatus(name)
        : status === "stopping"
          ? CV.stoppingStatus
          : failed
            ? name
            : CV.gettingReady(name);
  const dot = status === "recording" ? "live" : status === "paused" ? "paused" : "idle";
  const vars = {
    "--cap-px": `${captionPx(size, desktop)}px`,
    "--cap-lh": `${captionLineHeight(size, desktop)}px`,
  } as CSSProperties;

  return (
    <Shell locked={capturing}>
      <main className="cv-main cv-main--flow cv-main--live" style={vars}>
        <h1 className="echo-visually-hidden">{CV.startRecording}</h1>
        <div className="cv-livepill" role="status">
          <span className="cv-livepill__dot" data-state={dot} aria-hidden="true" />
          <span>{pill}</span>
        </div>
        {sample && <Chip tone="sample">{CV.sampleChip}</Chip>}
        {(status === "starting" || status === "loading-model") && (
          <StatusMessage status="loading" text={{ loading: FINAL.modelLoading }} />
        )}
        {status === "permission-denied" && (
          <StatusMessage status="permission-denied" text={{ permissionDenied: FINAL.micDenied }} />
        )}
        {status === "error" && (
          <StatusMessage status="error" text={{ error: FINAL.genericError }} />
        )}
        {failed && (
          <button type="button" className="cv-btn cv-btn--primary" onClick={props.onRetry}>
            {CV.tryAgain}
          </button>
        )}
        {lines.length === 0 && live && <p className="cv-note">{CV.waiting}</p>}
        <div role="log" aria-live="polite" aria-label="Captions so far" className="cv-caps">
          {lines.map(({ segment, tokens }) => (
            <article
              key={segment.id}
              className="cv-cap"
              data-silent={segment.text ? undefined : "true"}
            >
              <p>
                {segment.text ? (
                  <FlaggedText text={segment.text} tokens={tokens} />
                ) : (
                  ADDED.silentSegment
                )}
              </p>
            </article>
          ))}
          <div ref={end} />
        </div>
        <p className="cv-flagnote">
          <CoverIcon name="flagDuotone" size={24} />
          <span>{CV.yellowWords}</span>
        </p>
        <button
          type="button"
          className="cv-btn cv-btn--primary"
          disabled={!live}
          onClick={props.onStop}
        >
          <CoverIcon name="stopDuotone" size={28} />
          <span>{CV.stopAndReview}</span>
        </button>
        <button
          type="button"
          className="cv-btn cv-btn--outline cv-btn--tall"
          disabled={!live}
          onClick={status === "paused" ? props.onResume : props.onPause}
        >
          <CoverIcon name="pauseDuotone" size={26} />
          <span>{status === "paused" ? CV.resume : CV.pause}</span>
        </button>
        {confirm ? (
          <div className="cv-confirm" role="alertdialog" aria-label={CV.discardTitle}>
            <p className="cv-confirm__title">{CV.discardTitle}</p>
            <p className="cv-confirm__text">{CV.discardText(name)}</p>
            <button
              type="button"
              className="cv-btn cv-btn--outline"
              onClick={() => setConfirm(false)}
            >
              {CV.keepRecording}
            </button>
            <button
              type="button"
              className="cv-btn cv-btn--danger-fill"
              onClick={() => {
                setConfirm(false);
                props.onDiscard();
              }}
            >
              {CV.discardIt}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="cv-btn cv-btn--danger"
            disabled={status === "stopping"}
            onClick={() => setConfirm(true)}
          >
            <CoverIcon name="trashDuotone" size={24} />
            <span>{CV.discard}</span>
          </button>
        )}
      </main>
    </Shell>
  );
}
