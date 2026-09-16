import type { IRenderer } from "./Renderer";
import { RendererUnavailableError } from "./Renderer";
import type { QualitySettings } from "../core/types";
import { computeGridDimensions, resolveCharacterRamp } from "../core/types";
import { buildCharacterAtlas, type AtlasLayout } from "./CharacterAtlas";

import cellComputeWgsl from "./shaders/cellCompute.wgsl?raw";
import cellRenderWgsl from "./shaders/cellRender.wgsl?raw";

const EDGE_LEVEL: Record<string, number> = { off: 0, low: 1, medium: 2, high: 3 };
const TEMPORAL_LEVEL: Record<string, number> = { off: 0, low: 1, medium: 2, high: 3 };
const COLOR_MODE: Record<string, number> = { grayscale: 0, color256: 1, truecolor: 2 };

/**
 * GPU-first renderer. All per-frame work — downsample, luminance, edges,
 * dithering, character selection, temporal stabilization, glyph compositing
 * — happens in two GPU passes (see cellCompute.wgsl / cellRender.wgsl).
 * The only CPU work per frame is uploading the video frame as an external
 * texture and writing a handful of uniform bytes.
 */
export class WebGPURenderer implements IRenderer {
  readonly backend = "webgpu" as const;

  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private canvas!: HTMLCanvasElement;
  private format!: GPUTextureFormat;

  private computePipeline!: GPUComputePipeline;
  private renderPipeline!: GPURenderPipeline;

  private cellBufferA!: GPUBuffer;
  private cellBufferB!: GPUBuffer;
  private frontIsA = true;

  private computeUniformBuffer!: GPUBuffer;
  private renderUniformBuffer!: GPUBuffer;
  private videoSampler!: GPUSampler;
  private atlasSampler!: GPUSampler;
  private atlasTexture: GPUTexture | null = null;
  private atlasLayout: AtlasLayout | null = null;

  private settings: QualitySettings | null = null;
  private cols = 0;
  private rows = 0;
  private frameIndex = 0;

  private timestampSupported = false;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (!("gpu" in navigator)) {
      throw new RendererUnavailableError("WebGPU", "navigator.gpu is not present");
    }
    const gpu = (navigator as Navigator & { gpu: GPU }).gpu;
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) throw new RendererUnavailableError("WebGPU", "no adapter returned");

    this.timestampSupported = adapter.features.has("timestamp-query");
    this.device = await adapter.requestDevice({
      requiredFeatures: this.timestampSupported ? ["timestamp-query"] : [],
    });
    this.device.lost.then((info) => {
      // Device loss is a normal, expected event (GPU driver reset, tab
      // backgrounding on some platforms) — surfaced via console, and the
      // caller (Pipeline) is responsible for reinit-on-visibility.
      console.warn(`[ASCILINE] WebGPU device lost: ${info.message}`);
    });

    this.canvas = canvas;
    const context = canvas.getContext("webgpu");
    if (!context) throw new RendererUnavailableError("WebGPU", "canvas.getContext('webgpu') failed");
    this.context = context;
    this.format = gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque",
    });

    this.videoSampler = this.device.createSampler({ magFilter: "linear", minFilter: "linear" });
    this.atlasSampler = this.device.createSampler({ magFilter: "linear", minFilter: "linear" });

    this.computeUniformBuffer = this.device.createBuffer({
      size: 40, // 10 x u32/f32 fields, see Params struct
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.renderUniformBuffer = this.device.createBuffer({
      size: 48, // cols,rows,atlasCols,atlasRows (u32 x4, padded to 16) + vec4 bg color
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: {
        module: this.device.createShaderModule({ code: cellComputeWgsl }),
        entryPoint: "main",
      },
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: this.device.createShaderModule({ code: cellRenderWgsl }),
        entryPoint: "vs_main",
      },
      fragment: {
        module: this.device.createShaderModule({ code: cellRenderWgsl }),
        entryPoint: "fs_main",
        targets: [{ format: this.format }],
      },
      primitive: { topology: "triangle-list" },
    });
  }

  async setCharacterRamp(ramp: string): Promise<void> {
    this.atlasLayout = await buildCharacterAtlas(ramp);
    this.atlasTexture?.destroy();
    this.atlasTexture = this.device.createTexture({
      size: [this.atlasLayout.bitmap.width, this.atlasLayout.bitmap.height],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture(
      { source: this.atlasLayout.bitmap },
      { texture: this.atlasTexture },
      [this.atlasLayout.bitmap.width, this.atlasLayout.bitmap.height],
    );
  }

  updateSettings(settings: QualitySettings): void {
    const prevCols = this.cols;
    this.settings = settings;
    const ramp = resolveCharacterRamp(settings);

    if (ramp !== this.atlasLayout?.ramp) {
      void this.setCharacterRamp(ramp);
    }

    // Grid size depends on video dimensions, which we don't know until the
    // first frame arrives; renderFrame() calls resizeGridIfNeeded() itself
    // once it has the video's actual dimensions. Here we only react to
    // column changes once we've already seen a frame.
    if (settings.columns !== prevCols && this.videoWidth && this.videoHeight) {
      this.resizeGridIfNeeded(settings.columns, this.videoWidth, this.videoHeight);
    }
  }

  private videoWidth = 0;
  private videoHeight = 0;

  private resizeGridIfNeeded(columns: number, videoWidth: number, videoHeight: number): void {
    const { cols, rows } = computeGridDimensions(videoWidth, videoHeight, columns);
    if (cols === this.cols && rows === this.rows) return;
    this.cols = cols;
    this.rows = rows;
    this.frameIndex = 0;

    const cellCount = cols * rows;
    const bufSize = cellCount * 8; // vec2<u32> per cell = 8 bytes
    this.cellBufferA?.destroy();
    this.cellBufferB?.destroy();
    this.cellBufferA = this.device.createBuffer({
      size: bufSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.cellBufferB = this.device.createBuffer({
      size: bufSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.frontIsA = true;
  }

  renderFrame(source: HTMLVideoElement | VideoFrame): number | null {
    if (!this.settings) return null;
    const vw = source instanceof HTMLVideoElement ? source.videoWidth : source.displayWidth;
    const vh = source instanceof HTMLVideoElement ? source.videoHeight : source.displayHeight;
    if (!vw || !vh) return null;

    this.videoWidth = vw;
    this.videoHeight = vh;
    this.resizeGridIfNeeded(this.settings.columns, vw, vh);
    if (!this.atlasLayout || !this.atlasTexture) return null; // atlas still loading

    const externalTexture = this.device.importExternalTexture({ source });

    // ---- Update compute uniforms ----
    const computeParams = new Uint32Array(10);
    computeParams[0] = this.cols;
    computeParams[1] = this.rows;
    computeParams[2] = this.atlasLayout.glyphCount;
    computeParams[3] = vw;
    computeParams[4] = vh;
    computeParams[5] = this.settings.dithering ? 1 : 0;
    computeParams[6] = EDGE_LEVEL[this.settings.edgeDetection] ?? 0;
    computeParams[7] = TEMPORAL_LEVEL[this.settings.temporalStabilization] ?? 0;
    computeParams[8] = COLOR_MODE[this.settings.colorMode] ?? 2;
    computeParams[9] = this.frameIndex;
    this.device.queue.writeBuffer(this.computeUniformBuffer, 0, computeParams);

    const cellsOut = this.frontIsA ? this.cellBufferA : this.cellBufferB;
    const cellsPrev = this.frontIsA ? this.cellBufferB : this.cellBufferA;

    const computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: externalTexture },
        { binding: 1, resource: this.videoSampler },
        { binding: 2, resource: { buffer: this.computeUniformBuffer } },
        { binding: 3, resource: { buffer: cellsOut } },
        { binding: 4, resource: { buffer: cellsPrev } },
      ],
    });

    // ---- Update render uniforms ----
    const renderParams = new ArrayBuffer(48);
    const rpU32 = new Uint32Array(renderParams, 0, 4);
    rpU32[0] = this.cols;
    rpU32[1] = this.rows;
    rpU32[2] = this.atlasLayout.atlasCols;
    rpU32[3] = this.atlasLayout.atlasRows;
    const rpF32 = new Float32Array(renderParams, 16, 4);
    rpF32.set([0.02, 0.02, 0.02, 1.0]); // background color
    this.device.queue.writeBuffer(this.renderUniformBuffer, 0, renderParams);

    const renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: cellsOut } },
        { binding: 1, resource: { buffer: this.renderUniformBuffer } },
        { binding: 2, resource: this.atlasTexture.createView() },
        { binding: 3, resource: this.atlasSampler },
      ],
    });

    const encoder = this.device.createCommandEncoder();

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(this.cols / 8), Math.ceil(this.rows / 8));
    computePass.end();

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.02, b: 0.02, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, renderBindGroup);
    renderPass.draw(6, this.cols * this.rows);
    renderPass.end();

    this.device.queue.submit([encoder.finish()]);

    this.frontIsA = !this.frontIsA;
    this.frameIndex++;

    // GPU timestamp queries require additional query-set plumbing omitted
    // here for brevity; CPU-side frame timing (performance.ts) covers the
    // adaptive-quality control loop in the meantime.
    return null;
  }

  destroy(): void {
    this.cellBufferA?.destroy();
    this.cellBufferB?.destroy();
    this.atlasTexture?.destroy();
    this.computeUniformBuffer?.destroy();
    this.renderUniformBuffer?.destroy();
  }
}
