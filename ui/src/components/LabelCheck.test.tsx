import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { compareLabel } from "@echo/engine";
import type { Anchor, Fact } from "@echo/engine";
import { LabelFlagList, LabelForm } from "./LabelCheck";

afterEach(cleanup);

const a = (id: string, quote: string): Anchor => ({
  segmentIds: [id],
  startMs: 6000,
  endMs: 13000,
  quote,
});
const doctor: Fact = {
  key: "medicine",
  fields: { name: "metformin", dose: "500 milligrams", frequency: "twice daily" },
  anchor: a("d", "metformin, five hundred milligrams, twice daily"),
};
const pharmacy: Fact = {
  key: "medicine",
  fields: {
    name: "metformin",
    strength: "500 milligram",
    how_to_take: "one tablet in the morning and one tablet in the evening",
  },
  anchor: a("p", "one tablet in the morning and one tablet in the evening"),
};

describe("LabelForm", () => {
  it("confirms only when all three fields are filled", () => {
    const onConfirm = vi.fn();
    render(<LabelForm onConfirm={onConfirm} />);
    const compare = screen.getByRole<HTMLButtonElement>("button", {
      name: "Compare with what was said",
    });
    expect(compare.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Medicine"), { target: { value: "Metformin" } });
    fireEvent.change(screen.getByLabelText("Dose"), { target: { value: "500 mg" } });
    fireEvent.change(screen.getByLabelText("How often"), { target: { value: "once daily" } });
    fireEvent.click(compare);
    expect(onConfirm).toHaveBeenCalledWith({
      medicine: "Metformin",
      dose: "500 mg",
      frequency: "once daily",
    });
  });

  it("offers a camera photo and says it is not kept", () => {
    render(<LabelForm onConfirm={() => {}} />);
    const input = document.querySelector('input[type="file"]');
    expect(input?.getAttribute("capture")).toBe("environment");
    expect(input?.getAttribute("accept")).toBe("image/*");
    expect(screen.getByText("The photo stays on this screen and is not kept.")).toBeTruthy();
  });
});

describe("LabelFlagList", () => {
  it("one frequency difference, with the doctor's and the pharmacist's anchors, and no verdict", () => {
    const flags = compareLabel([doctor, pharmacy], {
      medicine: "Metformin",
      dose: "500 mg",
      frequency: "once daily",
    });
    render(<LabelFlagList flags={flags} onPlay={() => {}} />);
    const cards = screen
      .getAllByRole("listitem")
      .filter((li) => li.classList.contains("echo-label-flag"));
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(card.textContent).toContain(
      "Said: twice daily. Printed: once daily. Check with your pharmacist or doctor.",
    );
    expect(within(card).getAllByRole("button", { name: /^Hear it/ })).toHaveLength(2);
    expect(card.textContent).not.toMatch(
      /\b(wrong|correct|incorrect|mistake|error|right one|should)\b/i,
    );
  });

  it("says it matches when nothing differs", () => {
    render(<LabelFlagList flags={[]} />);
    expect(screen.getByRole("status").textContent).toBe("Matches what was said");
  });
});
