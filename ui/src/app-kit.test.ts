import { describe, it, expect } from "vitest";
import { parseHash } from "./app-kit";

const routes = ["/consent", "/review", "/compare"] as const;

describe("parseHash", () => {
  it("reads a route and an optional parameter", () => {
    expect(parseHash("#/compare", routes, "/consent")).toEqual({ route: "/compare" });
    expect(parseHash("#/review/2", routes, "/consent")).toEqual({ route: "/review", param: "2" });
    expect(parseHash("#/review/Seller%20A", routes, "/consent")).toEqual({
      route: "/review",
      param: "Seller A",
    });
  });

  it("falls back for unknown or empty paths", () => {
    expect(parseHash("", routes, "/consent")).toEqual({ route: "/consent" });
    expect(parseHash("#/nope", routes, "/consent")).toEqual({ route: "/consent" });
  });
});
