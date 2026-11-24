import { describe, it, expect } from "vitest";
import { DownloadProgress } from "./download-progress";

describe("DownloadProgress", () => {
  it("adds up loaded and total bytes over all files", () => {
    const p = new DownloadProgress();
    p.update({ status: "progress", file: "a.onnx", loaded: 10, total: 100 });
    p.update({ status: "progress", file: "b.onnx", loaded: 5, total: 50 });
    expect(p.totals()).toEqual({ loaded: 15, total: 150 });
    p.update({ status: "progress", file: "a.onnx", loaded: 60, total: 100 });
    expect(p.totals()).toEqual({ loaded: 65, total: 150 });
  });
  it("counts a finished file as fully loaded", () => {
    const p = new DownloadProgress();
    p.update({ status: "progress", file: "a", loaded: 10, total: 100 });
    p.update({ status: "done", file: "a" });
    expect(p.totals()).toEqual({ loaded: 100, total: 100 });
  });
  it("ignores events with no file or no numbers", () => {
    const p = new DownloadProgress();
    p.update({ status: "initiate", file: "a" });
    p.update({ status: "progress", loaded: 1, total: 2 });
    p.update({ status: "progress", file: "a", loaded: Number.NaN, total: 5 });
    expect(p.totals()).toEqual({ loaded: 0, total: 0 });
  });
  it("never reports more loaded than total", () => {
    const p = new DownloadProgress();
    p.update({ status: "progress", file: "a", loaded: 120, total: 100 });
    expect(p.totals()).toEqual({ loaded: 100, total: 100 });
  });
});
