import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { CONSENT_WORDING_VERSION, compareQuotes, quoteRecordFromFacts } from "@echo/engine";
import type { Anchor, QuoteRecord, Receipt } from "@echo/engine";
import {
  RecordingController,
  clock,
  createPlayer,
  goTo,
  useDeviceServices,
  useHashRoute,
  useRecording,
  focusMainHeading,
} from "@echo/ui";
import type { ConsentChoices, ViewStatus } from "@echo/ui";
import { COVER } from "./copy";
import { COMPARE_FIELDS, EVAL_SUMMARY, SALE, readLaunch } from "./env";
import { draftConfirmMessage } from "./draft";
import { CV } from "./design/copy";
import { CompareScreen } from "./design/CompareScreen";
import { ConfirmScreen } from "./design/ConfirmScreen";
import { ConsentScreen } from "./design/ConsentScreen";
import { HomeScreen } from "./design/HomeScreen";
import { NoticeScreen } from "./design/NoticeScreen";
import { QuestionsScreen } from "./design/QuestionsScreen";
import { ReceiptScreen } from "./design/ReceiptScreen";
import { RecordScreen } from "./design/RecordScreen";
import { SavedScreen } from "./design/SavedScreen";
import type { SavedSale } from "./design/SavedScreen";
import { TrustScreen } from "./design/TrustScreen";

type Route =
  | "/home"
  | "/saved"
  | "/consent"
  | "/questions"
  | "/record"
  | "/review"
  | "/compare"
  | "/confirm"
  | "/trust";
const ROUTES: readonly Route[] = [
  "/home",
  "/saved",
  "/consent",
  "/questions",
  "/record",
  "/review",
  "/compare",
  "/confirm",
  "/trust",
];

const fieldOrder = Object.fromEntries(SALE.facts.map((f) => [f.key, f.fields]));
const QUESTION_IDS = SALE.checklist.map((item) => item.id);

const PAGE_TITLES: Record<Route, string> = {
  "/home": "Echo Cover: compare what sellers said",
  "/saved": "Saved seller conversations | Echo Cover",
  "/consent": "Before we start | Echo Cover",
  "/questions": "Questions to ask | Echo Cover",
  "/record": "Record a seller | Echo Cover",
  "/review": "Seller receipt | Echo Cover",
  "/compare": "Seller ledger | Echo Cover",
  "/confirm": "Confirm in writing | Echo Cover",
  "/trust": "Test results | Echo Cover",
};

/** One recorded seller conversation, with its in-memory audio. */
interface Sale extends SavedSale {
  record: QuoteRecord;
  /** Present only until this page is closed; audio is not restored. */
  controller?: RecordingController;
}

export function App(): ReactElement {
  const { route, param } = useHashRoute(ROUTES, "/home");
  const launch = useMemo(() => readLaunch(window.location.search), []);
  const services = useDeviceServices("echo-cover", launch.demo);
  const [choices, setChoices] = useState<ConsentChoices>({
    record: false,
    transcribe: false,
    share: false,
  });
  const [planned, setPlanned] = useState<string[]>([]);
  const sampleSeller = (n: number): string =>
    launch.demo ? (launch.samples?.[n % launch.samples.length]?.seller ?? "") : "";
  const [seller, setSeller] = useState(() => sampleSeller(0));
  const [sellerError, setSellerError] = useState<string>();
  const [controller, setController] = useState<RecordingController>();
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesStatus, setSalesStatus] = useState<ViewStatus>("loading");
  const [playing, setPlaying] = useState<{ anchor: Anchor; text: string }>();
  const [copied, setCopied] = useState<"yes" | "failed">();
  const player = useRef(createPlayer());
  const rec = useRecording(controller);

  useEffect(() => {
    if (!services) return;
    if (launch.demo) {
      setSalesStatus("ready");
      return;
    }
    let active = true;
    void services.store.listReceipts().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setSalesStatus("error");
        return;
      }
      const restored: Sale[] = result.value
        .filter(
          (receipt): receipt is Receipt & { seller: string } =>
            receipt.schemaId === SALE.id && Boolean(receipt.seller),
        )
        .map((receipt) => ({
          seller: receipt.seller,
          receipt,
          record: quoteRecordFromFacts(
            receipt.conversationId,
            receipt.seller,
            receipt.facts,
            fieldOrder,
          ),
        }));
      setSales((existing) => {
        const byId = new Map(restored.map((sale) => [sale.receipt.conversationId, sale]));
        for (const sale of existing) byId.set(sale.receipt.conversationId, sale);
        return [...byId.values()].sort((a, b) => a.receipt.timestamp - b.receipt.timestamp);
      });
      setSalesStatus("ready");
    });
    return () => {
      active = false;
    };
  }, [launch.demo, services]);

  const routeReady = route === "/home" || services !== undefined;
  useEffect(() => {
    if (!routeReady) return;
    document.title = PAGE_TITLES[route];
    setCopied(undefined);
    const id = window.requestAnimationFrame(() => focusMainHeading());
    return () => window.cancelAnimationFrame(id);
  }, [param, route, routeReady]);

  if (route === "/home") {
    return <HomeScreen savedCount={launch.demo ? 0 : sales.length} />;
  }

  if (!services) {
    return <NoticeScreen title={CV.appName} status="loading" text={COVER.loadingApp} />;
  }
  const { store, ledger } = services;

  const agree = (): void => {
    ledger.grant("record", CONSENT_WORDING_VERSION);
    ledger.grant("transcribe", CONSENT_WORDING_VERSION);
    void ledger.persist();
    goTo("/questions");
  };

  const start = (): void => {
    const name = seller.trim();
    if (!name) {
      setSellerError(COVER.sellerNeeded);
      return;
    }
    if (sales.some((sale) => sale.seller.toLowerCase() === name.toLowerCase())) {
      setSellerError(COVER.sellerDuplicate);
      return;
    }
    setSellerError(undefined);
    const c = new RecordingController();
    setController(c);
    const sample = launch.samples?.[sales.length % (launch.samples.length || 1)];
    void c
      .start({
        sessionId: `sale-${sales.length + 1}-${Date.now()}`,
        schema: SALE,
        ledger,
        store,
        seller: name,
        source: sample
          ? { kind: "scripted", consult: sample, speed: launch.speed }
          : { kind: "live" },
      })
      .catch(() => {
        setController(undefined);
        setSellerError(COVER.consentNeeded);
      });
  };

  const stop = async (): Promise<void> => {
    if (!controller) return;
    const result = await controller.stop();
    if (!result.ok) return;
    const name = result.value.seller ?? seller.trim();
    const sale: Sale = {
      seller: name,
      receipt: result.value,
      record: quoteRecordFromFacts(
        result.value.conversationId,
        name,
        result.value.facts,
        fieldOrder,
      ),
      controller,
    };
    setSales((s) => [...s, sale]);
    setController(undefined);
    setSeller(sampleSeller(sales.length + 1));
    goTo("/review", String(sales.length + 1));
  };

  const discard = async (): Promise<void> => {
    if (!controller) return;
    await controller.discard();
    setController(undefined);
  };

  const retry = async (): Promise<void> => {
    await controller?.discard();
    setController(undefined);
    // Start again with the same name once the form is back.
    window.setTimeout(start, 0);
  };

  const deleteSale = async (sale: Sale): Promise<void> => {
    player.current.stop();
    const removed = await store.deleteSession(sale.receipt.conversationId);
    if (!removed.ok) return;
    setSales((all) =>
      all.filter((item) => item.receipt.conversationId !== sale.receipt.conversationId),
    );
    goTo("/saved");
  };

  const saleForAnchor = (anchor: Anchor): Sale | undefined =>
    sales.find(
      (sale) =>
        Object.values(sale.record.fields).some((field) => field.anchor === anchor) ||
        sale.receipt.facts.some((fact) => fact.anchor === anchor) ||
        sale.receipt.checklist.some((item) => item.anchor === anchor),
    );

  const canPlay = (anchor: Anchor): boolean => saleForAnchor(anchor)?.controller?.hasAudio === true;

  const play = (anchor: Anchor, rate: number, sale?: Sale): void => {
    const owner = sale ?? saleForAnchor(anchor);
    const chunks = owner?.controller?.audioFor(anchor.segmentIds) ?? [];
    setPlaying({
      anchor,
      text: COVER.playing(`${clock(anchor.startMs)} to ${clock(anchor.endMs)}`),
    });
    void player.current.play(chunks, 16000, rate).then((r) => {
      if (!r.ok) setPlaying({ anchor, text: COVER.playFailed });
    });
  };
  const playingText = playing?.text ?? "";
  const playingId = playing?.anchor.segmentIds.join(",") ?? "";

  const openSavedSale = (saved: SavedSale): void => {
    const index = sales.findIndex(
      (sale) => sale.receipt.conversationId === saved.receipt.conversationId,
    );
    if (index >= 0) goTo("/review", String(index + 1));
  };

  const copyMessage = async (message: string): Promise<void> => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(message);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  };

  /** The device's own share sheet or mail app; Echo itself sends nothing. */
  const shareMessage = async (title: string, message: string): Promise<void> => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text: message });
        return;
      }
    } catch {
      return; // The person closed the share sheet.
    }
    window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`;
  };

  const sellerList = sales.map((s, i) => ({ name: s.seller, number: i + 1 }));
  const saleAt = (p: string | undefined): Sale | undefined => sales[Number(p) - 1];
  const sample = launch.samples !== undefined;

  const noSale = (title: string): ReactElement => (
    <NoticeScreen title={title} status="empty" text={CV.noSellers}>
      <a className="cv-btn cv-btn--primary" href="#/consent">
        {CV.startRecordingSeller}
      </a>
      {sales.length > 0 && (
        <a className="cv-btn cv-btn--outline" href="#/saved">
          {COVER.openSaved}
        </a>
      )}
    </NoticeScreen>
  );

  switch (route) {
    case "/saved":
      return (
        <SavedScreen
          sales={sales}
          status={salesStatus}
          errorText={COVER.savedError}
          loadingText={COVER.savedLoading}
          onOpen={openSavedSale}
        />
      );

    case "/consent":
      // The practice conversation needs no consent (actors, no microphone): go straight on.
      return launch.demo ? (
        <QuestionsScreen
          items={SALE.checklist}
          chosen={planned}
          onChange={setPlanned}
          backHref="#/home"
          onStart={() => goTo("/record")}
        />
      ) : (
        <ConsentScreen
          choices={choices}
          onChange={setChoices}
          onAgree={agree}
          storageOk={services.persistent}
          storageText={COVER.storageFallback}
        />
      );

    case "/questions":
      return (
        <QuestionsScreen
          items={SALE.checklist}
          chosen={planned.filter((id) => QUESTION_IDS.includes(id))}
          onChange={setPlanned}
          backHref={launch.demo ? "#/home" : "#/consent"}
          onStart={() => goTo("/record")}
        />
      );

    case "/record":
      return (
        <RecordScreen
          sellerNumber={sales.length + 1}
          seller={seller}
          onSeller={setSeller}
          sellerError={sellerError}
          onStart={start}
          active={controller !== undefined}
          status={rec?.status ?? "idle"}
          lines={rec?.lines ?? []}
          sample={sample}
          onPause={() => controller?.pause()}
          onResume={() => controller?.resume()}
          onStop={() => void stop()}
          onDiscard={() => void discard()}
          onRetry={() => void retry()}
        />
      );

    case "/review": {
      const sale = saleAt(param);
      return sale ? (
        <ReceiptScreen
          seller={sale.seller}
          receipt={sale.receipt}
          number={Number(param)}
          salesCount={sales.length}
          sample={sample}
          planned={planned}
          fieldsByKey={fieldOrder}
          {...(sale.controller?.hasAudio
            ? { onPlay: (a: Anchor, r: number) => play(a, r, sale) }
            : {})}
          playingText={playingText}
          playingId={playingId}
          onDelete={() => void deleteSale(sale)}
        />
      ) : (
        noSale(CV.reviewEmptyTitle)
      );
    }

    case "/compare":
      return sales.length >= 2 ? (
        <CompareScreen
          rows={compareQuotes(
            sales.map((s) => s.record),
            COMPARE_FIELDS,
          )}
          sellers={sellerList}
          sample={sample}
          onPlay={(a, r) => play(a, r)}
          canPlay={canPlay}
          playingText={playingText}
          playingId={playingId}
          backHref={`#/review/${sales.length}`}
        />
      ) : (
        <NoticeScreen
          title={CV.ledgerHeading}
          status="empty"
          text={CV.compareEmptyText}
          active="compare"
        >
          <a className="cv-btn cv-btn--primary" href={sales.length > 0 ? "#/record" : "#/consent"}>
            {CV.startRecordingSeller}
          </a>
          {sales.length > 0 && (
            <a className="cv-btn cv-btn--outline" href="#/saved">
              {COVER.openSaved}
            </a>
          )}
        </NoticeScreen>
      );

    case "/confirm": {
      const number = param === undefined ? sales.length : Number(param);
      const sale = saleAt(String(number));
      if (!sale) return noSale(CV.confirmTitle);
      const message = draftConfirmMessage(sale.record, sale.receipt.checklist, COMPARE_FIELDS);
      return (
        <ConfirmScreen
          seller={sale.seller}
          message={message}
          sellers={sellerList}
          number={number}
          sample={sample}
          copied={copied === "yes"}
          copyFailed={copied === "failed"}
          onCopy={() => void copyMessage(message)}
          onShare={() => void shareMessage(CV.messageTo(sale.seller), message)}
        />
      );
    }

    case "/trust":
      return <TrustScreen summary={EVAL_SUMMARY} />;
  }
}
