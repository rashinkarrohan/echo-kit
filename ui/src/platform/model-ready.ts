/**
 * Remembers, in this browser only, that the speech model was downloaded on purpose
 * ("Get ready"), so Home can say so. It is a hint, not proof: if the browser clears its
 * cache the model downloads again on the first visit. Storage can throw (blocked, private
 * window), so every access is guarded.
 */

const KEY = "echo-model-ready";

function store(): Pick<Storage, "getItem" | "setItem"> | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** True when this model was downloaded through "Get ready" on this browser. */
export function isModelReady(
  model: string,
  storage: Pick<Storage, "getItem"> | undefined = store(),
): boolean {
  try {
    return storage?.getItem(`${KEY}:${model}`) === "1";
  } catch {
    return false;
  }
}

export function markModelReady(
  model: string,
  storage: Pick<Storage, "setItem"> | undefined = store(),
): void {
  try {
    storage?.setItem(`${KEY}:${model}`, "1");
  } catch {
    // Storage blocked: Home just keeps offering the download.
  }
}
