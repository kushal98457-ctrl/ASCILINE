import { describe, it, expect } from "vitest";
import { stepDownQuality, stepUpQuality } from "../src/core/performance";
import { DEFAULT_QUALITY } from "../src/core/types";

describe("stepDownQuality", () => {
  it("reduces resolution first when above the minimum column step", () => {
    const result = stepDownQuality({ ...DEFAULT_QUALITY, columns: 320 });
    expect(result).not.toBeNull();
    expect(result!.columns).toBe(280);
  });

  it("disables edge detection once resolution is already at the floor", () => {
    const atFloor = { ...DEFAULT_QUALITY, columns: 160, edgeDetection: "high" as const };
    const result = stepDownQuality(atFloor);
    expect(result).not.toBeNull();
    expect(result!.columns).toBe(160); // unchanged
    expect(result!.edgeDetection).toBe("off");
  });

  it("disables dithering after resolution and edge detection are exhausted", () => {
    const settings = {
      ...DEFAULT_QUALITY,
      columns: 160,
      edgeDetection: "off" as const,
      dithering: true,
    };
    const result = stepDownQuality(settings);
    expect(result!.dithering).toBe(false);
  });

  it("reduces temporal stabilization last, one level at a time", () => {
    const settings = {
      ...DEFAULT_QUALITY,
      columns: 160,
      edgeDetection: "off" as const,
      dithering: false,
      temporalStabilization: "high" as const,
    };
    const step1 = stepDownQuality(settings);
    expect(step1!.temporalStabilization).toBe("medium");

    const step2 = stepDownQuality(step1!);
    expect(step2!.temporalStabilization).toBe("low");

    const step3 = stepDownQuality(step2!);
    expect(step3!.temporalStabilization).toBe("off");
  });

  it("returns null once every quality lever is already at minimum", () => {
    const minimal = {
      ...DEFAULT_QUALITY,
      columns: 160,
      edgeDetection: "off" as const,
      dithering: false,
      temporalStabilization: "off" as const,
    };
    expect(stepDownQuality(minimal)).toBeNull();
  });
});

describe("stepUpQuality", () => {
  it("increases resolution by one step", () => {
    const result = stepUpQuality({ ...DEFAULT_QUALITY, columns: 240 });
    expect(result!.columns).toBe(280);
  });

  it("does not increase past the maximum column step", () => {
    const result = stepUpQuality({ ...DEFAULT_QUALITY, columns: 480 });
    expect(result).toBeNull();
  });

  it("never re-enables previously disabled effects", () => {
    const settings = { ...DEFAULT_QUALITY, columns: 240, edgeDetection: "off" as const, dithering: false };
    const result = stepUpQuality(settings);
    expect(result!.edgeDetection).toBe("off");
    expect(result!.dithering).toBe(false);
  });
});
