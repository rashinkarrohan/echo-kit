import type { ReactElement } from "react";
import { CV } from "./copy";
import { CoverIcon } from "./icons";
import { Shell } from "./Shell";
import { BackLink, Chip } from "./parts";

/**
 * The "please confirm in writing" message. Echo drafts it from what the seller was heard to say and
 * the questions nobody answered; it never sends anything. Copy it, or hand it to your own email or
 * messages app.
 */
export function ConfirmScreen({
  seller,
  message,
  sellers,
  number,
  sample,
  copied,
  copyFailed,
  onCopy,
  onShare,
}: {
  seller: string;
  message: string;
  sellers: ReadonlyArray<{ name: string; number: number }>;
  number: number;
  sample: boolean;
  copied: boolean;
  copyFailed: boolean;
  onCopy: () => void;
  onShare: () => void;
}): ReactElement {
  return (
    <Shell>
      <main className="cv-main cv-main--flow">
        <BackLink href={`#/review/${number}`} ariaLabel={`Back to ${seller} receipt`} />
        <h1 className="cv-title">{CV.confirmTitle}</h1>
        <p className="cv-lead">{CV.confirmLead(seller)}</p>
        {sample && <Chip tone="sample">{CV.sampleChip}</Chip>}
        {sellers.length >= 2 && (
          <nav className="cv-receipts" aria-label={CV.messageFor}>
            <span className="cv-receipts__label">{CV.messageFor}</span>
            {sellers.map((s) => (
              <a
                key={s.number}
                className="cv-btn cv-btn--source"
                href={`#/confirm/${s.number}`}
                {...(s.number === number ? { "aria-current": "page" as const } : {})}
              >
                {s.name}
              </a>
            ))}
          </nav>
        )}
        <section className="cv-card" aria-label="Draft message">
          <span className="cv-card__kicker">{CV.messageTo(seller)}</span>
          <pre className="cv-message" tabIndex={0} aria-label={CV.messageTo(seller)}>
            {message}
          </pre>
          <button type="button" className="cv-btn cv-btn--primary" onClick={onCopy}>
            <CoverIcon name="copyDuotone" size={30} />
            <span>{copied ? CV.copiedLabel : CV.copyMessage}</span>
          </button>
          <button type="button" className="cv-btn cv-btn--outline" onClick={onShare}>
            <CoverIcon name="exportDuotone" size={26} />
            <span>{CV.shareMessage}</span>
          </button>
        </section>
        <p className="cv-copied" role="status">
          {copied ? CV.copiedStatus : copyFailed ? CV.copyFailed : ""}
        </p>
        <p className="cv-note">{CV.notSent}</p>
        <p className="cv-note">{CV.disclaimer}</p>
      </main>
    </Shell>
  );
}
