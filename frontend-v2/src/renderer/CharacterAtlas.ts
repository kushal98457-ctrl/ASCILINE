// Builds a GPU-uploadable texture atlas of glyphs, ordered dark -> bright.
// Both the WebGPU and WebGL2 backends consume the same ImageBitmap so the
// atlas-generation logic (and its visual output) never diverges between
// renderers — this is the one piece that's legitimately fine to do on the
// CPU/Canvas2D, since it happens once per character-set change, not per frame.

export interface AtlasLayout {
  bitmap: ImageBitmap;
  glyphCount: number;
  glyphPxWidth: number;
  glyphPxHeight: number;
  atlasCols: number; // glyphs per row in the atlas texture
  atlasRows: number;
  ramp: string; // dark -> bright, index i lives at atlas cell i
}

export interface AtlasOptions {
  fontFamily?: string;
  glyphPxHeight?: number; // rasterization resolution per glyph (not on-screen size)
  weight?: string;
}

/**
 * Rasterizes a character ramp into a single atlas texture.
 * Glyph i occupies atlas cell (i % atlasCols, floor(i / atlasCols)).
 * Glyphs are drawn as white-on-transparent so the renderer can tint them
 * with the sampled video color (masking, not per-glyph color baking).
 */
export async function buildCharacterAtlas(
  ramp: string,
  opts: AtlasOptions = {},
): Promise<AtlasLayout> {
  if (ramp.length === 0) {
    throw new RangeError("buildCharacterAtlas: ramp must contain at least one character");
  }

  const glyphPxHeight = opts.glyphPxHeight ?? 32;
  const glyphPxWidth = Math.round(glyphPxHeight * 0.6); // monospace-ish cell
  const fontFamily = opts.fontFamily ?? "'Courier New', monospace";
  const weight = opts.weight ?? "bold";

  const glyphCount = ramp.length;
  const atlasCols = Math.ceil(Math.sqrt(glyphCount));
  const atlasRows = Math.ceil(glyphCount / atlasCols);

  const canvas = document.createElement("canvas");
  canvas.width = atlasCols * glyphPxWidth;
  canvas.height = atlasRows * glyphPxHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("buildCharacterAtlas: 2D context unavailable");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = `${weight} ${Math.round(glyphPxHeight * 0.85)}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < glyphCount; i++) {
    const col = i % atlasCols;
    const row = Math.floor(i / atlasCols);
    const cx = col * glyphPxWidth + glyphPxWidth / 2;
    const cy = row * glyphPxHeight + glyphPxHeight / 2;
    const ch = ramp[i];
    if (ch !== undefined && ch !== " ") {
      ctx.fillText(ch, cx, cy);
    }
  }

  const bitmap = await createImageBitmap(canvas);

  return {
    bitmap,
    glyphCount,
    glyphPxWidth,
    glyphPxHeight,
    atlasCols,
    atlasRows,
    ramp,
  };
}

/** Returns normalized (u0,v0,u1,v1) UV rect for glyph index i within the atlas. */
export function glyphUvRect(layout: AtlasLayout, index: number): [number, number, number, number] {
  const clamped = Math.max(0, Math.min(layout.glyphCount - 1, index));
  const col = clamped % layout.atlasCols;
  const row = Math.floor(clamped / layout.atlasCols);
  const u0 = col / layout.atlasCols;
  const v0 = row / layout.atlasRows;
  const u1 = (col + 1) / layout.atlasCols;
  const v1 = (row + 1) / layout.atlasRows;
  return [u0, v0, u1, v1];
}
