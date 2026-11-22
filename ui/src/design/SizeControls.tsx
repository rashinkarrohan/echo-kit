import { useEffect, useId, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useTextSize } from "./hooks";
import { TEXT_SIZES, TEXT_SIZE_LABELS } from "./textSize";
import type { TextSize } from "./textSize";

/**
 * Segmented A / A / A control for the caption text size. `wide` is the taller desktop version.
 * Colours come from CSS variables the app sets (`--size-edge`, `--seg-edge`, `--seg-on`).
 */
export function SizeSegments({
  size,
  onChange,
  wide = false,
}: {
  size: TextSize;
  onChange: (next: TextSize) => void;
  wide?: boolean;
}): ReactElement {
  return (
    <div
      className={wide ? "echo-seg echo-seg--wide" : "echo-seg"}
      role="group"
      aria-label="Text size"
    >
      {TEXT_SIZES.map((s) => (
        <button
          key={s}
          type="button"
          className="echo-seg__button"
          aria-label={TEXT_SIZE_LABELS[s]}
          aria-pressed={size === s}
          onClick={() => onChange(s)}
        >
          A
        </button>
      ))}
    </div>
  );
}

/**
 * "Aa Text size" button that opens the three sizes. The choice is kept on this device only and
 * is read by the screens that show captions.
 */
export function TextSizeButton({
  popTitle = "Caption text size",
}: {
  popTitle?: string;
}): ReactElement {
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
    <div className="echo-size" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className="echo-size__button"
        aria-label="Change text size"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="echo-size__aa" aria-hidden="true">
          <span>A</span>
          <span>a</span>
        </span>
        <span className="echo-size__label">Text size</span>
      </button>
      {open && (
        <div className="echo-size__pop" id={popId}>
          <span className="echo-size__pop-title">{popTitle}</span>
          <SizeSegments size={size} onChange={setSize} />
        </div>
      )}
    </div>
  );
}
