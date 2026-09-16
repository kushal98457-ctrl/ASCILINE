import { describe, it, expect } from "vitest";
import { glyphUvRect, type AtlasLayout } from "../src/renderer/CharacterAtlas";

function fakeLayout(glyphCount: number, atlasCols: number, atlasRows: number): AtlasLayout {
  return {
    bitmap: {} as ImageBitmap,
    glyphCount,
    glyphPxWidth: 20,
    glyphPxHeight: 32,
    atlasCols,
    atlasRows,
    ramp: " ".repeat(glyphCount),
  };
}

describe("glyphUvRect", () => {
  it("maps index 0 to the top-left cell", () => {
    const layout = fakeLayout(16, 4, 4);
    const [u0, v0, u1, v1] = glyphUvRect(layout, 0);
    expect(u0).toBe(0);
    expect(v0).toBe(0);
    expect(u1).toBeCloseTo(0.25);
    expect(v1).toBeCloseTo(0.25);
  });

  it("maps the last index to the bottom-right region", () => {
    const layout = fakeLayout(16, 4, 4);
    const [u0, v0] = glyphUvRect(layout, 15);
    expect(u0).toBeCloseTo(0.75);
    expect(v0).toBeCloseTo(0.75);
  });

  it("wraps to a new row after atlasCols glyphs", () => {
    const layout = fakeLayout(10, 4, 3);
    const [u0, v0] = glyphUvRect(layout, 4); // index 4 = row 1, col 0
    expect(u0).toBeCloseTo(0);
    expect(v0).toBeCloseTo(1 / 3);
  });

  it("clamps out-of-range indices instead of producing UVs outside [0,1]", () => {
    const layout = fakeLayout(10, 4, 3);
    const [u0, v0, u1, v1] = glyphUvRect(layout, 999);
    expect(u0).toBeGreaterThanOrEqual(0);
    expect(v0).toBeGreaterThanOrEqual(0);
    expect(u1).toBeLessThanOrEqual(1);
    expect(v1).toBeLessThanOrEqual(1);

    const [negU0] = glyphUvRect(layout, -5);
    expect(negU0).toBe(0);
  });
});
