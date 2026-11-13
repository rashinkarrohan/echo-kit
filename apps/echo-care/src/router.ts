/**
 * Hash routes ("#/record"), so the app works on any static host with no server rules.
 */

import { useEffect, useState } from "react";

export type Route =
  | "/consent"
  | "/doctor-card"
  | "/pharmacy"
  | "/record"
  | "/read-back"
  | "/receipt"
  | "/label"
  | "/share";
const ROUTES: Route[] = [
  "/consent",
  "/doctor-card",
  "/pharmacy",
  "/record",
  "/read-back",
  "/receipt",
  "/label",
  "/share",
];

export function currentRoute(hash: string): Route {
  const path = hash.replace(/^#/, "") as Route;
  return ROUTES.includes(path) ? path : "/consent";
}

export function go(route: Route): void {
  window.location.hash = route;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => currentRoute(window.location.hash));
  useEffect(() => {
    const onChange = (): void => setRoute(currentRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
