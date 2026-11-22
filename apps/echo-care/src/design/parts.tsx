import { useEffect, useId, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { CareIcon } from "./icons";
import type { IconName } from "./icons";
import { Logo } from "./Brand";
import { TEXT_SIZES, TEXT_SIZE_LABELS } from "./textSize";
import type { TextSize } from "./textSize";
import { useTextSize } from "./hooks";

/** Back pill (design pack: chevron and the word "Back", 52 px high). */
export function BackLink({
  href,
  label = "Back",
  ariaLabel,
}: {
  href: string;
  label?: string;
  ariaLabel?: string;
}): ReactElement {
  return (
    <a
      className="cd-btn cd-btn--back cd-back"
      href={href}
      {...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {})}
    >
      <CareIcon name="chevronLeft" strokeWidth={2.5} />
      <span>{label}</span>
    </a>
  );
}

/** "Step 1 of 2" with the two-segment bar. */
export function StepBar({ step, of = 2 }: { step: number; of?: number }): ReactElement {
  return (
    <div className="cd-stepbar">
      <span>{`Step ${step} of ${of}`}</span>
      <span className="cd-stepbar__segs" aria-hidden="true">
        {Array.from({ length: of }, (_, i) => (
          <span key={i} className="cd-stepbar__seg" data-done={i < step} />
        ))}
      </span>
    </div>
  );
}

/** Light tile holding a teal icon. */
export function Tile({ icon, size = 30 }: { icon: IconName; size?: number }): ReactElement {
  return (
    <span className="cd-tile" aria-hidden="true">
      <CareIcon name={icon} size={size} />
    </span>
  );
}

export function Chip({
  tone = "teal",
  icon,
  children,
}: {
  tone?: "teal" | "check" | "none" | "plain" | "yellow";
  icon?: IconName;
  children: ReactNode;
}): ReactElement {
  const cls = tone === "teal" ? "cd-chip" : `cd-chip cd-chip--${tone}`;
  return (
    <span className={cls}>
      {icon && <CareIcon name={icon} size={18} strokeWidth={3} />}
      {children}
    </span>
  );
}

/** Switch (60 by 34) inside a card with an icon tile and a label. */
export function ToggleRow({
  icon,
  label,
  checked,
  onChange,
  description,
  wide = false,
}: {
  icon: IconName;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  description?: string;
  wide?: boolean;
}): ReactElement {
  const id = useId();
  return (
    <label className={wide ? "cd-toggle cd-toggle--wide" : "cd-toggle"} htmlFor={id}>
      <span className="cd-tile" aria-hidden="true">
        <CareIcon name={icon} size={24} />
      </span>
      <span className="cd-toggle__text">
        {label}
        {description && <span className="cd-consent__why"> {description}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        className="cd-sw"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/** Segmented A / A / A control for the caption text size. */
export function SizeSegments({
  size,
  onChange,
  desktop,
}: {
  size: TextSize;
  onChange: (next: TextSize) => void;
  desktop: boolean;
}): ReactElement {
  return (
    <div
      className="cd-seg"
      role="group"
      aria-label="Text size"
      style={desktop ? { padding: 5, borderRadius: 26 } : undefined}
    >
      {TEXT_SIZES.map((s) => (
        <button
          key={s}
          type="button"
          className="cd-seg__button"
          aria-label={TEXT_SIZE_LABELS[s]}
          aria-pressed={size === s}
          style={desktop ? { height: 64, borderRadius: 20 } : undefined}
          onClick={() => onChange(s)}
        >
          A
        </button>
      ))}
    </div>
  );
}

/** "Aa Text size" button; opens the three sizes. The choice is kept on this device. */
export function TextSizeButton(): ReactElement {
  const [size, setSize] = useTextSize();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const onDown = (e: MouseEvent | TouchEvent): void => {
      if (wrap.current && e.target instanceof Node && !wrap.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  return (
    <div className="cd-size" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className="cd-size__button"
        aria-label="Change text size"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cd-size__aa" aria-hidden="true">
          <span>A</span>
          <span>a</span>
        </span>
        <span className="cd-size__label">Text size</span>
      </button>
      {open && (
        <div className="cd-size__pop" id={popId}>
          <span className="cd-size__pop-title">Caption text size</span>
          <SizeSegments
            size={size}
            desktop={false}
            onChange={(next) => {
              setSize(next);
            }}
          />
        </div>
      )}
    </div>
  );
}

export { Logo };
