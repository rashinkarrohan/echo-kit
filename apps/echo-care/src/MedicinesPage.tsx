import { useId, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { StatusMessage } from "@echo/ui";
import type { ViewStatus } from "@echo/ui";
import { CARE } from "./copy";
import { addMedicine, removeMedicine } from "./medicines";
import type { AddMedicineError } from "./medicines";

/**
 * The user's own medicines list (optional). Names only; kept on this phone; used to help
 * Echo hear these names. Every state is designed: loading, empty, list, input error,
 * save failed, deleted.
 */
export function MedicinesPage({
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
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<AddMedicineError>();
  const [saveFailed, setSaveFailed] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const save = async (next: string[]): Promise<boolean> => {
    const saved = await onChange(next);
    setSaveFailed(!saved);
    return saved;
  };

  const add = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const result = addMedicine(medicines, draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(undefined);
    setCleared(false);
    if (await save(result.value)) setDraft("");
  };

  const shown: ViewStatus = status === "ready" && medicines.length === 0 ? "empty" : status;

  return (
    <section className="care-medicines" aria-labelledby={`${id}-title`}>
      <p className="care-startup__step">{CARE.medicinesStep}</p>
      <h1 id={`${id}-title`}>{CARE.medicinesTitle}</h1>
      <p>{CARE.medicinesIntro}</p>
      <p>{CARE.medicinesNoConfirm}</p>
      <p className="care-medicines__privacy">{CARE.medicinesPrivacy}</p>

      {status !== "loading" && status !== "error" && (
        <form className="echo-card care-medicines__form" onSubmit={(e) => void add(e)} noValidate>
          <div className="echo-field">
            <label htmlFor={`${id}-name`}>{CARE.medicinesLabel}</label>
            <p id={`${id}-hint`} className="care-medicines__hint">
              {CARE.medicinesHint}
            </p>
            <input
              id={`${id}-name`}
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={60}
              value={draft}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
              aria-invalid={error !== undefined}
              onChange={(e) => setDraft(e.target.value)}
            />
            {error && (
              <p id={`${id}-error`} className="care-medicines__error" role="alert">
                {CARE.medicinesErrors[error]}
              </p>
            )}
          </div>
          <div className="echo-actions">
            <button type="submit" className="echo-button">
              {CARE.medicinesAdd}
            </button>
          </div>
        </form>
      )}

      {saveFailed && <StatusMessage status="error" text={{ error: CARE.medicinesSaveFailed }} />}
      {cleared && medicines.length === 0 && <p role="status">{CARE.medicinesCleared}</p>}

      <h2>{CARE.medicinesListLabel}</h2>
      <StatusMessage
        status={shown}
        text={{
          loading: CARE.medicinesLoading,
          empty: CARE.medicinesEmpty,
          error: CARE.medicinesSaveFailed,
        }}
      />
      {shown === "ready" && (
        <ul className="care-medicines__list">
          {medicines.map((name) => (
            <li key={name} className="care-medicines__item">
              <span>{name}</span>
              <button
                type="button"
                className="echo-button echo-button--secondary echo-button--small"
                aria-label={CARE.medicinesRemove(name)}
                onClick={() => void save(removeMedicine(medicines, name))}
              >
                {CARE.medicinesRemoveShort}
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirmClear && shown === "ready" ? (
        <div
          className="echo-card care-delete__confirm"
          role="group"
          aria-labelledby={`${id}-clear`}
        >
          <h2 id={`${id}-clear`}>{CARE.medicinesClearConfirm}</h2>
          <div className="echo-actions">
            <button
              type="button"
              className="echo-button"
              onClick={() =>
                void save([]).then((ok) => {
                  setConfirmClear(false);
                  if (ok) setCleared(true);
                })
              }
            >
              {CARE.medicinesClearYes}
            </button>
            <button
              type="button"
              className="echo-button echo-button--secondary"
              onClick={() => setConfirmClear(false)}
            >
              {CARE.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="echo-actions">
          <a className="echo-button" href="#/consent">
            {CARE.medicinesDone}
          </a>
          {shown === "ready" && (
            <button
              type="button"
              className="echo-button echo-button--secondary"
              onClick={() => setConfirmClear(true)}
            >
              {CARE.medicinesClear}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
