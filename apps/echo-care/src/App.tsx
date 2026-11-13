import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import { CONSENT_WORDING_VERSION, ConsentLedger, MemoryStore, applyMark } from "@echo/engine";
import type { Anchor, EchoStore, ReadBackMark, Receipt } from "@echo/engine";
import {
  CaptionView,
  ChecklistView,
  ConsentSheet,
  FINAL,
  IdbStore,
  ReadBackPanel,
  ReceiptList,
  RecordingController,
  SPEAKER_CARDS,
  Skin,
  SpeakerCard,
  StatusMessage,
  clock,
  createPlayer,
} from "@echo/ui";
import type { ConsentChoices, ViewStatus } from "@echo/ui";
import { CARE } from "./copy";
import { DOCTOR_VISIT, readLaunch } from "./env";
import { go, useRoute } from "./router";

const schema = DOCTOR_VISIT;
const fieldsByKey = Object.fromEntries(schema.facts.map((f) => [f.key, f.fields]));

interface Services {
  store: EchoStore;
  ledger: ConsentLedger;
  persistent: boolean;
}

async function openServices(): Promise<Services> {
  const opened = await IdbStore.open("echo-care");
  const store: EchoStore = opened.ok ? opened.value : new MemoryStore();
  const records = await store.getConsentRecords();
  const ledger = ConsentLedger.fromRecords(records.ok ? records.value : [], { store });
  return { store, ledger, persistent: opened.ok };
}

function useController(controller: RecordingController | undefined) {
  return useSyncExternalStore(
    useCallback((cb: () => void) => controller?.subscribe(cb) ?? (() => {}), [controller]),
    () => controller?.state,
  );
}

export function App(): ReactElement {
  const route = useRoute();
  const launch = useMemo(() => readLaunch(window.location.search), []);
  const [services, setServices] = useState<Services>();
  const [choices, setChoices] = useState<ConsentChoices>({
    record: false,
    transcribe: false,
    share: false,
  });
  const [controller, setController] = useState<RecordingController>();
  const [receipt, setReceipt] = useState<Receipt>();
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [speakerFacing, setSpeakerFacing] = useState(false);
  const [playing, setPlaying] = useState<{ anchor: Anchor; text: string }>();
  const [deleted, setDeleted] = useState(false);
  const player = useRef(createPlayer());
  const rec = useController(controller);

  useEffect(() => {
    void openServices().then(setServices);
  }, []);

  if (!services) {
    return (
      <Skin skin="care" className="care-page">
        <StatusMessage status="loading" text={{ loading: CARE.loadingApp }} />
      </Skin>
    );
  }
  const { store, ledger } = services;

  const agree = (): void => {
    ledger.grant("record", CONSENT_WORDING_VERSION);
    ledger.grant("transcribe", CONSENT_WORDING_VERSION);
    if (choices.share) ledger.grant("share", CONSENT_WORDING_VERSION);
    void ledger.persist();
    go("/doctor-card");
  };

  const startVisit = (): void => {
    const c = new RecordingController();
    setController(c);
    setReceipt(undefined);
    setDeleted(false);
    void c.start({
      sessionId: `visit-${Date.now()}`,
      schema,
      ledger,
      store,
      source: launch.sample
        ? { kind: "scripted", consult: launch.sample, speed: launch.speed }
        : { kind: "live" },
    });
    go("/record");
  };

  const stopAndReview = async (): Promise<void> => {
    if (!controller) return;
    const result = await controller.stop();
    if (result.ok) {
      setReceipt(result.value);
      go("/read-back");
    }
  };

  const mark = (factKey: string, m: ReadBackMark): void => {
    if (!receipt) return;
    const next = { ...receipt, readBack: applyMark(receipt.readBack, factKey, m) };
    setReceipt(next);
    void store.saveReceipt(next);
  };

  const play = (anchor: Anchor, rate: number): void => {
    const chunks = controller?.audioFor(anchor.segmentIds) ?? [];
    const range = `${clock(anchor.startMs)} to ${clock(anchor.endMs)}`;
    setPlaying({ anchor, text: CARE.playing(range) });
    void player.current.play(chunks, 16000, rate).then((r) => {
      if (!r.ok) setPlaying({ anchor, text: CARE.playFailed });
    });
  };

  const deleteVisit = async (): Promise<void> => {
    if (!receipt) return;
    player.current.stop();
    await store.deleteSession(receipt.conversationId);
    setReceipt(undefined);
    setController(undefined);
    setDeleted(true);
  };

  const disclaimer = <p className="echo-disclaimer">{schema.disclaimer}</p>;
  const sampleBadge = launch.sample ? <p className="care-badge">{CARE.sampleBadge}</p> : null;
  const canPlay = controller !== undefined;

  let screen: ReactElement;
  switch (route) {
    case "/consent":
      screen = (
        <ConsentSheet
          choices={choices}
          onChange={setChoices}
          onAgree={agree}
          disclaimer={FINAL.disclaimerCare}
          status={services.persistent ? "ready" : "error"}
        />
      );
      break;

    case "/doctor-card":
      screen = (
        <SpeakerCard
          message={SPEAKER_CARDS.doctor}
          actions={[
            { label: FINAL.doctorCardStart, onClick: startVisit },
            { label: FINAL.skip, onClick: startVisit, primary: false },
          ]}
        />
      );
      break;

    case "/record": {
      const status = rec?.status ?? "idle";
      const viewStatus: ViewStatus =
        status === "starting" || status === "loading-model"
          ? "loading"
          : status === "permission-denied"
            ? "permission-denied"
            : status === "error"
              ? "error"
              : "ready";
      const prompt = rec?.prompts[rec.prompts.length - 1];
      screen = (
        <>
          <h1 className="echo-visually-hidden">{CARE.appName}: recording</h1>
          {sampleBadge}
          <p className="care-recording" role="status">
            {status === "paused"
              ? CARE.paused
              : status === "stopping"
                ? CARE.stopping
                : status === "recording"
                  ? CARE.recording
                  : ""}
          </p>
          {!controller ? (
            <StatusMessage status="empty" text={{ empty: CARE.noReceipt }} />
          ) : (
            <CaptionView lines={rec?.lines ?? []} status={viewStatus} />
          )}
          {prompt && (
            <div className="echo-status care-prompt" role="status">
              <p style={{ margin: 0 }}>
                {prompt.kind === "missing-medicine-name"
                  ? CARE.promptMissingName
                  : CARE.promptUnclearName(prompt.heard ?? "", prompt.suggestion ?? "")}
              </p>
            </div>
          )}
          <div className="care-bar">
            <button type="button" className="echo-button" onClick={() => setRepeatOpen(true)}>
              {FINAL.pleaseRepeat}
            </button>
            <button
              type="button"
              className="echo-button echo-button--secondary"
              disabled={status !== "recording" && status !== "paused"}
              onClick={() => (status === "paused" ? controller?.resume() : controller?.pause())}
            >
              {status === "paused" ? CARE.resume : FINAL.pause}
            </button>
            <button
              type="button"
              className="echo-button echo-button--secondary"
              disabled={status !== "recording" && status !== "paused"}
              onClick={() => void stopAndReview()}
            >
              {FINAL.stopAndReview}
            </button>
          </div>
          {disclaimer}
          {repeatOpen && (
            <SpeakerCard
              message={SPEAKER_CARDS.pleaseRepeat}
              actions={[{ label: FINAL.done, onClick: () => setRepeatOpen(false) }]}
            />
          )}
        </>
      );
      break;
    }

    case "/read-back":
      screen = receipt ? (
        <>
          <h1>{CARE.readBackTitle}</h1>
          <ReadBackPanel
            items={receipt.readBack}
            onMark={mark}
            speakerFacing={speakerFacing}
            onToggleSpeaker={setSpeakerFacing}
          />
          <div className="echo-actions">
            <button type="button" className="echo-button" onClick={() => go("/receipt")}>
              {CARE.toReceipt}
            </button>
          </div>
          {disclaimer}
        </>
      ) : (
        <StatusMessage status="empty" text={{ empty: CARE.noReceipt }} />
      );
      break;

    case "/receipt":
      screen = deleted ? (
        <>
          <StatusMessage status="empty" text={{ empty: CARE.deleted }} />
          <div className="echo-actions">
            <button type="button" className="echo-button" onClick={() => go("/doctor-card")}>
              {CARE.startAgain}
            </button>
          </div>
        </>
      ) : receipt ? (
        <>
          <h1>
            {CARE.receiptHeading(
              new Date(receipt.timestamp).toLocaleDateString(undefined, { dateStyle: "long" }),
            )}
          </h1>
          {sampleBadge}
          <p
            className="care-playing"
            role="status"
            aria-live="polite"
            data-playing={playing?.anchor.segmentIds.join(",") ?? ""}
          >
            {playing?.text ?? ""}
          </p>
          <ReceiptList
            facts={receipt.facts}
            fieldsByKey={fieldsByKey}
            {...(canPlay ? { onPlay: play } : {})}
          />
          <ChecklistView results={receipt.checklist} {...(canPlay ? { onPlay: play } : {})} />
          {receipt.nextSteps.length > 0 && (
            <ul className="care-next">
              {receipt.nextSteps.map((s) => (
                <li key={s.label}>{s.label}</li>
              ))}
            </ul>
          )}
          {disclaimer}
          <div className="echo-actions">
            <button
              type="button"
              className="echo-button echo-button--secondary"
              onClick={() => void deleteVisit()}
            >
              {CARE.deleteVisit}
            </button>
          </div>
        </>
      ) : (
        <StatusMessage status="empty" text={{ empty: CARE.noReceipt }} />
      );
      break;
  }

  return (
    <Skin skin="care" className="care-page">
      <main>{screen}</main>
    </Skin>
  );
}
