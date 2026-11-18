import { useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { CONSENT_WORDING_VERSION, applyMark, compareLabel, medicineNameNote } from "@echo/engine";
import type {
  Anchor,
  LabelFields,
  LabelFlag,
  ReadBackMark,
  Receipt,
  VerifiedFact,
} from "@echo/engine";
import {
  CaptionView,
  ChecklistView,
  ConsentSheet,
  FINAL,
  LabelFlagList,
  LabelForm,
  ReadBackPanel,
  ReceiptList,
  RecordingController,
  SPEAKER_CARDS,
  Skin,
  ADDED,
  SpeakerCard,
  StampBadge,
  StatusMessage,
  TrustPanel,
  clock,
  medicineNoteText,
  createPlayer,
  useDeviceServices,
  useRecording,
} from "@echo/ui";
import type { ConsentChoices, ViewStatus } from "@echo/ui";
import { CARE } from "./copy";
import { EVAL_SUMMARY, SCHEMAS, readLaunch } from "./env";
import type { Stage } from "./env";
import { go, useRoute } from "./router";
import { SharePanel } from "./SharePanel";
import { HomePage } from "./HomePage";

/** One finished recording (doctor or pharmacy), with its in-memory audio. */
interface Visit {
  stage: Stage;
  receipt: Receipt;
  controller: RecordingController;
}

const fieldsFor = (stage: Stage) =>
  Object.fromEntries(SCHEMAS[stage].facts.map((f) => [f.key, f.fields]));

/** Why a medicine line needs checking, in plain words; nothing for other lines. */
function medicineNote(fact: VerifiedFact): string | undefined {
  const name = fact.fields["name"];
  if (fact.key !== "medicine" || fact.stamp !== "check_this" || name === undefined)
    return undefined;
  const note = medicineNameNote(name);
  return note ? medicineNoteText(name, note) : undefined;
}

export function App(): ReactElement {
  const route = useRoute();
  const launch = useMemo(() => readLaunch(window.location.search), []);
  const services = useDeviceServices("echo-care", launch.demo);
  const [choices, setChoices] = useState<ConsentChoices>({
    record: false,
    transcribe: false,
    share: false,
  });
  const [stage, setStage] = useState<Stage>("doctor");
  const [controller, setController] = useState<RecordingController>();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [speakerFacing, setSpeakerFacing] = useState(false);
  const [playing, setPlaying] = useState<{ anchor: Anchor; text: string }>();
  const [deleted, setDeleted] = useState(false);
  const [labelFlags, setLabelFlags] = useState<LabelFlag[]>();
  const player = useRef(createPlayer());
  const rec = useRecording(controller);

  // The product home needs no permission and can render while on-device storage opens.
  if (route === "/home") {
    return (
      <Skin skin="care" className="care-page">
        <HomePage />
      </Skin>
    );
  }

  if (!services) {
    return (
      <Skin skin="care" className="care-page">
        <StatusMessage status="loading" text={{ loading: CARE.loadingApp }} />
      </Skin>
    );
  }
  const { store, ledger } = services;
  const current = visits[visits.length - 1];
  const receipt = current?.receipt;

  const agree = (): void => {
    ledger.grant("record", CONSENT_WORDING_VERSION);
    ledger.grant("transcribe", CONSENT_WORDING_VERSION);
    if (choices.share) ledger.grant("share", CONSENT_WORDING_VERSION);
    void ledger.persist();
    go("/doctor-card");
  };

  const startRecording = (next: Stage): void => {
    const c = new RecordingController();
    setStage(next);
    setController(c);
    setDeleted(false);
    setLabelFlags(undefined);
    const sample = launch.sample?.[next];
    void c.start({
      sessionId: `${next}-${Date.now()}`,
      schema: SCHEMAS[next],
      ledger,
      store,
      source: sample
        ? { kind: "scripted", consult: sample, speed: launch.speed }
        : { kind: "live" },
    });
    go("/record");
  };

  const stopAndReview = async (): Promise<void> => {
    if (!controller) return;
    const result = await controller.stop();
    if (result.ok) {
      setVisits((v) => [...v, { stage, receipt: result.value, controller }]);
      go(result.value.readBack.length > 0 ? "/read-back" : "/receipt");
    }
  };

  const updateCurrent = (next: Receipt): void => {
    setVisits((v) =>
      v.map((visit, i) => (i === v.length - 1 ? { ...visit, receipt: next } : visit)),
    );
    void store.saveReceipt(next);
  };

  const mark = (factKey: string, m: ReadBackMark): void => {
    if (receipt) updateCurrent({ ...receipt, readBack: applyMark(receipt.readBack, factKey, m) });
  };

  /** Anchors from different recordings share segment ids, so find the recording by the anchor itself. */
  const visitOf = (anchor: Anchor): Visit | undefined =>
    visits.find(
      (v) =>
        v.receipt.facts.some((f) => f.anchor === anchor) ||
        v.receipt.checklist.some((c) => c.anchor === anchor),
    ) ?? current;

  const play = (anchor: Anchor, rate: number): void => {
    const chunks = visitOf(anchor)?.controller.audioFor(anchor.segmentIds) ?? [];
    setPlaying({
      anchor,
      text: CARE.playing(`${clock(anchor.startMs)} to ${clock(anchor.endMs)}`),
    });
    void player.current.play(chunks, 16000, rate).then((r) => {
      if (!r.ok) setPlaying({ anchor, text: CARE.playFailed });
    });
  };

  const checkLabel = (fields: LabelFields): void => {
    const flags = compareLabel(
      visits.flatMap((v) => v.receipt.facts),
      fields,
    );
    setLabelFlags(flags);
    if (receipt) updateCurrent({ ...receipt, labelFlags: flags });
  };

  const deleteVisit = async (): Promise<void> => {
    if (!receipt) return;
    player.current.stop();
    await store.deleteSession(receipt.conversationId);
    setVisits((v) => v.slice(0, -1));
    setController(undefined);
    setDeleted(true);
  };

  const disclaimer = <p className="echo-disclaimer">{SCHEMAS[stage].disclaimer}</p>;
  const sampleBadge = launch.sample ? <p className="care-badge">{CARE.sampleBadge}</p> : null;
  const playingLine = (
    <p
      className="care-playing"
      role="status"
      aria-live="polite"
      data-playing={playing?.anchor.segmentIds.join(",") ?? ""}
    >
      {playing?.text ?? ""}
    </p>
  );
  const canShare = ledger.has("share");
  const hasMedicine = visits.some((v) => v.receipt.facts.some((f) => f.key === "medicine"));

  let screen: ReactElement;
  switch (route) {
    case "/consent":
      screen = launch.demo ? (
        <section className="echo-card">
          <h1>{CARE.appName}</h1>
          <p>{CARE.sampleIntro}</p>
          <div className="echo-actions">
            <button type="button" className="echo-button" onClick={() => go("/doctor-card")}>
              {FINAL.playSampleConsult}
            </button>
          </div>
          <p className="echo-disclaimer">{FINAL.disclaimerCare}</p>
        </section>
      ) : (
        <div className="care-startup">
          <a className="care-back" href="#/home">
            <span aria-hidden="true">←</span> {CARE.startupBack}
          </a>
          <p className="care-startup__step">{CARE.startupStepConsent}</p>
          <ConsentSheet
            choices={choices}
            onChange={setChoices}
            onAgree={agree}
            disclaimer={FINAL.disclaimerCare}
            status={services.persistent ? "ready" : "error"}
          />
          <section className="echo-card care-sample">
            <h2>{CARE.sampleTitle}</h2>
            <p>{CARE.sampleIntro}</p>
            <a
              className="echo-button echo-button--secondary"
              href="?sample=care-01&demo=1#/doctor-card"
            >
              {FINAL.playSampleConsult}
            </a>
          </section>
        </div>
      );
      break;

    case "/doctor-card":
    case "/pharmacy": {
      const next: Stage = route === "/doctor-card" ? "doctor" : "pharmacy";
      screen = (
        <SpeakerCard
          eyebrow={next === "doctor" ? CARE.doctorCardStep : CARE.pharmacistCardStep}
          message={next === "doctor" ? SPEAKER_CARDS.doctor : SPEAKER_CARDS.pharmacist}
          actions={[
            { label: FINAL.doctorCardStart, onClick: () => startRecording(next) },
            { label: FINAL.skip, onClick: () => startRecording(next), primary: false },
          ]}
        />
      );
      break;
    }

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
      const live = status === "recording" || status === "paused";
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
            <div className="echo-card care-prompt" role="status">
              <StampBadge stamp="check_this" />
              <p className="care-prompt__text">
                {prompt.kind === "missing-medicine-name"
                  ? CARE.promptMissingName
                  : prompt.kind === "unknown-medicine-name"
                    ? CARE.promptUnknownName(prompt.heard ?? "")
                    : CARE.promptUnclearName(prompt.heard ?? "", prompt.suggestion ?? "")}
              </p>
              <p className="care-prompt__ask">{CARE.promptAsk}</p>
            </div>
          )}
          <div className="care-bar">
            <button type="button" className="echo-button" onClick={() => setRepeatOpen(true)}>
              {FINAL.pleaseRepeat}
            </button>
            <button
              type="button"
              className="echo-button echo-button--secondary"
              disabled={!live}
              onClick={() => (status === "paused" ? controller?.resume() : controller?.pause())}
            >
              {status === "paused" ? CARE.resume : FINAL.pause}
            </button>
            <button
              type="button"
              className="echo-button echo-button--secondary"
              disabled={!live}
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
      ) : receipt && current ? (
        <>
          <h1>
            {CARE.receiptHeading(
              current.stage,
              new Date(receipt.timestamp).toLocaleDateString(undefined, { dateStyle: "long" }),
            )}
          </h1>
          {sampleBadge}
          {playingLine}
          <ReceiptList
            facts={receipt.facts}
            fieldsByKey={fieldsFor(current.stage)}
            onPlay={play}
            noteFor={medicineNote}
          />
          <ChecklistView results={receipt.checklist} onPlay={play} />
          {receipt.nextSteps.length > 0 && (
            <ul className="care-next">
              {receipt.nextSteps.map((s) => (
                <li key={s.label}>{s.label}</li>
              ))}
            </ul>
          )}
          {disclaimer}
          <div className="echo-actions">
            <button type="button" className="echo-button" onClick={() => go("/pharmacy")}>
              {CARE.toPharmacy}
            </button>
            <button
              type="button"
              className="echo-button echo-button--secondary"
              onClick={() => go("/label")}
            >
              {CARE.checkLabel}
            </button>
            {canShare && (
              <button
                type="button"
                className="echo-button echo-button--secondary"
                onClick={() => go("/share")}
              >
                {FINAL.share}
              </button>
            )}
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

    case "/share":
      screen =
        canShare && visits.length > 0 ? (
          <>
            <SharePanel visits={visits} />
            <div className="echo-actions">
              <button
                type="button"
                className="echo-button echo-button--secondary"
                onClick={() => go("/receipt")}
              >
                {CARE.backToReceipt}
              </button>
            </div>
          </>
        ) : (
          <StatusMessage status="empty" text={{ empty: CARE.noReceipt }} />
        );
      break;

    case "/label":
      screen = (
        <>
          <h1>{CARE.labelTitle}</h1>
          {!hasMedicine ? (
            <StatusMessage status="empty" text={{ empty: CARE.labelNoMedicine }} />
          ) : labelFlags ? (
            <>
              {playingLine}
              <LabelFlagList flags={labelFlags} onPlay={play} />
              <div className="echo-actions">
                <button
                  type="button"
                  className="echo-button echo-button--secondary"
                  onClick={() => setLabelFlags(undefined)}
                >
                  {CARE.labelAgain}
                </button>
                <button
                  type="button"
                  className="echo-button echo-button--secondary"
                  onClick={() => go("/receipt")}
                >
                  {CARE.backToReceipt}
                </button>
              </div>
            </>
          ) : (
            <LabelForm onConfirm={checkLabel} />
          )}
          <p className="echo-disclaimer">{FINAL.disclaimerCare}</p>
        </>
      );
      break;

    case "/trust":
      screen = <TrustPanel summary={EVAL_SUMMARY} />;
      break;
  }

  return (
    <Skin skin="care" className="care-page">
      <main className="care-main">{screen}</main>
      <footer className="care-footer">
        <a href="#/trust">{ADDED.trustLink}</a>
      </footer>
    </Skin>
  );
}
