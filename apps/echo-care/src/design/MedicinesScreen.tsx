import { useId, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { StatusMessage } from "@echo/ui";
import type { ViewStatus } from "@echo/ui";
import { CARE } from "../copy";
import { addMedicine, capitaliseName, insertMedicine, removeMedicine } from "../medicines";
import type { AddMedicineError } from "../medicines";
import { CD } from "./copy";
import { CareIcon } from "./icons";
import { Shell } from "./Shell";
import { Tile } from "./parts";
import { useDesktop } from "@echo/ui";

/**
 * The user's own medicines list, kept on this device. Names only, no doses. Removing a name
 * shows an Undo bar. Every state is designed: loading, empty, list, input error, save failed.
 */
export function MedicinesScreen({
  medicines,
  status,
  onChange,
}: {
  medicines: string[];
  status: ViewStatus;
  /** Saves the new list on the device; resolves false when saving failed */
  onChange: (next: string[]) => Promise<boolean>;
}): ReactElement {
  const id = useId();
  const desktop = useDesktop();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<AddMedicineError>();
  const [saveFailed, setSaveFailed] = useState(false);
  const [removed, setRemoved] = useState<{ name: string; index: number }>();
  /** One save at a time: a second change must start from the list the first one saved. */
  const [saving, setSaving] = useState(false);

  const save = async (next: string[]): Promise<boolean> => {
    setSaving(true);
    const ok = await onChange(next);
    setSaving(false);
    setSaveFailed(!ok);
    return ok;
  };

  const add = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (saving) return;
    const result = addMedicine(medicines, capitaliseName(draft));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(undefined);
    setRemoved(undefined);
    if (await save(result.value)) setDraft("");
  };

  const remove = async (name: string): Promise<void> => {
    if (saving) return;
    const index = medicines.indexOf(name);
    if (await save(removeMedicine(medicines, name))) setRemoved({ name, index });
  };

  const undo = async (): Promise<void> => {
    if (!removed || saving) return;
    if (await save(insertMedicine(medicines, removed.name, removed.index))) setRemoved(undefined);
  };

  const ready = status === "ready";
  const savedText = desktop ? CD.medicinesSavedDesktop : CD.medicinesSavedMobile;

  return (
    <Shell active="medicines">
      <main className="cd-main cd-main--meds">
        <div className="cd-meds-left">
          <section className="cd-meds-intro">
            <h1 className="cd-title">{CD.medicinesTitle}</h1>
            <p className="cd-lead cd-lead--soft">{CD.medicinesLead}</p>
            <SavedChip text={savedText} />
          </section>

          {status !== "loading" && status !== "error" && (
            <form
              className="cd-card cd-add"
              aria-label="Add a medicine"
              onSubmit={(e) => void add(e)}
              noValidate
            >
              <label className="cd-add__label" htmlFor={`${id}-name`}>
                {CD.medicinesName}
              </label>
              <input
                id={`${id}-name`}
                className="cd-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={60}
                placeholder={desktop ? undefined : CD.medicinesPlaceholder}
                value={draft}
                aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
                aria-invalid={error !== undefined}
                onChange={(e) => setDraft(e.target.value)}
              />
              <p className="cd-add__hint" id={`${id}-hint`}>
                {CD.medicinesHint}
              </p>
              {error && (
                <p className="cd-add__error" id={`${id}-error`} role="alert">
                  {CARE.medicinesErrors[error]}
                </p>
              )}
              <button type="submit" className="cd-btn cd-btn--primary" disabled={saving}>
                <CareIcon name="plus" size={desktop ? 32 : 26} strokeWidth={2.5} />
                <span>{CD.medicinesAddLong}</span>
              </button>
            </form>
          )}
        </div>

        <section className="cd-meds-list" aria-label="Your medicines">
          <h2 className="cd-meds-list__title">
            {"Your list "}
            <span className="cd-meds-list__count">({medicines.length})</span>
          </h2>
          <p className="cd-note">{CD.medicinesNoConfirm}</p>
          {saveFailed && (
            <StatusMessage status="error" text={{ error: CARE.medicinesSaveFailed }} />
          )}
          {status === "loading" && (
            <StatusMessage status="loading" text={{ loading: CARE.medicinesLoading }} />
          )}
          {status === "error" && (
            <StatusMessage status="error" text={{ error: CARE.medicinesSaveFailed }} />
          )}
          {ready && medicines.length === 0 && (
            <p className="cd-empty">
              {desktop ? CD.medicinesEmptyDesktop : CD.medicinesEmptyMobile}
            </p>
          )}
          {removed && (
            <div className="cd-undo" role="status" aria-live="polite">
              <span>{CD.removed(removed.name)}</span>
              <button
                type="button"
                className="cd-undo__button"
                disabled={saving}
                onClick={() => void undo()}
              >
                {CD.undo}
              </button>
            </div>
          )}
          {ready && (
            <ul className="cd-meds">
              {medicines.map((name) => (
                <li key={name} className="cd-med-row">
                  <Tile icon="pill" size={desktop ? 30 : 26} />
                  <span className="cd-med-row__name">{name}</span>
                  <button
                    type="button"
                    className="cd-btn cd-btn--small"
                    aria-label={`${CD.remove} ${name}`}
                    disabled={saving}
                    onClick={() => void remove(name)}
                  >
                    {CD.remove}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="cd-spacer" />
          <a className="cd-btn cd-btn--outline" href="#/home">
            {CD.done}
          </a>
        </section>
      </main>
    </Shell>
  );
}

function SavedChip({ text }: { text: string }): ReactElement {
  return (
    <span className="cd-chip cd-chip--lock">
      <CareIcon name="lock" size={20} />
      <span>{text}</span>
    </span>
  );
}
