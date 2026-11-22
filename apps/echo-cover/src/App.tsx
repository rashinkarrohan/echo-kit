import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { CONSENT_WORDING_VERSION, compareQuotes, quoteRecordFromFacts } from "@echo/engine";
import type { Anchor, QuoteRecord, Receipt } from "@echo/engine";
import {
  CaptionView,
  ChecklistView,
  ComparisonTable,
  ConsentSheet,
  FINAL,
  ReceiptList,
  RecordingController,
  StatusMessage,
  TrustPanel,
  clock,
  createPlayer,
  goTo,
  useDeviceServices,
  useHashRoute,
  useRecording,
} from "@echo/ui";
import type { ConsentChoices, ViewStatus } from "@echo/ui";
import { COVER } from "./copy";
import { COMPARE_FIELDS, EVAL_SUMMARY, SALE, readLaunch } from "./env";
import { draftConfirmMessage } from "./draft";
import { HomePage } from "./HomePage";
import { SavedSales } from "./SavedSales";
import type { SavedSale } from "./SavedSales";
import { CoverShell } from "./CoverShell";

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

const PAGE_TITLES: Record<Route, string> = {
  "/home": "Echo Cover: compare what sellers said",
  "/saved": "Saved seller conversations | Echo Cover",
  "/consent": "Before we start | Echo Cover",
  "/questions": "Questions to ask | Echo Cover",
  "/record": "Record a seller | Echo Cover",
  "/review": "Seller receipt | Echo Cover",
  "/compare": "Compare sellers | Echo Cover",
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
  const [deleteSaleId, setDeleteSaleId] = useState<string>();
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [playing, setPlaying] = useState<{ anchor: Anchor; text: string }>();
  const [copied, setCopied] = useState<string>();
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
    const id = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("main h1");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [param, route, routeReady]);

  if (route === "/home") {
    return (
      <CoverShell route={route} savedCount={launch.demo ? 0 : sales.length}>
        <HomePage savedCount={launch.demo ? 0 : sales.length} />
      </CoverShell>
    );
  }

  if (!services) {
    return (
      <CoverShell route={route} savedCount={0}>
        <StatusMessage status="loading" text={{ loading: COVER.loadingApp }} />
      </CoverShell>
    );
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
    setDiscardConfirm(false);
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
    setDiscardConfirm(false);
    setSeller(sampleSeller(sales.length + 1));
    goTo("/review", String(sales.length + 1));
  };

  const discard = async (): Promise<void> => {
    if (!controller) return;
    await controller.discard();
    setController(undefined);
    setDiscardConfirm(false);
  };

  const deleteSale = async (sale: Sale): Promise<void> => {
    const removed = await store.deleteSession(sale.receipt.conversationId);
    if (!removed.ok) return;
    setSales((all) =>
      all.filter((item) => item.receipt.conversationId !== sale.receipt.conversationId),
    );
    setDeleteSaleId(undefined);
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
      setCopied(COVER.copied);
    } catch {
      setCopied(COVER.copyFailed);
    }
  };

  const notes = Object.fromEntries(planned.map((id) => [id, COVER.planned]));
  const disclaimer = <p className="echo-disclaimer">{FINAL.disclaimerCover}</p>;
  const sampleBadge = launch.samples ? <p className="cover-badge">{COVER.sampleBadge}</p> : null;
  const playingLine = (
    <p
      className="cover-playing"
      role="status"
      aria-live="polite"
      data-playing={playing?.anchor.segmentIds.join(",") ?? ""}
    >
      {playing?.text ?? ""}
    </p>
  );
  const sellersList =
    sales.length > 0 ? (
      <nav aria-label={COVER.sellersSoFar} className="cover-sellers">
        <h2>{COVER.sellersSoFar}</h2>
        <ol>
          {sales.map((s, i) => (
            <li key={s.receipt.conversationId}>
              <a href={`#/review/${i + 1}`}>{s.seller}</a>
            </li>
          ))}
        </ol>
      </nav>
    ) : null;
  const saleAt = (p: string | undefined): Sale | undefined => sales[Number(p) - 1];

  let screen: ReactElement;
  switch (route) {
    case "/saved":
      screen = (
        <SavedSales
          sales={sales}
          status={salesStatus}
          onOpen={openSavedSale}
          onCompare={() => goTo("/compare")}
        />
      );
      break;

    case "/consent":
      screen = launch.demo ? (
        <section className="echo-card">
          <h1>{COVER.appName}</h1>
          <p>{COVER.sampleIntro}</p>
          <div className="echo-actions">
            <button type="button" className="echo-button" onClick={() => goTo("/questions")}>
              {FINAL.playSampleConsult}
            </button>
          </div>
          <p className="echo-disclaimer">{FINAL.disclaimerCover}</p>
        </section>
      ) : (
        <div className="cover-startup">
          <a className="cover-back" href="#/home">
            <span aria-hidden="true">←</span> {COVER.backHome}
          </a>
          <p className="cover-kicker">{COVER.consentStep}</p>
          <ConsentSheet
            choices={choices}
            onChange={setChoices}
            onAgree={agree}
            disclaimer={FINAL.disclaimerCover}
            status={services.persistent ? "ready" : "error"}
            statusText={{ error: COVER.storageFallback }}
            showShare={false}
          />
          <section className="echo-card cover-sample">
            <p>{COVER.sampleIntro}</p>
            <a
              className="echo-button echo-button--secondary"
              href="?sample=sales&demo=1#/questions"
            >
              {FINAL.playSampleConsult}
            </a>
          </section>
        </div>
      );
      break;

    case "/questions":
      screen = (
        <>
          <p className="cover-kicker">{COVER.questionsStep}</p>
          <h1>{FINAL.questionsBeforeYouBuy}</h1>
          <p>{COVER.questionsHint}</p>
          <ul className="cover-questions">
            {SALE.checklist.map((item) => (
              <li key={item.id} className="echo-card">
                <label className="echo-switch">
                  <span>{item.text}</span>
                  <input
                    type="checkbox"
                    checked={planned.includes(item.id)}
                    onChange={(e) =>
                      setPlanned(
                        e.target.checked
                          ? [...planned, item.id]
                          : planned.filter((p) => p !== item.id),
                      )
                    }
                  />
                </label>
                {item.sourceUrl.startsWith("http") && (
                  <a
                    className="echo-checklist__source"
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {FINAL.source}
                    <span className="echo-visually-hidden">
                      {" "}
                      for: {item.text} (opens in a new tab)
                    </span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          <div className="echo-actions">
            <button type="button" className="echo-button" onClick={() => goTo("/record")}>
              {COVER.startRecordingSeller}
            </button>
          </div>
          {disclaimer}
        </>
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
      const recording = status === "recording" || status === "paused";
      screen = (
        <>
          <p className="cover-kicker">{COVER.recordStep(sales.length + 1)}</p>
          <h1>{COVER.startRecording}</h1>
          {sampleBadge}
          {!controller ? (
            <form
              className="echo-card"
              onSubmit={(e) => {
                e.preventDefault();
                start();
              }}
            >
              <div className="echo-field">
                <label htmlFor="cover-seller">{COVER.sellerName}</label>
                <input
                  id="cover-seller"
                  type="text"
                  autoComplete="off"
                  aria-required="true"
                  aria-invalid={sellerError !== undefined}
                  aria-describedby={sellerError ? "cover-seller-error" : "cover-seller-hint"}
                  value={seller}
                  onChange={(e) => setSeller(e.target.value)}
                />
                <p id="cover-seller-hint" className="cover-field-hint">
                  {COVER.sellerHint}
                </p>
                {sellerError && (
                  <p id="cover-seller-error" className="cover-error" role="alert">
                    {sellerError}
                  </p>
                )}
              </div>
              <button type="submit" className="echo-button">
                {COVER.startRecording}
              </button>
            </form>
          ) : (
            <>
              <p className="cover-badge" role="status">
                {status === "stopping"
                  ? COVER.stopping
                  : recording
                    ? COVER.recording(seller.trim())
                    : ""}
              </p>
              <CaptionView
                lines={rec?.lines ?? []}
                status={viewStatus}
                uncertainty={COVER.captionUncertainty}
              />
              <div className="echo-actions cover-record-actions">
                <button
                  type="button"
                  className="echo-button echo-button--secondary"
                  disabled={!recording}
                  onClick={() => (status === "paused" ? controller.resume() : controller.pause())}
                >
                  {status === "paused" ? COVER.resume : FINAL.pause}
                </button>
                <button
                  type="button"
                  className="echo-button"
                  disabled={!recording}
                  onClick={() => void stop()}
                >
                  {FINAL.stopAndReview}
                </button>
                <button
                  type="button"
                  className="echo-button echo-button--secondary"
                  onClick={() => setDiscardConfirm(true)}
                >
                  {COVER.discardRecording}
                </button>
              </div>
              {discardConfirm && (
                <div className="cover-confirm" role="group" aria-label={COVER.discardTitle}>
                  <h2>{COVER.discardTitle}</h2>
                  <p>{COVER.discardText}</p>
                  <div className="echo-actions">
                    <button
                      type="button"
                      className="echo-button echo-button--secondary"
                      onClick={() => setDiscardConfirm(false)}
                    >
                      {COVER.cancel}
                    </button>
                    <button type="button" className="echo-button" onClick={() => void discard()}>
                      {COVER.discardPermanently}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {sellersList}
          {disclaimer}
        </>
      );
      break;
    }

    case "/review": {
      const sale = saleAt(param);
      screen = sale ? (
        <>
          <h1>{COVER.reviewTitle(sale.seller)}</h1>
          {sampleBadge}
          {playingLine}
          <section className="cover-progress" aria-label={COVER.comparisonProgress}>
            <strong>{COVER.sellerProgress(sales.length)}</strong>
            <span>{sales.length < 2 ? COVER.oneMoreSeller : COVER.readyToCompare}</span>
          </section>
          <ChecklistView
            results={sale.receipt.checklist}
            title={FINAL.questionsBeforeYouBuy}
            showSources
            notes={notes}
            {...(sale.controller?.hasAudio
              ? { onPlay: (a: Anchor, r: number) => play(a, r, sale) }
              : {})}
          />
          <ReceiptList
            facts={sale.receipt.facts}
            fieldsByKey={fieldOrder}
            title={COVER.saidTitle(sale.seller)}
            {...(sale.controller?.hasAudio
              ? { onPlay: (a: Anchor, r: number) => play(a, r, sale) }
              : {})}
          />
          <div className="echo-actions cover-review-actions">
            {sales.length >= 2 ? (
              <button type="button" className="echo-button" onClick={() => goTo("/compare")}>
                {COVER.compare}
              </button>
            ) : (
              <button type="button" className="echo-button" onClick={() => goTo("/record")}>
                {COVER.recordAnother}
              </button>
            )}
            {sales.length >= 2 ? (
              <button
                type="button"
                className="echo-button echo-button--secondary"
                onClick={() => goTo("/record")}
              >
                {COVER.recordAnother}
              </button>
            ) : (
              <button
                type="button"
                className="echo-button echo-button--secondary"
                disabled
                aria-describedby="cover-compare-needed"
              >
                {COVER.compare}
              </button>
            )}
            <button
              type="button"
              className="echo-button echo-button--secondary"
              onClick={() => goTo("/confirm", param)}
            >
              {COVER.confirm}
            </button>
            <button
              type="button"
              className="echo-button echo-button--secondary"
              onClick={() => setDeleteSaleId(sale.receipt.conversationId)}
            >
              {COVER.deleteSeller}
            </button>
          </div>
          {sales.length < 2 && (
            <p id="cover-compare-needed" className="cover-field-hint">
              {COVER.oneMoreSeller}
            </p>
          )}
          {deleteSaleId === sale.receipt.conversationId && (
            <div className="cover-confirm" role="group" aria-label={COVER.deleteConfirmTitle}>
              <h2>{COVER.deleteConfirmTitle}</h2>
              <p>{COVER.deleteConfirmText}</p>
              <div className="echo-actions">
                <button
                  type="button"
                  className="echo-button echo-button--secondary"
                  onClick={() => setDeleteSaleId(undefined)}
                >
                  {COVER.cancel}
                </button>
                <button type="button" className="echo-button" onClick={() => void deleteSale(sale)}>
                  {COVER.deletePermanently}
                </button>
              </div>
            </div>
          )}
          {sellersList}
          {disclaimer}
        </>
      ) : (
        <div className="cover-recovery">
          <h1 className="echo-visually-hidden">{COVER.reviewEmptyTitle}</h1>
          <StatusMessage status="empty" text={{ empty: COVER.noSellers }} />
          <div className="echo-actions">
            <a className="echo-button" href="#/record">
              {COVER.startRecordingSeller}
            </a>
            {sales.length > 0 && (
              <a className="echo-button echo-button--secondary" href="#/saved">
                {COVER.openSaved}
              </a>
            )}
          </div>
        </div>
      );
      break;
    }

    case "/compare":
      screen = (
        <>
          <h1>{COVER.compareTitle}</h1>
          <p>{COVER.compareIntro}</p>
          {sampleBadge}
          {playingLine}
          <ComparisonTable
            rows={compareQuotes(
              sales.map((s) => s.record),
              COMPARE_FIELDS,
            )}
            onPlay={(a, r) => play(a, r)}
            canPlay={canPlay}
          />
          <div className="echo-actions">
            <button
              type="button"
              className="echo-button echo-button--secondary"
              onClick={() => goTo("/record")}
            >
              {COVER.recordAnother}
            </button>
            {sales.length > 0 && (
              <a className="echo-button echo-button--secondary" href="#/saved">
                {COVER.openSaved}
              </a>
            )}
          </div>
          {sellersList}
          {disclaimer}
        </>
      );
      break;

    case "/confirm": {
      const sale = saleAt(param);
      const message = sale
        ? draftConfirmMessage(sale.record, sale.receipt.checklist, COMPARE_FIELDS)
        : "";
      screen = sale ? (
        <>
          <h1>{COVER.confirmTitle(sale.seller)}</h1>
          <pre
            className="echo-card cover-message"
            tabIndex={0}
            aria-label={COVER.confirmTitle(sale.seller)}
          >
            {message}
          </pre>
          <div className="echo-actions">
            <button type="button" className="echo-button" onClick={() => void copyMessage(message)}>
              {COVER.copyMessage}
            </button>
            <button
              type="button"
              className="echo-button echo-button--secondary"
              onClick={() => goTo("/review", param)}
            >
              {COVER.backToReview(sale.seller)}
            </button>
            {sales.length >= 2 && (
              <button
                type="button"
                className="echo-button echo-button--secondary"
                onClick={() => goTo("/compare")}
              >
                {COVER.backToCompare}
              </button>
            )}
          </div>
          <p role="status" className="cover-badge">
            {copied ?? ""}
          </p>
          <p>{COVER.notSent}</p>
          {disclaimer}
        </>
      ) : (
        <div className="cover-recovery">
          <h1 className="echo-visually-hidden">{COVER.confirmEmptyTitle}</h1>
          <StatusMessage status="empty" text={{ empty: COVER.noSellers }} />
          <div className="echo-actions">
            <a className="echo-button" href="#/record">
              {COVER.startRecordingSeller}
            </a>
            <a className="echo-button echo-button--secondary" href="#/saved">
              {COVER.openSaved}
            </a>
          </div>
        </div>
      );
      break;
    }

    case "/trust":
      screen = <TrustPanel summary={EVAL_SUMMARY} />;
      break;
  }

  return (
    <CoverShell
      route={route}
      savedCount={launch.demo ? 0 : sales.length}
      recording={route === "/record" && controller !== undefined}
    >
      {screen}
    </CoverShell>
  );
}
