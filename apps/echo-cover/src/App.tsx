import { useMemo, useRef, useState } from "react";
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
  ADDED,
  Skin,
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

type Route = "/consent" | "/questions" | "/record" | "/review" | "/compare" | "/confirm" | "/trust";
const ROUTES: readonly Route[] = [
  "/consent",
  "/questions",
  "/record",
  "/review",
  "/compare",
  "/confirm",
  "/trust",
];

const fieldOrder = Object.fromEntries(SALE.facts.map((f) => [f.key, f.fields]));

/** One recorded seller conversation, with its in-memory audio. */
interface Sale {
  seller: string;
  receipt: Receipt;
  record: QuoteRecord;
  controller: RecordingController;
}

export function App(): ReactElement {
  const { route, param } = useHashRoute(ROUTES, "/consent");
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
  const [sellerError, setSellerError] = useState(false);
  const [controller, setController] = useState<RecordingController>();
  const [sales, setSales] = useState<Sale[]>([]);
  const [playing, setPlaying] = useState<{ anchor: Anchor; text: string }>();
  const [copied, setCopied] = useState<string>();
  const player = useRef(createPlayer());
  const rec = useRecording(controller);

  if (!services) {
    return (
      <Skin skin="cover" className="cover-page">
        <StatusMessage status="loading" text={{ loading: COVER.loadingApp }} />
      </Skin>
    );
  }
  const { store, ledger } = services;

  const agree = (): void => {
    ledger.grant("record", CONSENT_WORDING_VERSION);
    ledger.grant("transcribe", CONSENT_WORDING_VERSION);
    if (choices.share) ledger.grant("share", CONSENT_WORDING_VERSION);
    void ledger.persist();
    goTo("/questions");
  };

  const start = (): void => {
    const name = seller.trim();
    if (!name) {
      setSellerError(true);
      return;
    }
    setSellerError(false);
    const c = new RecordingController();
    setController(c);
    const sample = launch.samples?.[sales.length % (launch.samples.length || 1)];
    void c.start({
      sessionId: `sale-${sales.length + 1}-${Date.now()}`,
      schema: SALE,
      ledger,
      store,
      seller: name,
      source: sample
        ? { kind: "scripted", consult: sample, speed: launch.speed }
        : { kind: "live" },
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

  const play = (anchor: Anchor, rate: number, sale?: Sale): void => {
    const owner =
      sale ??
      sales.find(
        (s) =>
          Object.values(s.record.fields).some((f) => f.anchor === anchor) ||
          s.receipt.facts.some((f) => f.anchor === anchor) ||
          s.receipt.checklist.some((c) => c.anchor === anchor),
      );
    const chunks = owner?.controller.audioFor(anchor.segmentIds) ?? [];
    setPlaying({
      anchor,
      text: COVER.playing(`${clock(anchor.startMs)} to ${clock(anchor.endMs)}`),
    });
    void player.current.play(chunks, 16000, rate).then((r) => {
      if (!r.ok) setPlaying({ anchor, text: COVER.playFailed });
    });
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
        <>
          <ConsentSheet
            choices={choices}
            onChange={setChoices}
            onAgree={agree}
            disclaimer={FINAL.disclaimerCover}
            status={services.persistent ? "ready" : "error"}
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
        </>
      );
      break;

    case "/questions":
      screen = (
        <>
          <h1>{FINAL.questionsBeforeYouBuy}</h1>
          <p>{COVER.questionsHint}</p>
          <ul className="cover-questions">
            {SALE.checklist.map((item) => (
              <li key={item.id} className="echo-card">
                <label className="echo-switch">
                  <span>{item.text}</span>
                  <input
                    type="checkbox"
                    role="switch"
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
                  aria-invalid={sellerError}
                  aria-describedby={sellerError ? "cover-seller-error" : undefined}
                  value={seller}
                  onChange={(e) => setSeller(e.target.value)}
                />
                {sellerError && (
                  <p id="cover-seller-error" className="cover-error" role="alert">
                    {COVER.sellerNeeded}
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
              <CaptionView lines={rec?.lines ?? []} status={viewStatus} />
              <div className="echo-actions">
                <button
                  type="button"
                  className="echo-button"
                  disabled={!recording}
                  onClick={() => void stop()}
                >
                  {FINAL.stopAndReview}
                </button>
              </div>
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
          <ChecklistView
            results={sale.receipt.checklist}
            title={FINAL.questionsBeforeYouBuy}
            showSources
            notes={notes}
            onPlay={(a, r) => play(a, r, sale)}
          />
          <ReceiptList
            facts={sale.receipt.facts}
            fieldsByKey={fieldOrder}
            title={COVER.saidTitle(sale.seller)}
            onPlay={(a, r) => play(a, r, sale)}
          />
          <div className="echo-actions">
            <button type="button" className="echo-button" onClick={() => goTo("/record")}>
              {COVER.recordAnother}
            </button>
            <button
              type="button"
              className="echo-button echo-button--secondary"
              disabled={sales.length < 2}
              onClick={() => goTo("/compare")}
            >
              {COVER.compare}
            </button>
            <button
              type="button"
              className="echo-button echo-button--secondary"
              onClick={() => goTo("/confirm", param)}
            >
              {COVER.confirm}
            </button>
          </div>
          {sellersList}
          {disclaimer}
        </>
      ) : (
        <StatusMessage status="empty" text={{ empty: COVER.noSellers }} />
      );
      break;
    }

    case "/compare":
      screen = (
        <>
          {sampleBadge}
          {playingLine}
          <ComparisonTable
            rows={compareQuotes(
              sales.map((s) => s.record),
              COMPARE_FIELDS,
            )}
            onPlay={(a, r) => play(a, r)}
          />
          <div className="echo-actions">
            <button type="button" className="echo-button" onClick={() => goTo("/record")}>
              {COVER.recordAnother}
            </button>
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
            <button
              type="button"
              className="echo-button"
              onClick={() =>
                void navigator.clipboard.writeText(message).then(
                  () => setCopied(COVER.copied),
                  () => setCopied(COVER.copyFailed),
                )
              }
            >
              {COVER.copyMessage}
            </button>
            <button
              type="button"
              className="echo-button echo-button--secondary"
              onClick={() => goTo("/review", param)}
            >
              {COVER.reviewTitle(sale.seller)}
            </button>
          </div>
          <p role="status" className="cover-badge">
            {copied ?? ""}
          </p>
          <p>{COVER.notSent}</p>
          {disclaimer}
        </>
      ) : (
        <StatusMessage status="empty" text={{ empty: COVER.noSellers }} />
      );
      break;
    }

    case "/trust":
      screen = <TrustPanel summary={EVAL_SUMMARY} />;
      break;
  }

  return (
    <Skin skin="cover" className="cover-page">
      <header className="cover-header">
        <p className="cover-header__name">{COVER.appName}</p>
      </header>
      <main>{screen}</main>
      <footer className="cover-footer">
        <a href="#/trust">{ADDED.trustLink}</a>
      </footer>
    </Skin>
  );
}
