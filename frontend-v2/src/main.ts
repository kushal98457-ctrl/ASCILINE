import { Player } from "./core/player";
import { CHARACTER_SETS } from "./core/types";
import type { QualitySettings } from "./core/types";
import type { FrameMetrics } from "./core/types";

const canvas = document.querySelector<HTMLCanvasElement>("#ascii-canvas")!;
const emptyState = document.querySelector<HTMLDivElement>("#empty-state")!;
const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const playBtn = document.querySelector<HTMLButtonElement>("#play-btn")!;
const pauseBtn = document.querySelector<HTMLButtonElement>("#pause-btn")!;
const liveUrlInput = document.querySelector<HTMLInputElement>("#live-url-input")!;
const liveConnectBtn = document.querySelector<HTMLButtonElement>("#live-connect-btn")!;
const uploadInput = document.querySelector<HTMLInputElement>("#upload-input")!;
const uploadConnectBtn = document.querySelector<HTMLButtonElement>("#upload-connect-btn")!;
const uploadStatus = document.querySelector<HTMLSpanElement>("#upload-status")!;
const backendLabel = document.querySelector<HTMLSpanElement>("#backend-label")!;
const connectionStatus = document.querySelector<HTMLSpanElement>("#connection-status")!;
const metricsEl = document.querySelector<HTMLPreElement>("#metrics")!;

// Render Settings
const columnsInput = document.querySelector<HTMLInputElement>("#columns-input")!;
const columnsValue = document.querySelector<HTMLSpanElement>("#columns-value")!;
const charsetSelect = document.querySelector<HTMLSelectElement>("#charset-select")!;
const colorSelect = document.querySelector<HTMLSelectElement>("#color-select")!;
const ditherCheck = document.querySelector<HTMLInputElement>("#dither-check")!;
const edgeSelect = document.querySelector<HTMLSelectElement>("#edge-select")!;
const temporalSelect = document.querySelector<HTMLSelectElement>("#temporal-select")!;
const adaptiveCheck = document.querySelector<HTMLInputElement>("#adaptive-check")!;
const errorBanner = document.querySelector<HTMLDivElement>("#error-banner")!;

// Playback
const timeCurrent = document.querySelector<HTMLSpanElement>("#time-current")!;
const timeDuration = document.querySelector<HTMLSpanElement>("#time-duration")!;
const timelineInput = document.querySelector<HTMLInputElement>("#timeline-input")!;
const timelineProgress = document.querySelector<HTMLDivElement>("#timeline-progress")!;
const timelineThumb = document.querySelector<HTMLDivElement>("#timeline-thumb")!;
const volumeSlider = document.querySelector<HTMLInputElement>("#volume-slider")!;

for (const key of Object.keys(CHARACTER_SETS)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = key.toUpperCase();
  charsetSelect.appendChild(opt);
}
charsetSelect.value = "classic";

function showError(err: Error): void {
  errorBanner.textContent = `Error: ${err.message}`;
  errorBanner.style.display = "block";
  setTimeout(() => { errorBanner.style.display = "none"; }, 5000);
  console.error(err);
}

function updateConnectionStatus(status: string) {
  connectionStatus.textContent = `CONNECTION: ${status}`;
}

const player = new Player(canvas, {
  onBackendSelected: (backend) => {
    backendLabel.textContent = backend.toUpperCase();
    backendLabel.className = backend === "webgpu" ? "text-secondary-fixed-dim" : "text-tertiary-container";
  },
  onMetrics: (m: FrameMetrics) => {
    metricsEl.textContent = formatMetrics(m);
  },
  onConnectionStatus: (status) => {
    updateConnectionStatus(status);
  },
  onError: showError,
});

function formatMetrics(m: FrameMetrics): string {
  return [
    `FPS:       ${m.fps.toFixed(1)}`,
    `FRAME:     ${m.frameTimeMs.toFixed(2)}ms`,
    `RES:       ${m.resolution.cols}x${m.resolution.rows}`,
    `RENDERER:  ${m.renderer.toUpperCase()}`,
    `DROPPED:   ${m.droppedFrames}`,
    `QUEUE:     ${m.queueDepth}`,
    `LATENCY:   ${m.latencyMs.toFixed(0)}ms`,
    `MEMORY:    ${m.memoryEstimateMb.toFixed(1)}MB`,
  ].join("\n");
}

function currentSettingsFromUI(): Partial<QualitySettings> {
  return {
    columns: Number(columnsInput.value),
    characterSet: charsetSelect.value,
    colorMode: colorSelect.value as QualitySettings["colorMode"],
    dithering: ditherCheck.checked,
    edgeDetection: edgeSelect.value as QualitySettings["edgeDetection"],
    temporalStabilization: temporalSelect.value as QualitySettings["temporalStabilization"],
    adaptiveQuality: adaptiveCheck.checked,
  };
}

function applyUISettings(): void {
  player.updateSettings(currentSettingsFromUI());
}

[columnsInput, charsetSelect, colorSelect, ditherCheck, edgeSelect, temporalSelect, adaptiveCheck].forEach((el) => {
  el.addEventListener("input", () => {
    columnsValue.textContent = columnsInput.value;
    applyUISettings();
  });
});

async function handleFile(file: File) {
  if (!file) return;
  emptyState.style.display = "none";
  errorBanner.style.display = "none";
  updateConnectionStatus("LOCAL");
  try {
    await player.loadFile(file);
    applyUISettings();
    player.play();
    playBtn.classList.add("hidden");
    pauseBtn.classList.remove("hidden");
  } catch (err) {
    showError(err as Error);
  }
}

fileInput.addEventListener("change", () => {
  if (fileInput.files?.[0]) handleFile(fileInput.files[0]);
});

// Drag & Drop on Canvas Area
const canvasArea = canvas.parentElement!;
canvasArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  canvasArea.style.borderColor = "var(--primary-container)";
  canvasArea.style.backgroundColor = "rgba(0, 243, 255, 0.05)";
});
canvasArea.addEventListener("dragleave", (e) => {
  e.preventDefault();
  canvasArea.style.borderColor = "var(--outline-variant)";
  canvasArea.style.backgroundColor = "#0a0a0c";
});
canvasArea.addEventListener("drop", (e) => {
  e.preventDefault();
  canvasArea.style.borderColor = "var(--outline-variant)";
  canvasArea.style.backgroundColor = "#0a0a0c";
  const file = e.dataTransfer?.files?.[0];
  if (file && file.type.startsWith("video/")) {
    handleFile(file);
  }
});

playBtn.addEventListener("click", () => {
  player.play();
  playBtn.classList.add("hidden");
  pauseBtn.classList.remove("hidden");
});

pauseBtn.addEventListener("click", () => {
  player.pause();
  pauseBtn.classList.add("hidden");
  playBtn.classList.remove("hidden");
});

const rewindBtn = document.querySelector<HTMLButtonElement>("#rewind-btn")!;
const forwardBtn = document.querySelector<HTMLButtonElement>("#forward-btn")!;

rewindBtn.addEventListener("click", () => {
  player.seek(Math.max(0, player.currentTime - 10));
});

forwardBtn.addEventListener("click", () => {
  if (player.duration > 0) {
    player.seek(Math.min(player.duration, player.currentTime + 10));
  }
});

liveConnectBtn.addEventListener("click", () => {
  const url = liveUrlInput.value.trim();
  if (!url) return;
  emptyState.style.display = "none";
  errorBanner.style.display = "none";
  updateConnectionStatus("CONNECTING...");
  applyUISettings();
  player.connectLive(url);
  updateConnectionStatus("LIVE");
  playBtn.classList.add("hidden");
  pauseBtn.classList.remove("hidden");
});

function wsUrlToHttpBase(wsUrl: string): string {
  const u = new URL(wsUrl);
  u.protocol = u.protocol === "wss:" ? "https:" : "http:";
  u.pathname = "";
  return u.toString().replace(/\/$/, "");
}

uploadConnectBtn.addEventListener("click", async () => {
  const file = uploadInput.files?.[0];
  const wsUrl = liveUrlInput.value.trim() || "ws://localhost:8000/ws";
  if (!file) {
    showError(new Error("Pick a video file first."));
    return;
  }
  emptyState.style.display = "none";
  errorBanner.style.display = "none";
  uploadStatus.textContent = "UPLOADING...";
  uploadConnectBtn.disabled = true;
  updateConnectionStatus("UPLOADING");
  try {
    applyUISettings();
    await player.uploadAndConnectLive(file, wsUrlToHttpBase(wsUrl), wsUrl);
    uploadStatus.textContent = `PLAYING VIA SERVER`;
    updateConnectionStatus("LIVE (SERVER)");
    playBtn.classList.add("hidden");
    pauseBtn.classList.remove("hidden");
  } catch (err) {
    uploadStatus.textContent = "";
    updateConnectionStatus("ERROR");
    showError(err as Error);
  } finally {
    uploadConnectBtn.disabled = false;
  }
});

// Update timeline & volume logic via clean Player subscriptions
const fmt = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

player.onTimeUpdate((time, dur) => {
  if (dur > 0 && document.activeElement !== timelineInput) {
    timeCurrent.textContent = fmt(time);
    timeDuration.textContent = fmt(dur);
    const pct = Math.min(100, (time / dur) * 100);
    timelineProgress.style.width = `${pct}%`;
    timelineThumb.style.left = `${pct}%`;
    timelineInput.value = pct.toString();
  }
});

timelineInput.addEventListener("input", () => {
  const dur = player.duration;
  if (dur > 0) {
    const targetTime = (Number(timelineInput.value) / 100) * dur;
    player.seek(targetTime);
  }
});

volumeSlider.addEventListener("input", () => {
  player.setVolume(Number(volumeSlider.value) / 100);
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target === document.body) {
    e.preventDefault();
    if (playBtn.classList.contains("hidden")) {
      pauseBtn.click();
    } else {
      playBtn.click();
    }
  }
});

