import { describe, it, expect } from "vitest";
import { isModelReady, markModelReady } from "./model-ready";

function fakeStorage(): Pick<Storage, "getItem" | "setItem"> {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe("model ready flag", () => {
  it("is false until the model is marked, and is kept per model", () => {
    const s = fakeStorage();
    expect(isModelReady("a", s)).toBe(false);
    markModelReady("a", s);
    expect(isModelReady("a", s)).toBe(true);
    expect(isModelReady("b", s)).toBe(false);
  });

  it("never throws when storage is blocked or missing", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(isModelReady("a", blocked)).toBe(false);
    expect(() => markModelReady("a", blocked)).not.toThrow();
    expect(isModelReady("a", undefined)).toBe(false);
    expect(() => markModelReady("a", undefined)).not.toThrow();
  });
});
