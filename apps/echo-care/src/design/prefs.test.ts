import { describe, expect, it } from "vitest";
import { readFlag, saveFlag } from "./prefs";

describe("yes/no preferences", () => {
  it("round-trips a flag and clears it when switched off", () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
    expect(readFlag(store, "k")).toBe(false);
    saveFlag(store, "k", true);
    expect(readFlag(store, "k")).toBe(true);
    saveFlag(store, "k", false);
    expect(readFlag(store, "k")).toBe(false);
  });

  it("is off, and does not throw, when storage is missing or blocked", () => {
    expect(readFlag(undefined, "k")).toBe(false);
    expect(() => saveFlag(undefined, "k", true)).not.toThrow();
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readFlag(blocked, "k")).toBe(false);
    expect(() => saveFlag(blocked, "k", true)).not.toThrow();
  });
});
