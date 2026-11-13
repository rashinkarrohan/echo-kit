import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONTRAST_PAIRS, SHARED, SKINS, contrastRatio } from "./tokens";

describe("contrastRatio", () => {
  it("matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#767676", "#FFFFFF")).toBeCloseTo(4.54, 1);
  });
});

describe("design tokens (docs/appendix/DESIGN-TOKENS.md)", () => {
  it.each(CONTRAST_PAIRS)("%s: %s on %s is at least %d:1", (skin, fg, bg, min) => {
    const ratio = contrastRatio(SKINS[skin][fg], SKINS[skin][bg]);
    expect(ratio).toBeGreaterThanOrEqual(min);
  });

  it("focus ring is at least 3:1 against every page and surface colour", () => {
    for (const skin of Object.values(SKINS)) {
      expect(contrastRatio(SHARED.focus, skin.bg)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(SHARED.focus, skin.surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it("styles.css uses exactly the token values", () => {
    // jsdom gives import.meta.url an http: scheme, so resolve from the package folder
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    for (const [name, skin] of Object.entries(SKINS)) {
      const block =
        css.match(new RegExp(`\\.echo\\[data-skin="${name}"\\]\\s*\\{([^}]*)\\}`))?.[1] ?? "";
      for (const [token, value] of Object.entries(skin) as Array<[string, string]>) {
        const found: string | undefined = block.match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1];
        expect(found?.trim().toUpperCase(), `${name} --${token}`).toBe(value.toUpperCase());
      }
    }
    expect(css).toContain(`--focus: ${SHARED.focus}`);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
