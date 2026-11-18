import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { buildReadBack, compareQuotes } from "@echo/engine";
import type { Anchor, ChecklistResult, QuoteRecord, VerifiedFact } from "@echo/engine";
import {
  AnchorChip,
  CaptionView,
  ChecklistView,
  ComparisonTable,
  ConsentSheet,
  FlaggedText,
  ReadBackPanel,
  ReceiptList,
  Skin,
  SpeakerCard,
  StampBadge,
  FINAL,
  medicineNoteText,
} from "../index";

afterEach(cleanup);

const anchor = (id: string, quote = "quote"): Anchor => ({
  segmentIds: [id],
  startMs: 6000,
  endMs: 13000,
  quote,
});

const medicine: VerifiedFact = {
  key: "medicine",
  fields: { name: "metformin", dose: "500 milligrams", frequency: "twice daily" },
  anchor: anchor("seg-0002", "metformin, five hundred milligrams, twice daily"),
  stamp: "heard_clearly",
};

describe("StampBadge", () => {
  it("shows a word and a decorative icon, never colour alone", () => {
    const { container } = render(<StampBadge stamp="check_this" />);
    expect(container.textContent).toBe("Check this");
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("FlaggedText", () => {
  it("marks flagged words in the original wording and names their kind for screen readers", () => {
    render(
      <FlaggedText
        text="Take five hundred milligrams."
        tokens={[{ kind: "number", value: "500 milligrams", lowConfidence: false }]}
      />,
    );
    const mark = document.querySelector("mark");
    expect(mark?.textContent).toContain("five hundred milligrams");
    expect(mark?.textContent).toContain("flagged: number");
  });

  it("shows what a near-match drug sounds like, keeping the heard word", () => {
    const { container } = render(
      <FlaggedText
        text="Take meriforming 500 milligrams."
        tokens={[
          { kind: "drug", value: "meriforming", suggestion: "metformin", lowConfidence: false },
        ]}
      />,
    );
    expect(container.textContent).toContain("meriforming");
    expect(container.querySelector(".echo-name-hint")?.textContent).toBe("Sounds like metformin?");
  });
  it("says when a word before a dose is not a medicine name Echo knows, keeping the word", () => {
    const { container } = render(
      <FlaggedText
        text="Take paramet, 500 mg."
        tokens={[{ kind: "drug", value: "paramet", unknownName: true, lowConfidence: false }]}
      />,
    );
    expect(container.querySelector("mark")?.textContent).toContain("paramet");
    expect(container.querySelector(".echo-name-hint")?.textContent).toBe(
      "Not a medicine name Echo knows",
    );
  });
  it("names real medicines an exact name could be mixed up with", () => {
    const { container } = render(
      <FlaggedText
        text="Prednisone 40 mg."
        tokens={[
          {
            kind: "drug",
            value: "prednisone",
            soundsAlike: ["prednisolone"],
            lowConfidence: false,
          },
        ]}
      />,
    );
    expect(container.querySelector(".echo-name-hint")?.textContent).toBe(
      "Could also be prednisolone?",
    );
  });
});
describe("medicineNoteText", () => {
  it("explains each kind of medicine-name note in plain words, with no advice", () => {
    expect(medicineNoteText("meriforming", { kind: "sounds-like", name: "metformin" })).toBe(
      "Echo heard “meriforming”. It sounds like metformin. Check the name on the label or with your pharmacist.",
    );
    expect(medicineNoteText("paramet", { kind: "unknown" })).toBe(
      "Echo heard “paramet”. This is not a medicine name Echo knows. Check the name on the label or with your pharmacist.",
    );
    expect(medicineNoteText("prednisone", { kind: "could-also-be", names: ["prednisolone"] })).toBe(
      "Prednisone sounds like prednisolone. Check which one is on the label.",
    );
  });
});

describe("CaptionView", () => {
  it("always shows the uncertainty line and uses a polite live log", () => {
    render(<CaptionView lines={[]} />);
    expect(screen.getByText(FINAL.captionUncertainty)).toBeTruthy();
    expect(screen.getByRole("log").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("status").textContent).toContain("Captions will appear here");
  });

  it("permission denied is an alert with the copy-deck text", () => {
    render(<CaptionView lines={[]} status="permission-denied" />);
    expect(screen.getByRole("alert").textContent).toBe(FINAL.micDenied);
  });
});

describe("AnchorChip", () => {
  it("plays at normal and slow speed", () => {
    const onPlay = vi.fn();
    render(<AnchorChip anchor={anchor("s1")} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole("button", { name: /Hear it, 0:06 to 0:13/ }));
    fireEvent.click(screen.getByRole("button", { name: /Slower/ }));
    expect(onPlay.mock.calls.map((c) => c[1] as number)).toEqual([1, 0.7]);
  });

  it("says audio was not kept instead of showing dead buttons", () => {
    render(<AnchorChip anchor={anchor("s1")} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Audio not kept")).toBeTruthy();
  });
});

describe("ReceiptList", () => {
  it("shows values, the original quote, the stamp, and Not said for fields not heard", () => {
    render(
      <ReceiptList
        facts={[medicine]}
        fieldsByKey={{ medicine: ["name", "dose", "frequency", "duration"] }}
        onPlay={() => {}}
      />,
    );
    const row = document.querySelector(".echo-receipt-line") as HTMLElement;
    expect(row).toBeTruthy();
    expect(within(row).getByText("500 milligrams")).toBeTruthy();
    expect(within(row).getByText(/five hundred milligrams/)).toBeTruthy();
    expect(within(row).getByText("Heard clearly")).toBeTruthy();
    expect(within(row).getByText("For how long").nextElementSibling?.textContent).toBe("Not said");
    expect(row.querySelector(".echo-receipt__note")).toBeNull();
  });
  it("shows why a line needs checking, when the app gives a note", () => {
    const unsure: VerifiedFact = {
      ...medicine,
      fields: { name: "paramet", dose: "500 mg" },
      anchor: anchor("seg-0001", "Take paramet, 500 mg"),
      stamp: "check_this",
    };
    render(<ReceiptList facts={[unsure]} noteFor={(f) => `note for ${f.fields["name"]}`} />);
    const note = document.querySelector(".echo-receipt__note");
    expect(note?.textContent).toBe("note for paramet");
  });

  it("has an empty state", () => {
    render(<ReceiptList facts={[]} />);
    expect(screen.getByRole("status").textContent).toContain("No facts were heard");
  });
});

describe("ChecklistView", () => {
  const results: ChecklistResult[] = [
    {
      item: { id: "q1", text: "How often?", sourceUrl: "user-planned" },
      stamp: "Answered",
      anchor: anchor("s2"),
    },
    {
      item: { id: "q2", text: "Side effects?", sourceUrl: "user-planned" },
      stamp: "Not discussed",
    },
  ];

  it("shows Answered with a chip and Not discussed without one", () => {
    render(<ChecklistView results={results} onPlay={() => {}} />);
    const [answered, missing] = screen.getAllByRole("listitem");
    expect(within(answered).getByText("Answered")).toBeTruthy();
    expect(within(answered).getAllByRole("button")).toHaveLength(2);
    expect(within(missing).getByText("Not discussed")).toBeTruthy();
    expect(within(missing).queryByRole("button")).toBeNull();
  });

  it("never claims anyone avoided a question", () => {
    const { container } = render(<ChecklistView results={results} />);
    expect(container.textContent).not.toMatch(/avoid|refus|dodg|evad/i);
  });
});

describe("ComparisonTable", () => {
  const records: QuoteRecord[] = [
    {
      conversationId: "a",
      seller: "Seller A",
      fields: {
        price: { value: "3800 dollars", anchor: anchor("a1") },
        financing: { value: "12 percent", anchor: anchor("a2") },
      },
    },
    {
      conversationId: "b",
      seller: "Seller B",
      fields: { price: { value: "4200 dollars", anchor: anchor("b1") } },
    },
  ];
  const rows = compareQuotes(records, ["price", "financing"]);

  it("lays sellers out as columns, marks Differs and Not discussed", () => {
    render(<ComparisonTable rows={rows} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Seller A",
      "Seller B",
    ]);
    const price = screen.getByRole("rowheader", { name: /Price/ });
    expect(price.textContent).toContain("Differs");
    expect(
      screen.getByRole("rowheader", { name: /Financing/ }).closest("tr")?.textContent,
    ).toContain("Not discussed");
  });

  it("contains no ranking or recommendation wording", () => {
    const { container } = render(<ComparisonTable rows={rows} />);
    expect(container.textContent).not.toMatch(
      /best|cheapest|recommend|winner|rank|better|worse|choose/i,
    );
  });

  it("needs at least two sellers", () => {
    render(<ComparisonTable rows={compareQuotes([records[0]], ["price"])} />);
    expect(screen.getByRole("status").textContent).toContain("at least two sellers");
  });
});

describe("ReadBackPanel", () => {
  const items = buildReadBack([medicine]);

  it("reads back what was heard and changes a mark only on tap", () => {
    const onMark = vi.fn();
    render(<ReadBackPanel items={items} onMark={onMark} />);
    expect(screen.getByText("I heard: metformin, 500 milligrams, twice daily.")).toBeTruthy();
    expect(onMark).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Not right" }));
    expect(onMark).toHaveBeenCalledWith("medicine-1", "not_right");
  });

  it("speaker-facing view shows the marks as words, without the buttons", () => {
    render(
      <ReadBackPanel
        items={[{ ...items[0], mark: "right" }]}
        onMark={() => {}}
        speakerFacing
        onToggleSpeaker={() => {}}
      />,
    );
    expect(screen.getByText("Marked right")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Right" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Show the doctor" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

describe("SpeakerCard", () => {
  it("is a labelled dialog and focuses its first action", () => {
    render(
      <SpeakerCard
        message={FINAL.pleaseRepeatCard}
        actions={[{ label: "Done", onClick: () => {} }]}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: FINAL.pleaseRepeatCard });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement?.textContent).toBe("Done");
  });
});

describe("ConsentSheet", () => {
  it("starts with everything off and enables Agree only with record and transcribe", () => {
    const onChange = vi.fn();
    const onAgree = vi.fn();
    const { rerender } = render(
      <ConsentSheet
        choices={{ record: false, transcribe: false, share: false }}
        onChange={onChange}
        onAgree={onAgree}
        disclaimer={FINAL.disclaimerCare}
      />,
    );
    const agree = screen.getByRole<HTMLButtonElement>("button", { name: "I agree and continue" });
    expect(agree.disabled).toBe(true);
    fireEvent.click(screen.getByRole("switch", { name: "Record this conversation" }));
    expect(onChange).toHaveBeenCalledWith({ record: true, transcribe: false, share: false });

    rerender(
      <ConsentSheet
        choices={{ record: true, transcribe: false, share: true }}
        onChange={onChange}
        onAgree={onAgree}
        disclaimer={FINAL.disclaimerCare}
      />,
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "I agree and continue" }).disabled,
    ).toBe(true);

    rerender(
      <ConsentSheet
        choices={{ record: true, transcribe: true, share: false }}
        onChange={onChange}
        onAgree={onAgree}
        disclaimer={FINAL.disclaimerCare}
      />,
    );
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", { name: "I agree and continue" }),
    );
    expect(onAgree).toHaveBeenCalled();
  });

  it("uses the all-party consent wording", () => {
    render(
      <ConsentSheet
        choices={{ record: false, transcribe: false, share: false }}
        onChange={() => {}}
        onAgree={() => {}}
        disclaimer="d"
      />,
    );
    expect(screen.getByText(/Everyone in the conversation must agree/)).toBeTruthy();
  });
});

describe("Skin", () => {
  it("sets the skin on the root", () => {
    const { container } = render(
      <Skin skin="cover">
        <p>x</p>
      </Skin>,
    );
    expect(container.firstElementChild?.getAttribute("data-skin")).toBe("cover");
  });
});
