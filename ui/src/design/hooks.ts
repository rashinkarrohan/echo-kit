import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { isModelReady, markModelReady } from "../platform/model-ready";
import { prepareSpeechModel, speechModelName } from "../platform/whisper";
import { readTextSize, saveTextSize } from "./textSize";
import type { TextSize } from "./textSize";

/** Width at which the desktop boards (1280 px) replace the mobile boards (390 px). */
export const DESKTOP_QUERY = "(min-width: 960px)";

const canMatch = (): boolean => typeof window.matchMedia === "function";

function subscribeMedia(onChange: () => void): () => void {
  if (!canMatch()) return () => {};
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True on a wide screen. Markup that differs between the boards is rendered per layout. */
export function useDesktop(): boolean {
  return useSyncExternalStore(
    subscribeMedia,
    () => canMatch() && window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

/** `window.localStorage` itself can throw when storage is blocked. */
function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

let current: TextSize | undefined;
const listeners = new Set<() => void>();

function snapshot(): TextSize {
  current ??= readTextSize(storage());
  return current;
}

/** The caption text size, shared by every screen that offers the control. */
export function useTextSize(): [TextSize, (next: TextSize) => void] {
  const size = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    snapshot,
    (): TextSize => "medium",
  );
  const set = useCallback((next: TextSize) => {
    current = next;
    saveTextSize(storage(), next);
    for (const listener of listeners) listener();
  }, []);
  return [size, set];
}

export interface ModelPrep {
  status: "idle" | "working" | "ready" | "error";
  loadedBytes: number;
  totalBytes: number;
  error?: string;
}

/** State for the "Get ready" card: download the speech model ahead of the first visit. */
export function useModelPrep(): { prep: ModelPrep; start: () => void } {
  const [prep, setPrep] = useState<ModelPrep>(() => ({
    status: isModelReady(speechModelName()) ? "ready" : "idle",
    loadedBytes: 0,
    totalBytes: 0,
  }));
  const running = useRef(false);
  const start = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setPrep({ status: "working", loadedBytes: 0, totalBytes: 0 });
    void prepareSpeechModel((loadedBytes, totalBytes) =>
      setPrep((p) => ({ ...p, status: "working", loadedBytes, totalBytes })),
    ).then((result) => {
      running.current = false;
      if (result.ok) {
        markModelReady(speechModelName());
        setPrep({ status: "ready", loadedBytes: 0, totalBytes: 0 });
      } else {
        setPrep({ status: "error", loadedBytes: 0, totalBytes: 0, error: result.error });
      }
    });
  }, []);
  return { prep, start };
}
