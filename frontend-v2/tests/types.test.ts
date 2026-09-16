import { describe, it, expect } from "vitest";
import { computeGridDimensions, resolveCharacterRamp, CHARACTER_SETS } from "../src/core/types";

describe("computeGridDimensions", () => {
  it("keeps landscape video roughly proportioned after glyph-aspect correction", () => {
    const { cols, rows } = computeGridDimensions(1920, 1080, 320);
    expect(cols).toBe(320);
    // 320 / (1920/1080) / 0.55 ≈ 327
    expect(rows).toBeGreaterThan(300);
    expect(rows).toBeLessThan(350);
  });

  it("handles portrait video without collapsing rows to 0", () => {
    const { cols, rows } = computeGridDimensions(1080, 1920, 160);
    expect(cols).toBe(160);
    expect(rows).toBeGreaterThan(cols); // portrait should have more rows than cols
  });

  it("handles square video", () => {
    const { cols, rows } = computeGridDimensions(1000, 1000, 200);
    // rows = round(200 / 1 / 0.55) = round(363.63) = 364
    expect(rows).toBe(364);
    expect(cols).toBe(200);
  });

  it("throws on invalid dimensions instead of producing NaN/0 grids", () => {
    expect(() => computeGridDimensions(0, 1080, 320)).toThrow(RangeError);
    expect(() => computeGridDimensions(1920, 0, 320)).toThrow(RangeError);
    expect(() => computeGridDimensions(1920, 1080, 0)).toThrow(RangeError);
  });

  it("never returns zero rows for extreme aspect ratios", () => {
    const { rows } = computeGridDimensions(10000, 100, 480);
    expect(rows).toBeGreaterThanOrEqual(1);
  });
});

describe("resolveCharacterRamp", () => {
  it("returns the named set's ramp", () => {
    expect(resolveCharacterRamp({ characterSet: "minimal" })).toBe(CHARACTER_SETS.minimal);
  });

  it("returns the custom ramp when characterSet is custom and one is provided", () => {
    const ramp = resolveCharacterRamp({ characterSet: "custom", customRamp: " .#@" });
    expect(ramp).toBe(" .#@");
  });

  it("falls back to classic when custom is selected but no ramp given", () => {
    const ramp = resolveCharacterRamp({ characterSet: "custom" });
    expect(ramp).toBe(CHARACTER_SETS.classic);
  });

  it("falls back to classic for an unknown key", () => {
    const ramp = resolveCharacterRamp({ characterSet: "does-not-exist" });
    expect(ramp).toBe(CHARACTER_SETS.classic);
  });
});
