import type { IRenderer } from "./Renderer";
import { RendererUnavailableError } from "./Renderer";
import type { QualitySettings } from "../core/types";
import { computeGridDimensions, resolveCharacterRamp } from "../core/types";
import { buildCharacterAtlas, type AtlasLayout } from "./CharacterAtlas";

import fullscreenVert from "./shaders/fullscreen.vert.glsl?raw";
import cellDecodeFrag from "./shaders/cellDecode.frag.glsl?raw";
import cellCompositeFrag from "./shaders/cellComposite.frag.glsl?raw";

const EDGE_LEVEL: Record<string, number> = { off: 0, low: 1, medium: 2, high: 3 };
const TEMPORAL_LEVEL: Record<string, number> = { off: 0, low: 1, medium: 2, high: 3 };
const COLOR_MODE: Record<string, number> = { grayscale: 0, color256: 1, truecolor: 2 };

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    throw new Error(`Program link error: ${log}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

/** Degrade-gracefully path when WebGPU isn't available. Same algorithm as
 * the WebGPU renderer (see cellDecode.frag.glsl for the per-cell logic),
 * split into two fragment passes since WebGL2 has no compute shaders. */
export class WebGLRenderer implements IRenderer {
  readonly backend = "webgl2" as const;

  private gl!: WebGL2RenderingContext;
  private canvas!: HTMLCanvasElement;

  private decodeProgram!: WebGLProgram;
  private compositeProgram!: WebGLProgram;

  private cellFbA!: WebGLFramebuffer;
  private cellFbB!: WebGLFramebuffer;
  private cellTexA!: WebGLTexture;
  private cellTexB!: WebGLTexture;
  private frontIsA = true;

  private videoTexture!: WebGLTexture;
  private atlasTexture: WebGLTexture | null = null;
  private atlasLayout: AtlasLayout | null = null;
  private vao!: WebGLVertexArrayObject;

  private settings: QualitySettings | null = null;
  private cols = 0;
  private rows = 0;
  private frameIndex = 0;
  private videoWidth = 0;
  private videoHeight = 0;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new RendererUnavailableError("WebGL2", "getContext('webgl2') returned null");
    this.gl = gl;
    this.canvas = canvas;

    this.decodeProgram = linkProgram(gl, fullscreenVert, cellDecodeFrag);
    this.compositeProgram = linkProgram(gl, fullscreenVert, cellCompositeFrag);

    this.videoTexture = this.createTexture();
    this.vao = gl.createVertexArray()!; // fullscreen triangle needs no attributes
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error("createTexture failed");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  private createCellTarget(cols: number, rows: number): { fb: WebGLFramebuffer; tex: WebGLTexture } {
    const gl = this.gl;
    const tex = this.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    if (!fb) throw new Error("createFramebuffer failed");
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex };
  }

  async setCharacterRamp(ramp: string): Promise<void> {
    this.atlasLayout = await buildCharacterAtlas(ramp);
    const gl = this.gl;
    this.atlasTexture = this.atlasTexture ?? this.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlasLayout.bitmap);
  }

  updateSettings(settings: QualitySettings): void {
    const prevCols = this.cols;
    this.settings = settings;
    const ramp = resolveCharacterRamp(settings);
    if (ramp !== this.atlasLayout?.ramp) void this.setCharacterRamp(ramp);
    if (settings.columns !== prevCols && this.videoWidth && this.videoHeight) {
      this.resizeGridIfNeeded(settings.columns, this.videoWidth, this.videoHeight);
    }
  }

  private resizeGridIfNeeded(columns: number, videoWidth: number, videoHeight: number): void {
    const { cols, rows } = computeGridDimensions(videoWidth, videoHeight, columns);
    if (cols === this.cols && rows === this.rows) return;
    this.cols = cols;
    this.rows = rows;
    this.frameIndex = 0;
    const a = this.createCellTarget(cols, rows);
    const b = this.createCellTarget(cols, rows);
    this.cellFbA = a.fb;
    this.cellTexA = a.tex;
    this.cellFbB = b.fb;
    this.cellTexB = b.tex;
    this.frontIsA = true;
  }

  renderFrame(source: HTMLVideoElement | VideoFrame): number | null {
    if (!this.settings || !this.atlasLayout || !this.atlasTexture) return null;
    const gl = this.gl;
    const vw = source instanceof HTMLVideoElement ? source.videoWidth : source.displayWidth;
    const vh = source instanceof HTMLVideoElement ? source.videoHeight : source.displayHeight;
    if (!vw || !vh) return null;
    this.videoWidth = vw;
    this.videoHeight = vh;
    this.resizeGridIfNeeded(this.settings.columns, vw, vh);

    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);

    const outFb = this.frontIsA ? this.cellFbA : this.cellFbB;
    const outTex = this.frontIsA ? this.cellTexA : this.cellTexB;
    const prevTex = this.frontIsA ? this.cellTexB : this.cellTexA;

    gl.bindVertexArray(this.vao);

    // ---- Pass 1: decode cells ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, outFb);
    gl.viewport(0, 0, this.cols, this.rows);
    gl.useProgram(this.decodeProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.uniform1i(gl.getUniformLocation(this.decodeProgram, "uVideo"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.uniform1i(gl.getUniformLocation(this.decodeProgram, "uPrevCells"), 1);
    gl.uniform2f(gl.getUniformLocation(this.decodeProgram, "uGridSize"), this.cols, this.rows);
    gl.uniform1f(gl.getUniformLocation(this.decodeProgram, "uRampLength"), this.atlasLayout.glyphCount);
    gl.uniform1i(gl.getUniformLocation(this.decodeProgram, "uDitherEnabled"), this.settings.dithering ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(this.decodeProgram, "uEdgeLevel"), EDGE_LEVEL[this.settings.edgeDetection] ?? 0);
    gl.uniform1i(
      gl.getUniformLocation(this.decodeProgram, "uTemporalLevel"),
      TEMPORAL_LEVEL[this.settings.temporalStabilization] ?? 0,
    );
    gl.uniform1i(gl.getUniformLocation(this.decodeProgram, "uColorMode"), COLOR_MODE[this.settings.colorMode] ?? 2);
    gl.uniform1i(gl.getUniformLocation(this.decodeProgram, "uFrameIndex"), this.frameIndex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---- Pass 2: composite to screen ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.compositeProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, outTex);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, "uCells"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.uniform1i(gl.getUniformLocation(this.compositeProgram, "uAtlas"), 1);
    gl.uniform2f(gl.getUniformLocation(this.compositeProgram, "uGridSize"), this.cols, this.rows);
    gl.uniform2f(
      gl.getUniformLocation(this.compositeProgram, "uAtlasGrid"),
      this.atlasLayout.atlasCols,
      this.atlasLayout.atlasRows,
    );
    gl.uniform2f(gl.getUniformLocation(this.compositeProgram, "uOutputSize"), this.canvas.width, this.canvas.height);
    gl.uniform4f(gl.getUniformLocation(this.compositeProgram, "uBackgroundColor"), 0.02, 0.02, 0.02, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this.frontIsA = !this.frontIsA;
    this.frameIndex++;
    return null;
  }

  destroy(): void {
    const gl = this.gl;
    if (!gl) return;
    [this.cellTexA, this.cellTexB, this.videoTexture, this.atlasTexture].forEach((t) => {
      if (t) gl.deleteTexture(t);
    });
    [this.cellFbA, this.cellFbB].forEach((fb) => {
      if (fb) gl.deleteFramebuffer(fb);
    });
  }
}
