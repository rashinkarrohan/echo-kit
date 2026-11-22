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
  FINAL,
  LabelFlagList,
  LabelForm,
  ReadBackPanel,
  RecordingController,
  TrustPanel,
  clock,
  doseNoteText,
  medicineNoteText,
  createPlayer,
  useDeviceServices,
  useRecording,
  focusMainHeading,
} from "@echo/ui";
import type { ConsentChoices, ViewStatus } from "@echo/ui";
import { StatusMessage } from "@echo/ui";
import { CARE } from "./copy";
import { EVAL_SUMMARY, SCHEMAS, readLaunch } from "./env";
import type { Stage } from "./env";
import { go, useRoute } from "./router";
import type { Route } from "./router";
import { SharePanel } from "./SharePanel";
import type { SavedVisit } from "./visit";
import { AskScreen } from "./design/AskScreen";
import { CaptionsScreen } from "./design/CaptionsScreen";
import { CD } from "./design/copy";
import { DoctorScreen } from "./design/DoctorScreen";
import { HomeScreen } from "./design/HomeScreen";
import { MedicinesScreen } from "./design/MedicinesScreen";
import { MicScreen } from "./design/MicScreen";
import { NoticeScreen, SharedScreen } from "./design/NoticeScreen";
import { QuestionsScreen } from "./design/QuestionsScreen";
import { RepeatScreen } from "./design/RepeatScreen";
import { tileForPrompt } from "./design/repeat";
import { SummaryScreen } from "./design/SummaryScreen";
import { VisitsScreen } from "./design/VisitsScreen";
import { BackLink, ToggleRow } from "./design/parts";
import { readInterpreter } from "./design/prefs";

const PAGE_TITLES: Record<Route, string> = {
  "/home": "Echo Care: read what your doctor says",
  "/visits": "Your visits | Echo Care",
  "/consent": "Your microphone | Echo Care",
  "/medicines": "Your medicines | Echo Care",
  "/doctor-card": "Show the doctor | Echo Care",
  "/pharmacy": "Show the pharmacist | Echo Care",
  "/record": "Live captions | Echo Care",
  "/repeat": "Please repeat | Echo Care",
  "/ask": "Please help me | Echo Care",
  "/questions": "Questions and safety | Echo Care",
  "/read-back": "Read back | Echo Care",
  "/receipt": "Visit summary | Echo Care",
  "/label": "Check the label | Echo Care",
  "/share": "Share with family | Echo Care",
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
  const [shareChoice, setShareChoice] = useState(false);
  const [, setShareTick] = useState(0);
  const [stage, setStage] = useState<Stage>("doctor");
  const [controller, setController] = useState<RecordingController>();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsStatus, setVisitsStatus] = useState<ViewStatus>("loading");
  const [selectedVisitId, setSelectedVisitId] = useState<string>();
  const [consentMissing, setConsentMissing] = useState(false);
  const [speakerFacing, setSpeakerFacing] = useState(false);
  const [playing, setPlaying] = useState<{ anchor: Anchor; text: string }>();
  const [labelFlags, setLabelFlags] = useState<LabelFlag[]>();
  const [medicines, setMedicines] = useState<string[]>([]);
  const [medicinesStatus, setMedicinesStatus] = useState<ViewStatus>("loading");
  const [ask, setAsk] = useState<{ message: string; back: Route }>();
  const [notice, setNotice] = useState<string>();
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
    const id = window.requestAnimationFrame(() => focusMainHeading());
    return () => window.cancelAnimationFrame(id);
  }, [route, routeReady]);

  // A notice (a visit was deleted) shows on Home once, then goes.
  useEffect(() => {
    if (route !== "/home") setNotice(undefined);
  }, [route]);

  const latest = visits[visits.length - 1];

  const openVisit = (visit: SavedVisit): void => {
    setSelectedVisitId(visit.receipt.conversationId);
    setStage(visit.stage);
    setLabelFlags(visit.receipt.labelFlags);
    go("/receipt");
  };

  // The product home needs no permission and can render while on-device storage opens.
  if (route === "/home") {
    const last = launch.demo ? undefined : latest;
    return (
      <HomeScreen
        {...(last ? { last: { stage: last.stage, receipt: last.receipt } } : {})}
        {...(notice ? { notice } : {})}
        onOpenLast={() => last && openVisit(last)}
      />
    );
  }

  if (!services) {
    return <NoticeScreen title={CD.appName} status="loading" text={CARE.loadingApp} />;
  }
  const { store, ledger } = services;
  const current = visits.find((v) => v.receipt.conversationId === selectedVisitId) ?? latest;
  const receipt = current?.receipt;
  const sample = launch.sample !== undefined;

  const agree = (): void => {
    ledger.grant("record", CONSENT_WORDING_VERSION);
    ledger.grant("transcribe", CONSENT_WORDING_VERSION);
    void ledger.persist();
    startRecording(stage);
  };

  function startRecording(next: Stage): void {
    const c = new RecordingController();
    setStage(next);
    setController(c);
    setSelectedVisitId(undefined);
    setLabelFlags(undefined);
    setConsentMissing(false);
    const chosen = launch.sample?.[next];
    c.start({
      sessionId: `${next}-${Date.now()}`,
      schema: SCHEMAS[next],
      ledger,
      store,
      medicines,
      source: chosen
        ? { kind: "scripted", consult: chosen, speed: launch.speed }
        : { kind: "live" },
    }).catch(() => {
      // The session's consent gate refused to start: say why instead of a blank screen.
      setController(undefined);
      setConsentMissing(true);
    });
    go("/record");
  }

  const discardRecording = async (): Promise<void> => {
    await controller?.discard();
    setController(undefined);
    go("/home");
  };

  const stopAndReview = async (): Promise<void> => {
    if (!controller) return;
    const result = await controller.stop();
    if (result.ok) {
      setVisits((v) => [...v, { stage, receipt: result.value, controller }]);
      setSelectedVisitId(result.value.conversationId);
      go("/receipt");
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
  const onPlay = current?.controller?.hasAudio ? play : undefined;
  const playingText = playing?.text ?? "";
  const playingId = playing?.anchor.segmentIds.join(",") ?? "";

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
    setNotice(CD.deletedNotice);
    go("/home");
  };

  const saveMedicines = async (next: string[]): Promise<boolean> => {
    if (launch.demo) {
      setMedicines(next);
      return true;
    }
    const saved = await store.saveMedicines(next);
    if (saved.ok) setMedicines(next);
    return saved.ok;
  };

  const openAsk = (message: string, back: Route): void => {
    setAsk({ message, back });
    go("/ask");
  };

  const noReceipt = (title: string): ReactElement =>
    visitsStatus === "loading" ? (
      <NoticeScreen title={title} status="loading" text={CARE.savedVisitsLoading} active="visits" />
    ) : (
      <NoticeScreen title={title} status="empty" text={CD.noReceiptText} active="visits">
        <a className="cd-btn cd-btn--primary" href="#/doctor-card">
          {CD.startVisit}
        </a>
        {visits.length > 0 && (
          <a className="cd-btn cd-btn--outline" href="#/visits">
            {CARE.viewSavedVisits}
          </a>
        )}
      </NoticeScreen>
    );

  const hasMedicine = visits.some((v) => v.receipt.facts.some((f) => f.key === "medicine"));

  switch (route) {
    case "/visits":
      return (
        <VisitsScreen
          visits={visits.map((v) => ({ stage: v.stage, receipt: v.receipt }))}
          status={visitsStatus}
          onOpen={openVisit}
        />
      );

    case "/medicines":
      return (
        <MedicinesScreen medicines={medicines} status={medicinesStatus} onChange={saveMedicines} />
      );

    case "/doctor-card":
    case "/pharmacy": {
      const next: Stage = route === "/doctor-card" ? "doctor" : "pharmacy";
      return (
        <DoctorScreen
          stage={next}
          onYes={() => {
            setStage(next);
            if (launch.demo) startRecording(next);
            else go("/consent");
          }}
        />
      );
    }

    case "/consent":
      if (launch.demo) {
        return (
          <DoctorScreen
            stage="doctor"
            onYes={() => {
              setStage("doctor");
              startRecording("doctor");
            }}
          />
        );
      }
      return (
        <MicScreen
          choices={choices}
          onChange={setChoices}
          onAllow={agree}
          backHref={stage === "doctor" ? "#/doctor-card" : "#/pharmacy"}
          storageOk={services.persistent}
          storageText={CARE.storageFallback}
        />
      );

    case "/record": {
      const prompt = rec?.prompts[rec.prompts.length - 1];
      const promptText = prompt
        ? prompt.kind === "missing-medicine-name"
          ? CARE.promptMissingName
          : prompt.kind === "unknown-medicine-name"
            ? CARE.promptUnknownName(prompt.heard ?? "")
            : prompt.kind === "unclear-dose"
              ? CARE.promptUnclearDose(prompt.heard ?? "", prompt.suggestion ?? "")
              : prompt.kind === "unconfirmed-medicine-name"
                ? CARE.promptUnconfirmedName(prompt.heard ?? "")
                : CARE.promptUnclearName(prompt.heard ?? "", prompt.suggestion ?? "")
        : undefined;
      return (
        <CaptionsScreen
          status={rec?.status ?? "idle"}
          lines={rec?.lines ?? []}
          {...(promptText ? { promptText } : {})}
          promptAsk={CARE.promptAsk}
          missing={!controller && !consentMissing}
          consentMissing={consentMissing}
          sample={sample}
          onPause={() => controller?.pause()}
          onResume={() => controller?.resume()}
          onFinish={() => void stopAndReview()}
          onDiscard={() => void discardRecording()}
          onRetry={() => {
            void controller?.discard();
            startRecording(stage);
          }}
        />
      );
    }

    case "/repeat": {
      const prompt = rec?.prompts[rec.prompts.length - 1];
      return <RepeatScreen initial={tileForPrompt(prompt?.kind)} stage={stage} />;
    }

    case "/ask":
      return ask ? (
        <AskScreen
          message={ask.message}
          interpreter={readInterpreter()}
          backHref={`#${ask.back}`}
        />
      ) : (
        noReceipt(CD.askTitle)
      );

    case "/read-back":
      return receipt ? (
        <SharedScreen active="visits">
          <BackLink href="#/receipt" ariaLabel="Back to visit summary" />
          <h1 className="cd-title">{CARE.readBackTitle}</h1>
          <ReadBackPanel
            items={receipt.readBack}
            onMark={mark}
            speakerFacing={speakerFacing}
            onToggleSpeaker={setSpeakerFacing}
          />
          <div className="echo-actions">
            <a className="echo-button" href="#/receipt">
              {CARE.toReceipt}
            </a>
          </div>
          <p className="echo-disclaimer">{CD.disclaimer}</p>
        </SharedScreen>
      ) : (
        noReceipt(CARE.readBackTitle)
      );

    case "/receipt":
      return receipt && current ? (
        <SummaryScreen
          stage={current.stage}
          receipt={receipt}
          sample={sample}
          {...(onPlay ? { onPlay } : {})}
          playingText={playingText}
          playingId={playingId}
          noteFor={(fact) => medicineNote(fact, medicines)}
          onAsk={(message) => openAsk(message, "/receipt")}
        />
      ) : (
        noReceipt(CD.noReceiptTitle)
      );

    case "/questions":
      return receipt ? (
        <QuestionsScreen
          receipt={receipt}
          sample={sample}
          {...(onPlay ? { onPlay } : {})}
          playingText={playingText}
          playingId={playingId}
          onAsk={(message) => openAsk(message, "/questions")}
          onDelete={() => void deleteVisit()}
        />
      ) : (
        noReceipt(CD.questionsTitle)
      );

    case "/share": {
      if (visits.length === 0) return noReceipt(CARE.shareTitle);
      if (!ledger.has("share")) {
        return (
          <SharedScreen active="visits">
            <BackLink href="#/questions" ariaLabel="Back to questions and safety" />
            <h1 className="cd-title">{CARE.shareTitle}</h1>
            <p className="cd-lead cd-lead--soft">{CD.shareLead}</p>
            <ToggleRow
              icon="share"
              label={CD.shareConsent}
              description={CD.shareConsentWhy}
              checked={shareChoice}
              onChange={setShareChoice}
            />
            <button
              type="button"
              className="cd-btn cd-btn--primary"
              disabled={!shareChoice}
              onClick={() => {
                ledger.grant("share", CONSENT_WORDING_VERSION);
                void ledger.persist();
                setShareTick((n) => n + 1);
              }}
            >
              {CD.shareContinue}
            </button>
          </SharedScreen>
        );
      }
      return (
        <SharedScreen active="visits">
          <BackLink href="#/questions" ariaLabel="Back to questions and safety" />
          <SharePanel visits={visits} />
        </SharedScreen>
      );
    }

    case "/label":
      return (
        <SharedScreen active="visits">
          <BackLink href="#/questions" ariaLabel="Back to questions and safety" />
          <h1 className="cd-title">{CARE.labelTitle}</h1>
          {!hasMedicine ? (
            <StatusMessage status="empty" text={{ empty: CARE.labelNoMedicine }} />
          ) : labelFlags ? (
            <>
              <p className="cd-note cd-playing" role="status" aria-live="polite">
                {playingText}
              </p>
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
                <a className="echo-button echo-button--secondary" href="#/receipt">
                  {CARE.backToReceipt}
                </a>
              </div>
            </>
          ) : (
            <LabelForm onConfirm={checkLabel} />
          )}
          <a className="cd-btn cd-btn--outline" href="#/pharmacy">
            {CD.recordPharmacy}
          </a>
          <p className="echo-disclaimer">{FINAL.disclaimerCare}</p>
        </SharedScreen>
      );

    case "/trust":
      return (
        <SharedScreen>
          <BackLink href="#/home" ariaLabel="Back to home" />
          <TrustPanel summary={EVAL_SUMMARY} />
        </SharedScreen>
      );
  }
}
