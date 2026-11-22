import { useId } from "react";
import type { ReactElement, ReactNode } from "react";
import { CareIcon } from "./icons";
import type { IconName } from "./icons";
import { Logo } from "./Brand";

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

export { Logo };
