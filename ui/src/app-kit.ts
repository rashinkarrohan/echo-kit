/**
 * Small pieces both apps need (shared here so no code is copied between apps):
 * hash routing, on-device storage and consent, and the recording-state hook.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ConsentLedger, MemoryStore } from "@echo/engine";
import type { EchoStore } from "@echo/engine";
import { IdbStore } from "./platform/idb-store";
import type { RecordingController, RecordingSnapshot } from "./platform/recording";

export interface HashLocation<R extends string> {
  route: R;
  /** Rest of the path, e.g. "2" in "#/review/2" */
  param?: string;
}

/** Parse "#/review/2" against known routes; unknown paths fall back. */
export function parseHash<R extends string>(
  hash: string,
  routes: readonly R[],
  fallback: R,
): HashLocation<R> {
  const path = hash.replace(/^#/, "");
  const [, first = "", ...rest] = path.split("/");
  const route = `/${first}` as R;
  if (!routes.includes(route)) return { route: fallback };
  const param = rest.join("/");
  return param ? { route, param: decodeURIComponent(param) } : { route };
}

export function goTo(route: string, param?: string): void {
  window.location.hash = param === undefined ? route : `${route}/${encodeURIComponent(param)}`;
}

/** Hash routes work on any static host with no server rules. */
export function useHashRoute<R extends string>(routes: readonly R[], fallback: R): HashLocation<R> {
  const [loc, setLoc] = useState(() => parseHash(window.location.hash, routes, fallback));
  useEffect(() => {
    const onChange = (): void => setLoc(parseHash(window.location.hash, routes, fallback));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, [routes, fallback]);
  return loc;
}

export interface DeviceServices {
  store: EchoStore;
  ledger: ConsentLedger;
  /** false when IndexedDB is unavailable and data only lives until the page closes */
  persistent: boolean;
}

/** Open on-device storage and restore the consent ledger. Never touches the network. */
export async function openDeviceServices(dbName: string): Promise<DeviceServices> {
  const opened = await IdbStore.open(dbName);
  const store: EchoStore = opened.ok ? opened.value : new MemoryStore();
  const records = await store.getConsentRecords();
  const ledger = ConsentLedger.fromRecords(records.ok ? records.value : [], { store });
  return { store, ledger, persistent: opened.ok };
}

export function useDeviceServices(dbName: string, sample = false): DeviceServices | undefined {
  const [services, setServices] = useState<DeviceServices | undefined>(() =>
    sample ? sampleServices() : undefined,
  );
  useEffect(() => {
    if (!sample) void openDeviceServices(dbName).then(setServices);
  }, [dbName, sample]);
  return services;
}

export function useRecording(
  controller: RecordingController | undefined,
): RecordingSnapshot | undefined {
  return useSyncExternalStore(
    useCallback((cb: () => void) => controller?.subscribe(cb) ?? (() => {}), [controller]),
    () => controller?.state,
  );
}

/**
 * Services for the sample consult: in memory only, nothing kept after the page closes.
 * No microphone is used and the consult is scripted (actors), so the session's consent
 * gate is satisfied with a record that says exactly that.
 */
export const SAMPLE_WORDING_VERSION = "sample-scripted-actors-no-microphone";

export function sampleServices(): DeviceServices {
  const store = new MemoryStore();
  const ledger = new ConsentLedger({ store });
  ledger.grant("record", SAMPLE_WORDING_VERSION);
  ledger.grant("transcribe", SAMPLE_WORDING_VERSION);
  return { store, ledger, persistent: false };
}
