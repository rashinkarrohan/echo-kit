import { useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import type { SkinName } from "../tokens";
import { FINAL, ADDED } from "../copy";

/** Every component can be in one of these states (UI-SPEC: design every state). */
export type ViewStatus = "ready" | "loading" | "empty" | "error" | "permission-denied";

export function Skin({
  skin,
  children,
  className,
}: {
  skin: SkinName;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div className={className ? `echo ${className}` : "echo"} data-skin={skin}>
      {children}
    </div>
  );
}

type IconName = "check" | "alert" | "dash" | "flag" | "play" | "slow" | "mic-off" | "hourglass";

const PATHS: Record<IconName, string> = {
  check: "M4 12.5l5 5L20 6.5",
  alert: "M12 4l9 16H3L12 4zM12 10v4M12 17v.5",
  dash: "M5 12h14",
  flag: "M6 21V4M6 4h11l-2 4 2 4H6",
  play: "M8 5v14l11-7z",
  slow: "M8 5v14l11-7zM3 5v14",
  "mic-off":
    "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16",
  hourglass: "M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9",
};

/** Decorative icon; meaning always comes from the text next to it. */
export function Icon({ name }: { name: IconName }): ReactElement {
  return (
    <svg
      className="echo-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export interface StatusText {
  loading?: string;
  empty?: string;
  error?: string;
  permissionDenied?: string;
}

/**
 * Message for a non-ready state. Errors and permission problems are alerts; loading
 * and empty are polite status messages. Returns null for "ready".
 */
export function StatusMessage({
  status,
  text = {},
}: {
  status: ViewStatus;
  text?: StatusText;
}): ReactElement | null {
  if (status === "ready") return null;
  const messages: Record<
    Exclude<ViewStatus, "ready">,
    { text: string; icon: IconName; alert: boolean }
  > = {
    loading: { text: text.loading ?? ADDED.loading, icon: "hourglass", alert: false },
    empty: { text: text.empty ?? ADDED.receiptEmpty, icon: "dash", alert: false },
    error: { text: text.error ?? FINAL.genericError, icon: "alert", alert: true },
    "permission-denied": {
      text: text.permissionDenied ?? FINAL.micDenied,
      icon: "mic-off",
      alert: true,
    },
  };
  const m = messages[status];
  return (
    <div className={`echo-status echo-status--${status}`} role={m.alert ? "alert" : "status"}>
      <Icon name={m.icon} />
      <p style={{ margin: 0 }}>{m.text}</p>
    </div>
  );
}

export type FactStampName = "heard_clearly" | "check_this" | "not_said";

const FACT_STAMPS: Record<FactStampName, { word: string; icon: IconName }> = {
  heard_clearly: { word: FINAL.heardClearly, icon: "check" },
  check_this: { word: FINAL.checkThis, icon: "alert" },
  not_said: { word: FINAL.notSaid, icon: "dash" },
};

/** Heard clearly / Check this / Not said: icon and word, never colour alone. */
export function StampBadge({ stamp }: { stamp: FactStampName }): ReactElement {
  const s = FACT_STAMPS[stamp];
  return (
    <span className={`echo-stamp echo-stamp--${stamp}`}>
      <Icon name={s.icon} />
      {s.word}
    </span>
  );
}

export type ChecklistStampName = "Answered" | "Unclear" | "Not discussed";

const CHECKLIST_STAMPS: Record<ChecklistStampName, { word: string; icon: IconName; cls: string }> =
  {
    Answered: { word: FINAL.answered, icon: "check", cls: "answered" },
    Unclear: { word: FINAL.unclear, icon: "alert", cls: "unclear" },
    "Not discussed": { word: FINAL.notDiscussed, icon: "dash", cls: "not_discussed" },
  };

export function ChecklistStamp({ stamp }: { stamp: ChecklistStampName }): ReactElement {
  const s = CHECKLIST_STAMPS[stamp];
  return (
    <span className={`echo-stamp echo-stamp--${s.cls}`}>
      <Icon name={s.icon} />
      {s.word}
    </span>
  );
}

/** Move focus to an element when it mounts (dialogs, new screens). */
export function useFocusOnMount<T extends HTMLElement>(): React.RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
