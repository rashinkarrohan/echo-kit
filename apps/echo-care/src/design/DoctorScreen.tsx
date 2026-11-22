import { useState } from "react";
import type { ReactElement } from "react";
import type { Stage } from "../env";
import { CD } from "./copy";
import { CareIcon } from "./icons";
import { Shell } from "./Shell";
import { BackLink, Chip, StepBar, ToggleRow } from "./parts";
import { useDesktop } from "./hooks";
import { readInterpreter, saveInterpreter } from "./prefs";

/**
 * Step 1 of 2: the card to hand to the doctor (or pharmacist). Large words, nothing to hear.
 * "They said yes" goes on to the microphone step; "They said no" goes back home.
 */
export function DoctorScreen({ stage, onYes }: { stage: Stage; onYes: () => void }): ReactElement {
  const desktop = useDesktop();
  const [interpreter, setInterpreter] = useState(readInterpreter);
  const doctor = stage === "doctor";
  const device = desktop ? "screen" : "phone";

  const toggle = (
    <ToggleRow
      icon="hand"
      label={CD.interpreter}
      checked={interpreter}
      wide={desktop}
      onChange={(next) => {
        setInterpreter(next);
        saveInterpreter(next);
      }}
    />
  );

  return (
    <Shell bottomNav={false}>
      <main className="cd-main cd-main--doctor">
        {!desktop && (
          <div className="cd-row cd-row--between">
            <BackLink href="#/home" ariaLabel="Back to home" />
            <StepBar step={1} />
          </div>
        )}
        {!desktop && <p className="cd-eyebrow">{doctor ? CD.handPhone : CD.handPhonePharmacy}</p>}
        <section className="cd-msg" aria-label={doctor ? CD.messageFor : CD.messageForPharmacist}>
          <div className="cd-msg__head">
            <span className="cd-msg__icon" aria-hidden="true">
              <CareIcon name="ear" size={desktop ? 34 : 28} />
            </span>
            <span>{doctor ? CD.messageFor : CD.messageForPharmacist}</span>
          </div>
          <h1 className="cd-msg__big">{CD.deafLine}</h1>
          <p className="cd-msg__body">
            {doctor ? CD.doctorBody(device) : CD.pharmacistBody(device)}
          </p>
          <div className="cd-msg__chips">
            {!desktop && (
              <Chip tone="yellow" icon="check">
                {CD.faceMe}
              </Chip>
            )}
            <Chip tone="yellow" icon="check">
              {CD.speakSlowly}
            </Chip>
          </div>
        </section>
        <div className="cd-doctor-side">
          {desktop && (
            <>
              <StepBar step={1} />
              <h2 className="cd-doctor-side__title">
                {doctor ? CD.desktopDoctorTitle : CD.desktopPharmacistTitle}
              </h2>
            </>
          )}
          <button type="button" className="cd-btn cd-btn--primary" onClick={onYes}>
            <CareIcon name="check" size={desktop ? 30 : 28} strokeWidth={2.5} />
            <span>{CD.theySaidYes}</span>
          </button>
          <a className="cd-btn cd-btn--outline" href="#/home">
            {CD.theySaidNo}
          </a>
          {!desktop && <div className="cd-spacer" />}
          {toggle}
        </div>
      </main>
    </Shell>
  );
}
