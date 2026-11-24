import { describe, it, expect } from "vitest";
import { DEFAULT_WHISPER_MODEL } from "@echo/engine";
import {
  WHISPER_MODELS,
  dtypeFor,
  isMultilingual,
  devicesFor,
  modelFromQuery,
  usesMedicinePrompt,
} from "./whisper-models";

describe("modelFromQuery", () => {
  it("maps the short names, including turbo", () => {
    expect(modelFromQuery("?model=tiny")).toBe("Xenova/whisper-tiny.en");
    expect(modelFromQuery("?model=small")).toBe("Xenova/whisper-small.en");
    expect(modelFromQuery("?model=turbo")).toBe("onnx-community/whisper-large-v3-turbo");
  });

  it("falls back to the default for missing or unknown names", () => {
    expect(modelFromQuery("")).toBe(DEFAULT_WHISPER_MODEL);
    expect(modelFromQuery("?model=giant")).toBe(DEFAULT_WHISPER_MODEL);
    expect(modelFromQuery("?model=toString")).toBe(DEFAULT_WHISPER_MODEL);
  });
});

describe("isMultilingual", () => {
  it("is false for English-only models and true for turbo", () => {
    expect(isMultilingual(WHISPER_MODELS.base)).toBe(false);
    expect(isMultilingual(WHISPER_MODELS.turbo)).toBe(true);
  });
});

describe("usesMedicinePrompt", () => {
  it("prompts the small models but not turbo, which echoes the prompt on real speech", () => {
    expect(usesMedicinePrompt(WHISPER_MODELS.base)).toBe(true);
    expect(usesMedicinePrompt(WHISPER_MODELS.small)).toBe(true);
    expect(usesMedicinePrompt(WHISPER_MODELS.turbo)).toBe(false);
  });
});

describe("dtypeFor", () => {
  it("uses 8-bit weights for large models (4-bit misheard the actor clip)", () => {
    expect(dtypeFor(WHISPER_MODELS.turbo, "wasm")).toBe("q8");
    expect(dtypeFor(WHISPER_MODELS.turbo, "webgpu")).toBe("q8");
  });

  it("keeps the measured precision for small models", () => {
    expect(dtypeFor(WHISPER_MODELS.base, "wasm")).toBe("q8");
    expect(dtypeFor(WHISPER_MODELS.base, "webgpu")).toEqual({
      encoder_model: "fp32",
      decoder_model_merged: "q4",
    });
  });
});

describe("devicesFor", () => {
  const ANDROID =
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36";
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
  const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
  const LAPTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0";
  it("uses WebAssembly only on phones and tablets: WebGPU there is not measured", () => {
    expect(devicesFor("", ANDROID, 5)).toEqual(["wasm"]);
    expect(devicesFor("", IPHONE, 5)).toEqual(["wasm"]);
    expect(devicesFor("", IPAD_AS_MAC, 5)).toEqual(["wasm"]); // iPadOS says it is a Mac
  });
  it("tries WebGPU first on a laptop, then WebAssembly", () => {
    expect(devicesFor("", LAPTOP, 0)).toEqual(["webgpu", "wasm"]);
  });
  it("lets ?device= choose, for testing", () => {
    expect(devicesFor("?device=webgpu", ANDROID, 5)).toEqual(["webgpu", "wasm"]);
    expect(devicesFor("?device=wasm", LAPTOP, 0)).toEqual(["wasm"]);
    expect(devicesFor("?device=nonsense", ANDROID, 5)).toEqual(["wasm"]);
  });
});
