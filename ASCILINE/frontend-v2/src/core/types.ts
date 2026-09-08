// ASCILINE V2 — shared types.
// Single source of truth for the settings every module (renderer, atlas,
// adaptive-quality controller, UI) reads and mutates. Kept dependency-free
// so it can be imported by both renderer backends without pulling in DOM-only
// or GPU-only code.

export type RenderMode = "ascii" | "braille" | "block" | "pixel";
export type ColorMode = "grayscale" | "color256" | "truecolor";
export type EffectLevel = "off" | "low" | "medium" | "high";
export type RendererBackend = "webgpu" | "webgl2" | "unavailable";

export const CHARACTER_SETS: Record<string, string> = {
  minimal: " .:-=+*#%@",
  classic: " .:-=+*#%@$",
  dense: " `.'\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  extended:
    " `.-':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@",
  blocks: " ░▒▓█",
};

/** Resolves a character-set key to a ramp string, always returning a valid
 * (non-undefined) ramp even for an unknown key. */
export function resolveCharacterRamp(settings: Pick<QualitySettings, "characterSet" | "customRamp">): string {
  if (settings.characterSet === "custom" && settings.customRamp) return settings.customRamp;
  return CHARACTER_SETS[settings.characterSet] ?? CHARACTER_SETS["classic"] ?? " .:-=+*#%@";
}

// Ordered brightest->darkest is NOT assumed; ramps are stored dark->bright
// and the shaders index from the dark end. See CharacterAtlas for layout.
export interface QualitySettings {
  renderMode: RenderMode;
  colorMode: ColorMode;
  columns: number; // grid width in character cells
  targetFps: number; // 24 | 30 | 60 | custom
  dithering: boolean;
  edgeDetection: EffectLevel;
  temporalStabilization: EffectLevel;
  sharpening: boolean;
  adaptiveQuality: boolean;
  characterSet: string; // key into CHARACTER_SETS, or "custom"
  customRamp?: string;
}

export const DEFAULT_QUALITY: QualitySettings = {
  renderMode: "ascii",
  colorMode: "truecolor",
  columns: 320,
  targetFps: 60,
  dithering: false,
  edgeDetection: "off",
  temporalStabilization: "medium",
  sharpening: true,
  adaptiveQuality: true,
  characterSet: "classic",
};

// Priority-ordered downgrade steps for adaptive quality (see performance.ts).
// Each step must be reversible (upgrade path retraces the same list).
export const ADAPTIVE_COLUMN_STEPS = [480, 400, 320, 280, 240, 200, 160] as const;

export interface FrameMetrics {
  fps: number;
  frameTimeMs: number;
  gpuFrameTimeMs: number | null;
  cpuTimeMs: number;
  decodeTimeMs: number;
  uploadTimeMs: number;
  renderTimeMs: number;
  queueDepth: number;
  droppedFrames: number;
  latencyMs: number;
  memoryEstimateMb: number;
  resolution: { cols: number; rows: number };
  renderer: RendererBackend;
}

export interface GridDimensions {
  cols: number;
  rows: number;
  cellWidthPx: number;
  cellHeightPx: number;
}

/**
 * Computes a character grid for a given source video size and target column
 * count, correcting for the fact that most monospace glyphs are taller than
 * they are wide (~0.5-0.55 aspect for typical terminal/coding fonts).
 */
export function computeGridDimensions(
  videoWidth: number,
  videoHeight: number,
  columns: number,
  glyphAspect = 0.55, // width / height of a single glyph cell
): GridDimensions {
  if (videoWidth <= 0 || videoHeight <= 0 || columns <= 0) {
    throw new RangeError(
      `computeGridDimensions: invalid input (w=${videoWidth}, h=${videoHeight}, cols=${columns})`,
    );
  }
  const videoAspect = videoWidth / videoHeight; // > 1 for landscape
  const cols = Math.max(1, Math.round(columns));
  // rows = cols / videoAspect / glyphAspect  (derived so the rendered grid's
  // real-world width:height matches the source video's aspect ratio once
  // each cell's own non-square shape is accounted for)
  const rows = Math.max(1, Math.round(cols / videoAspect / glyphAspect));
  return { cols, rows, cellWidthPx: 0, cellHeightPx: 0 };
}
