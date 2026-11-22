/** Echo Care routes, on the shared hash router in @echo/ui. */

import { goTo, useHashRoute } from "@echo/ui";

export type Route =
  | "/home"
  | "/visits"
  | "/consent"
  | "/medicines"
  | "/doctor-card"
  | "/pharmacy"
  | "/record"
  | "/repeat"
  | "/ask"
  | "/questions"
  | "/read-back"
  | "/receipt"
  | "/label"
  | "/share"
  | "/trust";

const ROUTES: readonly Route[] = [
  "/home",
  "/visits",
  "/consent",
  "/medicines",
  "/doctor-card",
  "/pharmacy",
  "/record",
  "/repeat",
  "/ask",
  "/questions",
  "/read-back",
  "/receipt",
  "/label",
  "/share",
  "/trust",
];

export function go(route: Route): void {
  goTo(route);
}

export function useRoute(): Route {
  return useHashRoute(ROUTES, "/home").route;
}
