/**
 * S18 gallery: every component in every state, in both skins. Checked by
 * ui/e2e/tests/gallery.spec.ts with axe, reduced motion, 200% zoom and keyboard.
 * Sample data is scripted (actors only, fictional).
 */

import { useState } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { buildReadBack, compareQuotes } from "@echo/engine";
import type {
  Anchor,
  ChecklistResult,
  QuoteRecord,
  ReadBackItem,
  VerifiedFact,
} from "@echo/engine";
import {
  AnchorChip,
  CaptionView,
  ChecklistView,
  ComparisonTable,
  ConsentSheet,
  FINAL,
  ReadBackPanel,
  ReceiptList,
  SPEAKER_CARDS,
  Skin,
  SpeakerCard,
  StampBadge,
  ChecklistStamp,
} from "../../src/index";
import type { CaptionLine, ConsentChoices, SkinName, ViewStatus } from "../../src/index";
import "../../src/styles.css";

const STATUSES: ViewStatus[] = ["ready", "loading", "empty", "error", "permission-denied"];
const a = (id: string, startMs: number, endMs: number, quote: string): Anchor => ({
  segmentIds: [id],
  startMs,
  endMs,
  quote,
});
const play = (): void => {};

const lines: CaptionLine[] = [
  {
    segment: {
      id: "seg-0001",
      index: 0,
      startMs: 0,
      endMs: 4860,
      text: "Take meriforming 500 milligrams.",
    },
    tokens: [
      { kind: "drug", value: "meriforming", suggestion: "metformin", lowConfidence: false },
      { kind: "number", value: "500 milligrams", lowConfidence: false },
    ],
  },
  {
    segment: {
      id: "seg-0002",
      index: 1,
      startMs: 4860,
      endMs: 12540,
      text: "Twice daily after food. Come back and see me in three months.",
    },
    tokens: [
      { kind: "frequency", value: "twice daily", lowConfidence: false },
      { kind: "frequency", value: "after food", lowConfidence: false },
      { kind: "date", value: "in 3 months", lowConfidence: false },
    ],
  },
  { segment: { id: "seg-0003", index: 2, startMs: 12540, endMs: 15600, text: "" }, tokens: [] },
];

const facts: VerifiedFact[] = [
  {
    key: "medicine",
    fields: { name: "meriforming", dose: "500 milligrams", frequency: "twice daily" },
    anchor: a("seg-0001", 0, 12540, "Take meriforming 500 milligrams. Twice daily after food."),
    stamp: "check_this",
  },
  {
    key: "follow_up",
    fields: { when: "in 3 months" },
    anchor: a("seg-0002", 4860, 12540, "Come back and see me in three months."),
    stamp: "heard_clearly",
  },
];

const checklist: ChecklistResult[] = [
  {
    item: {
      id: "q-how-to-take",
      text: "How much, how often and for how long should I take it?",
      sourceUrl: "user-planned",
    },
    stamp: "Answered",
    anchor: a("seg-0001", 0, 12540, ""),
  },
  {
    item: { id: "q-follow-up", text: "When is my next appointment?", sourceUrl: "user-planned" },
    stamp: "Unclear",
    anchor: a("seg-0002", 4860, 12540, ""),
  },
  {
    item: {
      id: "q-side-effects",
      text: "What side effects should I expect?",
      sourceUrl: "user-planned",
    },
    stamp: "Not discussed",
  },
];

const coverChecklist: ChecklistResult[] = [
  {
    item: {
      id: "q-trial-returns",
      text: "How long is the trial and what are the return terms?",
      sourceUrl:
        "https://www.choice.com.au/health-and-body/optical-and-hearing/hearing/articles/profit-hungry-hearing-clinics-put-on-notice-by-the-accc-030317",
    },
    stamp: "Answered",
    anchor: a("seg-0003", 13000, 19500, ""),
  },
  {
    item: {
      id: "q-commission",
      text: "Do staff earn commission on this sale?",
      sourceUrl:
        "https://www.abc.net.au/news/2017-03-02/consumer-watchdog-puts-hearing-aid-industry-on-notice/8319738",
    },
    stamp: "Not discussed",
  },
];

const quotes: QuoteRecord[] = [
  {
    conversationId: "cover-01",
    seller: "Seller A",
    fields: {
      price: { value: "3800 dollars, pair", anchor: a("seg-0001", 0, 6500, "") },
      trial_returns: { value: "30 days, full refund", anchor: a("seg-0003", 13000, 19500, "") },
      financing: { value: "12 percent, 3 years", anchor: a("seg-0004", 19500, 27000, "") },
    },
  },
  {
    conversationId: "cover-02",
    seller: "Seller B",
    fields: {
      price: { value: "4200 dollars, pair", anchor: a("seg-0001", 0, 6500, "") },
      trial_returns: { value: "60 days", anchor: a("seg-0003", 12000, 18500, "") },
      commission: {
        value: "Our staff do earn a commission on every sale",
        anchor: a("seg-0004", 18500, 25500, ""),
      },
    },
  },
  {
    conversationId: "cover-03",
    seller: "Seller C",
    fields: { price: { value: "$3800, pair", anchor: a("seg-0001", 0, 6500, "") } },
  },
];
const rows = compareQuotes(quotes, [
  "price",
  "inclusions",
  "trial_returns",
  "financing",
  "commission",
]);

function Variants({
  title,
  render,
}: {
  title: string;
  render: (status: ViewStatus) => ReactElement;
}): ReactElement {
  return (
    <section className="gallery-block" aria-label={title}>
      <h2 className="gallery-title">{title}</h2>
      {STATUSES.map((status) => (
        <div key={status} className="gallery-variant" data-status={status}>
          <p className="gallery-label">State: {status}</p>
          {render(status)}
        </div>
      ))}
    </section>
  );
}

function SkinGallery({ skin }: { skin: SkinName }): ReactElement {
  const [choices, setChoices] = useState<ConsentChoices>({
    record: false,
    transcribe: false,
    share: false,
  });
  const [items, setItems] = useState<ReadBackItem[]>(() => buildReadBack(facts, ["medicine"]));
  const [speaker, setSpeaker] = useState(false);
  const [card, setCard] = useState(false);
  const disclaimer = skin === "care" ? FINAL.disclaimerCare : FINAL.disclaimerCover;

  return (
    <Skin skin={skin} className="gallery-skin">
      <section aria-label={`Skin ${skin}`} data-skin-gallery={skin}>
        <h1>Skin: {skin}</h1>

        <section className="gallery-block" aria-label={`Stamps (${skin})`}>
          <h2 className="gallery-title">Stamps</h2>
          <p className="echo-chips">
            <StampBadge stamp="heard_clearly" />
            <StampBadge stamp="check_this" />
            <StampBadge stamp="not_said" />
            <ChecklistStamp stamp="Answered" />
            <ChecklistStamp stamp="Unclear" />
            <ChecklistStamp stamp="Not discussed" />
          </p>
          <h2 className="gallery-title">Anchor chip</h2>
          <p>
            <AnchorChip anchor={facts[1].anchor} onPlay={play} />
          </p>
          <p>
            <AnchorChip anchor={facts[1].anchor} />
          </p>
        </section>

        <Variants
          title={`ConsentSheet (${skin})`}
          render={(status) => (
            <ConsentSheet
              choices={choices}
              onChange={setChoices}
              onAgree={play}
              onLearnMore={play}
              disclaimer={disclaimer}
              status={status}
            />
          )}
        />
        <Variants
          title={`CaptionView (${skin})`}
          render={(status) => <CaptionView lines={lines} status={status} />}
        />
        <Variants
          title={`ReceiptList (${skin})`}
          render={(status) => (
            <ReceiptList
              facts={facts}
              fieldsByKey={{
                medicine: ["name", "dose", "frequency", "duration"],
                follow_up: ["when"],
              }}
              onPlay={play}
              status={status}
            />
          )}
        />
        <Variants
          title={`ReadBackPanel (${skin})`}
          render={(status) => (
            <ReadBackPanel
              items={items}
              onMark={(key, mark) =>
                setItems((prev) => prev.map((i) => (i.factKey === key ? { ...i, mark } : i)))
              }
              speakerFacing={speaker}
              onToggleSpeaker={setSpeaker}
              status={status}
            />
          )}
        />
        <Variants
          title={`ChecklistView (${skin})`}
          render={(status) =>
            skin === "care" ? (
              <ChecklistView results={checklist} onPlay={play} status={status} />
            ) : (
              <ChecklistView
                results={coverChecklist}
                title={FINAL.questionsBeforeYouBuy}
                showSources
                onPlay={play}
                status={status}
              />
            )
          }
        />
        <Variants
          title={`ComparisonTable (${skin})`}
          render={(status) => <ComparisonTable rows={rows} onPlay={play} status={status} />}
        />

        <section className="gallery-block" aria-label={`SpeakerCard (${skin})`}>
          <h2 className="gallery-title">SpeakerCard</h2>
          <SpeakerCard
            inline
            message={SPEAKER_CARDS.doctor}
            actions={[
              { label: FINAL.doctorCardStart, onClick: play },
              { label: FINAL.skip, onClick: play, primary: false },
            ]}
          />
          <SpeakerCard
            inline
            message={SPEAKER_CARDS.pharmacist}
            actions={[{ label: FINAL.done, onClick: play }]}
          />
          <div className="echo-actions">
            <button
              type="button"
              className="echo-button"
              data-open-card={skin}
              onClick={() => setCard(true)}
            >
              {FINAL.pleaseRepeat}
            </button>
          </div>
          {card && (
            <SpeakerCard
              message={SPEAKER_CARDS.pleaseRepeat}
              actions={[{ label: FINAL.done, onClick: () => setCard(false) }]}
            />
          )}
        </section>
      </section>
    </Skin>
  );
}

function Gallery(): ReactElement {
  return (
    <main data-ready="true">
      <SkinGallery skin="care" />
      <SkinGallery skin="cover" />
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Gallery />);
