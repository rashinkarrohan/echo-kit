import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadSchema, validateSchema } from "./loadSchema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Schema files integration", () => {
  it("loads and validates doctor-visit.yaml", () => {
    const path = join(__dirname, "../../..", "apps/echo-care/schemas/doctor-visit.yaml");
    const yaml = readFileSync(path, "utf-8");

    const loadResult = loadSchema(yaml);
    expect(loadResult.ok).toBe(true);

    if (loadResult.ok) {
      expect(loadResult.value.id).toBe("doctor-visit");
      expect(loadResult.value.skin).toBe("care");

      const validateResult = validateSchema(loadResult.value);
      expect(validateResult.ok).toBe(true);
    }
  });

  it("loads and validates pharmacy-counter.yaml", () => {
    const path = join(__dirname, "../../..", "apps/echo-care/schemas/pharmacy-counter.yaml");
    const yaml = readFileSync(path, "utf-8");

    const loadResult = loadSchema(yaml);
    expect(loadResult.ok).toBe(true);

    if (loadResult.ok) {
      expect(loadResult.value.id).toBe("pharmacy-counter");
      expect(loadResult.value.skin).toBe("care");

      const validateResult = validateSchema(loadResult.value);
      expect(validateResult.ok).toBe(true);
    }
  });

  it("loads and validates hearing-aid-sale.yaml", () => {
    const path = join(__dirname, "../../..", "apps/echo-cover/schemas/hearing-aid-sale.yaml");
    const yaml = readFileSync(path, "utf-8");

    const loadResult = loadSchema(yaml);
    expect(loadResult.ok).toBe(true);

    if (loadResult.ok) {
      expect(loadResult.value.id).toBe("hearing-aid-sale");
      expect(loadResult.value.skin).toBe("cover");

      const validateResult = validateSchema(loadResult.value);
      expect(validateResult.ok).toBe(true);
    }
  });
});
