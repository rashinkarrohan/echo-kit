import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { ADDED, FINAL, FlaggedText, StatusMessage, clock } from "@echo/ui";
import type { CaptionLine, RecordingStatus } from "@echo/ui";
import { CD } from "./copy";
import { CareIcon } from "./icons";
import { Shell } from "./Shell";
import { Chip } from "./parts";
import { SizeSegments, useDesktop, useTextSize } from "@echo/ui";
import { captionPx, earlierLinePx, lineHeightPx } from "./captionSize";

export interface CaptionsProps {
  status: RecordingStatus;
  lines: CaptionLine[];
  /** Bytes of the speech model fetched so far (first run only) */
  progress?: { loaded: number; total: number };
  /** Why recording stopped, in words (speech engine failed) */
  error?: string;
  /** Plain-words reason the newest medicine name or dose needs checking, if any */
  promptText?: string;
  promptAsk: string;
  /** No recording exists (the page was opened directly) */
  missing: boolean;
  /** The consent gate refused to start */
  consentMissing: boolean;
  /** Sample consult: actors, no microphone */
  sample: boolean;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onDiscard: () => void;
  onRetry: () => void;
}

const CAPTURING: readonly RecordingStatus[] = [
  "starting",
  "loading-model",
  "recording",
  "paused",
  "stopping",
];

const stateOf = (status: RecordingStatus): "listening" | "paused" | "busy" | "off" =>
  status === "recording"
    ? "listening"
    : status === "paused"
      ? "paused"
      : status === "starting" || status === "loading-model" || status === "stopping"
        ? "busy"
        : "off";

function statusWord(status: RecordingStatus): string {
  switch (status) {
    case "recording":
      return CD.listening;
    case "paused":
      return CD.paused;
    case "starting":
    case "loading-model":
      return CD.gettingReady;
    case "stopping":
      return CD.building;
    default:
      return CD.notListening;
  }
}

/** Live captions: the newest line large, earlier lines smaller above it, controls below or beside. */
export function CaptionsScreen(props: CaptionsProps): ReactElement {
  const { status, lines, promptText, promptAsk, missing, consentMissing, sample } = props;
  const desktop = useDesktop();
  const [size, setSize] = useTextSize();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const log = useRef<HTMLDivElement>(null);

  const live = status === "recording" || status === "paused";
  const failed = status === "error" || status === "permission-denied";
  const state = stateOf(status);
  const hasController = !missing && !consentMissing;
  const capturing = hasController && CAPTURING.includes(status);

  // Keep the newest line in view.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, size, desktop]);

  const vars = {
    "--cap-px": `${captionPx(size, desktop)}px`,
    "--cap-lh": `${lineHeightPx(size, desktop)}px`,
    "--old-px": `${earlierLinePx(size, desktop)}px`,
    "--old-lh": `${Math.round(earlierLinePx(size, desktop) * 1.4)}px`,
  } as CSSProperties;

  const statusPill = (
    <div className="cd-pill" role="status">
      <span className="cd-dot" data-state={state} aria-hidden="true" />
      <span>{statusWord(status)}</span>
    </div>
  );

  const repeatLink = (
    <a className="cd-btn cd-btn--primary cd-repeat" href="#/repeat">
      <CareIcon name="rotateCcw" size={desktop ? 36 : 32} strokeWidth={2.25} />
      <span className="cd-repeat__text">
        <span className="cd-repeat__main">{CD.pleaseRepeat}</span>
        <span className="cd-repeat__sub">{CD.pleaseRepeatSub}</span>
      </span>
    </a>
  );

  const pauseButton = (
    <button
      type="button"
      className="cd-btn cd-btn--outline"
      disabled={!live}
      onClick={status === "paused" ? props.onResume : props.onPause}
    >
      <CareIcon name="pause" size={desktop ? 28 : 24} />
      <span>{status === "paused" ? CD.resume : CD.pause}</span>
    </button>
  );
  const finishButton = (
    <button
      type="button"
      className="cd-btn cd-btn--outline"
      disabled={!live}
      onClick={props.onFinish}
    >
      <CareIcon name="check" size={desktop ? 26 : 24} strokeWidth={2.5} />
      <span>{CD.finishVisit}</span>
    </button>
  );

  const discard = confirmDiscard ? (
    <div className="cd-confirm" role="alertdialog" aria-label={CD.discardTitle}>
      <p className="cd-confirm__title">{CD.discardTitle}</p>
      <p className="cd-confirm__text">{CD.discardText}</p>
      <button
        type="button"
        className="cd-btn cd-btn--outline"
        onClick={() => setConfirmDiscard(false)}
      >
        {CD.keepRecording}
      </button>
      <button type="button" className="cd-btn cd-btn--danger-fill" onClick={props.onDiscard}>
        {CD.discardIt}
      </button>
    </div>
  ) : (
    <button
      type="button"
      className="cd-btn cd-btn--danger"
      disabled={status === "stopping"}
      onClick={() => setConfirmDiscard(true)}
    >
      <CareIcon name="trash2" size={24} />
      <span>{CD.discardRecording}</span>
    </button>
  );

  const controls = hasController && !failed && (
    <>
      {repeatLink}
      {desktop ? (
        <>
          {pauseButton}
          {finishButton}
        </>
      ) : (
        <div className="cd-grid2">
          {pauseButton}
          {finishButton}
        </div>
      )}
      {discard}
    </>
  );

  const body = (
    <section className="cd-cap__log" aria-label="Captions" ref={log} tabIndex={0}>
      <h1 className="echo-visually-hidden">{CD.appName}: live captions</h1>
      {sample && <Chip tone="plain">{CD.practiceBadge}</Chip>}
      {consentMissing ? (
        <div className="cd-recover">
          <StatusMessage status="error" text={{ error: CD.consentNeeded }} />
          <a className="cd-btn cd-btn--primary" href="#/consent">
            {CD.goToMic}
          </a>
        </div>
      ) : missing ? (
        <div className="cd-recover">
          <StatusMessage status="empty" text={{ empty: CD.noRecording }} />
          <a className="cd-btn cd-btn--primary" href="#/home">
            {CD.backHome}
          </a>
        </div>
      ) : (
        <>
          {(status === "starting" || status === "loading-model") && (
            <StatusMessage
              status="loading"
              text={{
                loading: props.progress
                  ? ADDED.downloadingModel(props.progress.loaded, props.progress.total)
                  : FINAL.modelLoading,
              }}
            />
          )}
          {status === "permission-denied" && (
            <StatusMessage
              status="permission-denied"
              text={{ permissionDenied: FINAL.micDenied }}
            />
          )}
          {status === "error" && (
            <StatusMessage
              status="error"
              text={{
                error: props.error ? `${FINAL.genericError} ${props.error}` : FINAL.genericError,
              }}
            />
          )}
          {failed && (
            <div className="cd-recover">
              <button type="button" className="cd-btn cd-btn--primary" onClick={props.onRetry}>
                {CD.tryAgain}
              </button>
              <a className="cd-btn cd-btn--outline" href="#/home" onClick={props.onDiscard}>
                {CD.backHome}
              </a>
            </div>
          )}
          {lines.length === 0 && live && <p className="cd-note">{CD.captionsWaiting}</p>}
          <div role="log" aria-live="polite" aria-label="Captions so far" className="cd-lines">
            {lines.map(({ segment, tokens, failed: unread }, i) => {
              const newest = i === lines.length - 1;
              return (
                <article
                  key={segment.id}
                  className={newest ? "cd-line cd-line--now" : "cd-line"}
                  data-silent={segment.text ? undefined : "true"}
                >
                  {newest ? (
                    <span className="cd-line__badge">{`${CD.heardLabel} · ${CD.now}`}</span>
                  ) : (
                    <span className="cd-line__who">{`${CD.heardLabel} · ${clock(segment.startMs)}`}</span>
                  )}
                  <p className="cd-line__text">
                    {segment.text ? (
                      <FlaggedText text={segment.text} tokens={tokens} />
                    ) : unread ? (
                      ADDED.unreadSegment
                    ) : (
                      ADDED.silentSegment
                    )}
                  </p>
                  {newest && status === "recording" && (
                    <div className="cd-line__live">
                      <span className="cd-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span>{CD.stillListening}</span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {promptText && (
            <div className="cd-prompt" role="status">
              <Chip tone="check" icon="exclamationMark">
                {FINAL.checkThis}
              </Chip>
              <p className="cd-prompt__text">{promptText}</p>
              <p className="cd-prompt__ask">{promptAsk}</p>
            </div>
          )}
          <p className="cd-note">
            <CareIcon name="flag" size={22} />
            <span>{CD.yellowWords}</span>
          </p>
        </>
      )}
    </section>
  );

  return (
    <Shell bottomNav={false} locked={capturing} className="cd-fit">
      <main className="cd-cap" style={vars}>
        {!desktop && (
          <div className="cd-cap__top">
            {statusPill}
            <SizeSegments size={size} onChange={setSize} />
          </div>
        )}
        {body}
        {desktop ? (
          <aside className="cd-cap__side" aria-label="Controls">
            {statusPill}
            <div className="cd-stack" style={{ gap: 10 }}>
              <span className="cd-note" style={{ fontWeight: 600, fontSize: 20 }}>
                {CD.textSize}
              </span>
              <SizeSegments size={size} onChange={setSize} wide />
            </div>
            {controls}
          </aside>
        ) : (
          <section className="cd-cap__sheet" aria-label="Controls">
            {controls}
          </section>
        )}
      </main>
    </Shell>
  );
}
