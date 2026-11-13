/** Echo Care routes, on the shared hash router in @echo/ui. */

import { goTo, useHashRoute } from "@echo/ui";

export type Route =
  | "/consent"
  | "/doctor-card"
  | "/pharmacy"
  | "/record"
  | "/read-back"
  | "/receipt"
  | "/label"
  | "/share";

const ROUTES: readonly Route[] = [
  "/consent",
  "/doctor-card",
  "/pharmacy",
  "/record",
  "/read-back",
  "/receipt",
  "/label",
  "/share",
];

export function go(route: Route): void {
  goTo(route);
}

export function useRoute(): Route {
  return useHashRoute(ROUTES, "/consent").route;
}
