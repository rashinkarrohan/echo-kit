import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  CONSENT_WORDING_VERSION,
  applyMark,
  compareLabel,
  dictionaryWith,
  medicineNameNote,
  normaliseText,
  unclearCounts,
} from "@echo/engine";
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
  doseNoteText,
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
import type { Route } from "./router";
import { SharePanel } from "./SharePanel";
import { HomePage } from "./HomePage";
import { SavedVisits } from "./SavedVisits";
import type { SavedVisit } from "./SavedVisits";
import { MedicinesPage } from "./MedicinesPage";

const PAGE_TITLES: Record<Route, string> = {
  "/home": "Echo Care: a receipt for what was said",
  "/visits": "Saved visits | Echo Care",
  "/consent": "Before we start | Echo Care",
  "/medicines": "Your medicines | Echo Care",
  "/doctor-card": "Show the doctor | Echo Care",
  "/pharmacy": "Show the pharmacist | Echo Care",
  "/record": "Recording | Echo Care",
  "/read-back": "Read back | Echo Care",
  "/receipt": "Visit receipt | Echo Care",
  "/label": "Check the label | Echo Care",
  "/share": "Share a summary | Echo Care",
  "/trust": "Test results | Echo Care",
};

/** One finished recording (doctor or pharmacy), with its in-memory audio. */
interface Visit extends SavedVisit {
  /** Present only until this page is closed; audio is never restored from storage. */
  controller?: RecordingController;
}

function stageFor(receipt: Receipt): Stage | undefined {
  if (receipt.schemaId === SCHEMAS.doctor.id) return "doctor";
  if (receipt.schemaId === SCHEMAS.pharmacy.id) return "pharmacy";
  return undefined;
}

const fieldsFor = (stage: Stage) =>
  Object.fromEntries(SCHEMAS[stage].facts.map((f) => [f.key, f.fields]));

/**
 * Why a medicine line needs checking, in plain words; nothing for other lines.
 * `medicines` is the user's own list, so the note matches what the captions showed.
 */
function medicineNote(fact: VerifiedFact, medicines: readonly string[]): string | undefined {
  const name = fact.fields["name"];
  if (fact.key !== "medicine" || fact.stamp !== "check_this") return undefined;
  const notes: string[] = [];
  const note =
    name === undefined
      ? undefined
      : fact.checkReason === "unconfirmed-name"
        ? ({ kind: "unconfirmed" } as const)
        : medicineNameNote(name, dictionaryWith(medicines));
  if (name !== undefined && note) notes.push(medicineNoteText(name, note));
  for (const u of unclearCounts(normaliseText(fact.anchor.quote)))
    notes.push(doseNoteText(u.heard, u.suggestion));
  return notes.length > 0 ? notes.join(" ") : undefined;
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
  const [visitsStatus, setVisitsStatus] = useState<ViewStatus>("loading");
  const [selectedVisitId, setSelectedVisitId] = useState<string>();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [speakerFacing, setSpeakerFacing] = useState(false);
  const [playing, setPlaying] = useState<{ anchor: Anchor; text: string }>();
  const [deleted, setDeleted] = useState(false);
  const [labelFlags, setLabelFlags] = useState<LabelFlag[]>();
  const [medicines, setMedicines] = useState<string[]>([]);
  const [medicinesStatus, setMedicinesStatus] = useState<ViewStatus>("loading");
  const player = useRef(createPlayer());
  const rec = useRecording(controller);

  // The user's own medicines list, from this phone (samples use none).
  useEffect(() => {
    if (!services) return;
    if (launch.demo) {
      setMedicinesStatus("ready");
      return;
    }
    let active = true;
    void services.store.getMedicines().then((result) => {
      if (!active) return;
      if (result.ok) setMedicines(result.value);
      setMedicinesStatus(result.ok ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, [launch.demo, services]);

  useEffect(() => {
    if (!services) return;
    if (launch.demo) {
      setVisitsStatus("ready");
      return;
    }
    let active = true;
    void services.store.listReceipts().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setVisitsStatus("error");
        return;
      }
      const restored: Visit[] = result.value.flatMap((receipt) => {
        const savedStage = stageFor(receipt);
        return savedStage ? [{ stage: savedStage, receipt }] : [];
      });
      setVisits((existing) => {
        const byId = new Map(restored.map((visit) => [visit.receipt.conversationId, visit]));
        for (const visit of existing) byId.set(visit.receipt.conversationId, visit);
        return [...byId.values()].sort((a, b) => a.receipt.timestamp - b.receipt.timestamp);
      });
      setVisitsStatus("ready");
    });
    return () => {
      active = false;
    };
  }, [launch.demo, services]);

  const routeReady = route === "/home" || services !== undefined;
  useEffect(() => {
    if (!routeReady) return;
    document.title = PAGE_TITLES[route];
    const id = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("main h1");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [route, routeReady]);

  // The product home needs no permission and can render while on-device storage opens.
  if (route === "/home") {
    return (
      <Skin skin="care" className="care-page">
        <HomePage savedCount={launch.demo ? 0 : visits.length} />
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
  const latest = visits[visits.length - 1];
  const current = visits.find((v) => v.receipt.conversationId === selectedVisitId) ?? latest;
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
    setDeleteConfirm(false);
    setSelectedVisitId(undefined);
    setLabelFlags(undefined);
    setConsentMissing(false);
    setDiscardConfirm(false);
    const sample = launch.sample?.[next];
    c.start({
      sessionId: `${next}-${Date.now()}`,
      schema: SCHEMAS[next],
      ledger,
      store,
      medicines,
      source: sample
        ? { kind: "scripted", consult: sample, speed: launch.speed }
        : { kind: "live" },
    }).catch(() => {
      // The session's consent gate refused to start: say why instead of a blank screen.
      setController(undefined);
      setConsentMissing(true);
    });
    go("/record");
  };

  const discardRecording = async (): Promise<void> => {
    await controller?.discard();
    setController(undefined);
    setDiscardConfirm(false);
    go("/home");
  };

  const stopAndReview = async (): Promise<void> => {
    if (!controller) return;
    const result = await controller.stop();
    if (result.ok) {
      setVisits((v) => [...v, { stage, receipt: result.value, controller }]);
      setSelectedVisitId(result.value.conversationId);
      go(result.value.readBack.length > 0 ? "/read-back" : "/receipt");
    }
  };

  const updateCurrent = (next: Receipt): void => {
    setVisits((v) =>
      v.map((visit) =>
        visit.receipt.conversationId === next.conversationId ? { ...visit, receipt: next } : visit,
      ),
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
    const chunks = visitOf(anchor)?.controller?.audioFor(anchor.segmentIds) ?? [];
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
    setVisits((v) => v.filter((visit) => visit.receipt.conversationId !== receipt.conversationId));
    setController(undefined);
    setSelectedVisitId(undefined);
    setDeleteConfirm(false);
    setDeleted(true);
  };

  const openVisit = (visit: SavedVisit): void => {
    setSelectedVisitId(visit.receipt.conversationId);
    setStage(visit.stage);
    setDeleted(false);
    setDeleteConfirm(false);
    setLabelFlags(visit.receipt.labelFlags);
    go("/receipt");
  };

  const disclaimer = (
    <p className="echo-disclaimer">{SCHEMAS[current?.stage ?? stage].disclaimer}</p>
  );
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

  // While audio may be captured, no link leads away from the recording (it would keep running).
  const capturing =
    route === "/record" &&
    controller !== undefined &&
    ["starting", "loading-model", "recording", "paused", "stopping"].includes(rec?.status ?? "");

  const saveMedicines = async (next: string[]): Promise<boolean> => {
    if (launch.demo) {
      setMedicines(next);
      return true;
    }
    const saved = await store.saveMedicines(next);
    if (saved.ok) setMedicines(next);
    return saved.ok;
  };

  let screen: ReactElement;
  switch (route) {
    case "/visits":
      screen = <SavedVisits visits={visits} status={visitsStatus} onOpen={openVisit} />;
      break;

    case "/medicines":
      screen = (
        <MedicinesPage medicines={medicines} status={medicinesStatus} onChange={saveMedicines} />
      );
      break;

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
            statusText={{ error: CARE.storageFallback }}
          />
          <section className="echo-card care-sample">
            <h2>{CARE.consentMedicinesTitle}</h2>
            <p>{CARE.consentMedicinesText(medicines.length)}</p>
            <a className="echo-button echo-button--secondary" href="#/medicines">
              {CARE.consentMedicinesButton(medicines.length)}
            </a>
          </section>
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
      const failed = status === "error" || status === "permission-denied";
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
          {consentMissing ? (
            <div className="care-recover">
              <StatusMessage status="error" text={{ error: CARE.consentNeeded }} />
              <div className="echo-actions">
                <a className="echo-button" href="#/consent">
                  {CARE.goToConsent}
                </a>
              </div>
            </div>
          ) : !controller ? (
            <div className="care-recover">
              <StatusMessage status="empty" text={{ empty: CARE.noReceipt }} />
              <div className="echo-actions">
                <a className="echo-button" href="#/consent">
                  {CARE.homeStart}
                </a>
              </div>
            </div>
          ) : (
            <CaptionView lines={rec?.lines ?? []} status={viewStatus} />
          )}
          {failed && (
            <div className="echo-actions care-recover">
              <button
                type="button"
                className="echo-button"
                onClick={() => {
                  void controller?.discard();
                  startRecording(stage);
                }}
              >
                {CARE.tryAgain}
              </button>
              <a
                className="echo-button echo-button--secondary"
                href="#/home"
                onClick={() => void controller?.discard()}
              >
                {CARE.startupBack}
              </a>
            </div>
          )}
          {prompt && (
            <div className="echo-card care-prompt" role="status">
              <StampBadge stamp="check_this" />
              <p className="care-prompt__text">
                {prompt.kind === "missing-medicine-name"
                  ? CARE.promptMissingName
                  : prompt.kind === "unknown-medicine-name"
                    ? CARE.promptUnknownName(prompt.heard ?? "")
                    : prompt.kind === "unclear-dose"
                      ? CARE.promptUnclearDose(prompt.heard ?? "", prompt.suggestion ?? "")
                      : prompt.kind === "unconfirmed-medicine-name"
                        ? CARE.promptUnconfirmedName(prompt.heard ?? "")
                        : CARE.promptUnclearName(prompt.heard ?? "", prompt.suggestion ?? "")}
              </p>
              <p className="care-prompt__ask">{CARE.promptAsk}</p>
            </div>
          )}
          {controller && !failed && (
            <div className="care-bar">
              <button type="button" className="echo-button" onClick={() => setRepeatOpen(true)}>
                {FINAL.pleaseRepeat}
              </button>
              <button
                type="button"
                className="echo-button echo-button--secondary"
                disabled={!live}
                onClick={() => (status === "paused" ? controller.resume() : controller.pause())}
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
              <button
                type="button"
                className="echo-button echo-button--secondary care-bar__discard"
                disabled={status === "stopping"}
                onClick={() => setDiscardConfirm(true)}
              >
                {CARE.discardRecording}
              </button>
            </div>
          )}
          {discardConfirm && (
            <div className="echo-card care-delete" role="group" aria-label={CARE.discardTitle}>
              <h2>{CARE.discardTitle}</h2>
              <p>{CARE.discardText}</p>
              <div className="echo-actions">
                <button
                  type="button"
                  className="echo-button echo-button--secondary"
                  onClick={() => setDiscardConfirm(false)}
                >
                  {CARE.cancel}
                </button>
                <button
                  type="button"
                  className="echo-button care-delete__confirm"
                  onClick={() => void discardRecording()}
                >
                  {CARE.discardPermanently}
                </button>
              </div>
            </div>
          )}
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
        <>
          <h1 className="echo-visually-hidden">{CARE.readBackTitle}</h1>
          <StatusMessage status="empty" text={{ empty: CARE.noReceipt }} />
        </>
      );
      break;

    case "/receipt":
      screen = deleted ? (
        <>
          <h1 className="echo-visually-hidden">{ADDED.receiptTitle}</h1>
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
            {...(current.controller?.hasAudio ? { onPlay: play } : {})}
            noteFor={(fact) => medicineNote(fact, medicines)}
          />
          <ChecklistView
            results={receipt.checklist}
            {...(current.controller?.hasAudio ? { onPlay: play } : {})}
          />
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
              onClick={() => setDeleteConfirm(true)}
            >
              {CARE.deleteVisit}
            </button>
          </div>
          {deleteConfirm && (
            <div
              className="echo-card care-delete"
              role="group"
              aria-label={CARE.deleteConfirmTitle}
            >
              <h2>{CARE.deleteConfirmTitle}</h2>
              <p>{CARE.deleteConfirmText}</p>
              <div className="echo-actions">
                <button
                  type="button"
                  className="echo-button echo-button--secondary"
                  onClick={() => setDeleteConfirm(false)}
                >
                  {CARE.cancel}
                </button>
                <button
                  type="button"
                  className="echo-button care-delete__confirm"
                  onClick={() => void deleteVisit()}
                >
                  {CARE.deletePermanently}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <h1 className="echo-visually-hidden">{ADDED.receiptTitle}</h1>
          <StatusMessage
            status={visitsStatus === "loading" ? "loading" : "empty"}
            text={{ loading: CARE.savedVisitsLoading, empty: CARE.noReceipt }}
          />
          {visitsStatus !== "loading" && (
            <div className="echo-actions">
              <a className="echo-button" href="#/consent">
                {CARE.homeStart}
              </a>
              {visits.length > 0 && (
                <a className="echo-button echo-button--secondary" href="#/visits">
                  {CARE.viewSavedVisits}
                </a>
              )}
            </div>
          )}
        </>
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
          <>
            <h1 className="echo-visually-hidden">{CARE.shareTitle}</h1>
            <StatusMessage status="empty" text={{ empty: CARE.noReceipt }} />
          </>
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
              <LabelFlagList
                flags={labelFlags}
                {...(visits.some((v) => v.controller?.hasAudio) ? { onPlay: play } : {})}
              />
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
      <footer className="care-footer" hidden={capturing}>
        <nav aria-label={CARE.footerNavigation}>
          <a href="#/home">{CARE.homeLink}</a>
          {visits.length > 0 && route !== "/visits" && (
            <a href="#/visits">{CARE.savedVisitsTitle}</a>
          )}
          {route !== "/medicines" && <a href="#/medicines">{CARE.medicinesLink}</a>}
          {route !== "/trust" && <a href="#/trust">{ADDED.trustLink}</a>}
        </nav>
      </footer>
    </Skin>
  );
}
