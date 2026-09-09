<div align="center">

# ASCILINE

### GPU-Accelerated ASCII Video Engine

**Transform any video into real-time ASCII art — rendered on canvas, streamed over WebSocket, powered by WebGPU.**

<br>

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](#-requirements)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org/)
[![WebGPU](https://img.shields.io/badge/WebGPU-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://www.w3.org/TR/webgpu/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## What It Does

ASCILINE takes conventional video and runs it through a server-side processing pipeline — decoding each frame, mapping pixel luminance and color to ASCII characters (or colored blocks), compressing the result, and streaming it to the browser over a binary WebSocket protocol. The browser renders the incoming text frames onto an HTML5 Canvas at up to 60 FPS.

The result is a fully programmable visual surface: CSS filters, palette swaps, real-time contrast/gamma adjustments — things that would require shader-level access on a normal `<video>` element — become trivial because the stream is just structured text data.

---

## Demo

| Original Frame | ASCILINE Output |
| :---: | :---: |
| <img src="assets/demo-input.jpg" width="100%" alt="Original Frame — metallic figure in space"/> | <img src="assets/demo-output.jpg" width="100%" alt="ASCII-rendered output"/> |

*Source frame processed through the ASCILINE rendering engine in real-time.*

---

## Application Interface

<div align="center">
<img src="assets/demo-ui.png" width="100%" alt="ASCILINE Desktop Interface"/>
</div>

<br>

The workstation UI features:

- **Source Panel** — open local files, connect to live WebSocket streams, or upload directly to the server
- **Render Settings** — character set selection, resolution controls, color mode switching
- **WebGPU/WebGL2 Renderer** — hardware-accelerated canvas output at smooth framerates
- **Transport Controls** — play/pause, seek, skip, timeline scrubbing
- **Real-Time HUD** — FPS counter, connection status, renderer info

---

## Architecture

ASCILINE is a fork of the [original ASCILINE engine](https://github.com/YusufB5/ASCILINE) with a restructured codebase, a new performance-focused `core` module, and a redesigned frontend.

```
                    ┌─────────────────┐
                    │   Video Source   │
                    │  Local / URL /   │
                    │  Webcam / Stream │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Frame Decoder  │
                    │   (OpenCV)      │
                    │  FPS detection, │
                    │  normalization  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  ASCII / Pixel  │
                    │    Mapper       │
                    │   (NumPy)       │
                    │  6 color modes  │
                    └────────┬────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
         ┌──────▼──────┐     │     ┌──────▼──────┐
         │  Adaptive   │     │     │  Terminal   │
         │  Codec      │     │     │  Player     │
         │  ZLIB/DELTA │     │     │  (ANSI)     │
         │  RLE/DCT    │     │     │             │
         └──────┬──────┘     │     └─────────────┘
                │            │
         ┌──────▼──────┐     │
         │  WebSocket  │     │
         │  Binary     │     │
         │  Stream     │     │
         └──────┬──────┘     │
                │            │
         ┌──────▼────────────▼──────┐
         │    Browser Client        │
         │                          │
         │  ┌────────────────────┐  │
         │  │  Jitter Buffer     │  │
         │  │  Frame Decoder     │  │
         │  │  Canvas Renderer   │  │
         │  │  Audio Sync        │  │
         │  │  (master clock)    │  │
         │  └────────────────────┘  │
         │                          │
         └──────────────────────────┘
```

### What This Fork Adds

| Component | Description |
| :--- | :--- |
| **`core/adaptive.py`** | Adaptive quality controller — automatically scales resolution and FPS based on real-time frame processing performance. Ramps down under sustained load, recovers when headroom returns. |
| **`core/frame_queue.py`** | Bounded frame queue with automatic old-frame eviction. Keeps playback close to real-time when the encoder falls behind instead of buffering indefinitely. |
| **`core/performance.py`** | Zero-dependency performance monitor — tracks FPS, frame time, dropped frames, queue depth, and bandwidth over a sliding window. |
| **`core/benchmarks/`** | Synthetic benchmark runner that simulates frame processing workloads and reports adaptive controller behavior. |
| **`core/tests/`** | Unit tests for the adaptive controller and frame queue. |
| **`app.js`** | New frontend integration layer mapping the redesigned UI to the backend. |
| **Redesigned UI** | Cyberpunk-themed dark mode interface with source panel, render settings, WebGPU renderer status, and transport controls. |

### Project Structure

```
.
├── ASCILINE/                   # Original engine (submodule)
│   ├── stream_server.py        #   FastAPI WebSocket server
│   ├── ascii_video_player2.py  #   Core decoder & ASCII mapper
│   ├── codec.py                #   Python encoder (RAW/ZLIB/DELTA/RLE/DCT)
│   ├── codec.js                #   Browser decoder
│   ├── compiler.py             #   Video → .ascf compiler
│   ├── app.js                  #   Original frontend logic
│   ├── index.html              #   Original web client
│   ├── style.css               #   Original styling
│   ├── ytdl.py                 #   yt-dlp integration
│   ├── static_player/          #   Standalone .ascf player
│   ├── frontend-v2/            #   TypeScript frontend (Vite)
│   ├── experiments/            #   Codec benchmarks & test vectors
│   └── test/                   #   E2E & unit tests
│
├── core/                       # New performance module
│   ├── __init__.py
│   ├── adaptive.py             #   AdaptiveController
│   ├── frame_queue.py          #   FrameQueue
│   ├── performance.py          #   PerformanceMonitor
│   ├── benchmarks/
│   │   └── benchmark_performance.py
│   └── tests/
│       ├── test_adaptive.py
│       └── test_frame_queue.py
│
├── assets/                     # Screenshots & demo media
│   ├── demo-input.jpg
│   ├── demo-output.jpg
│   └── demo-ui.png
│
├── app.js                      # New UI integration layer
└── README.md
```

---

## How the Rendering Pipeline Works

**Traditional video playback:**
```
Video File → Browser Decoder → GPU → Screen
```

**ASCILINE's approach:**
```
Video File → OpenCV Decode → NumPy ASCII Map → Binary Encode → WebSocket → Canvas Text
```

The key difference: to the browser, there's no `<video>` element. The stream is structured text rendered onto a canvas — which means:

- No browser codec restrictions or autoplay policies
- Real-time CSS manipulation (glow, shadow, color shifts) on what looks like a video
- Playback on zero-GPU devices (the server does all the heavy work)
- Bandwidth proportional to text grid size, not pixel resolution

---

## Rendering Modes

| Mode | Color Depth |
| :---: | :--- |
| `1` | Black & White |
| `2` | 64 colors |
| `3` | 512 colors |
| `4` | 32K colors |
| `5` | 262K colors |
| `6` | 16M colors |

**Pixel Mode** replaces ASCII characters with colored block characters (`█`) for higher visual fidelity while keeping the same text-based rendering pipeline.

---

## Adaptive Quality System

The `core/adaptive.py` module automatically adjusts rendering quality based on real-time performance:

```
Frame Processing Time
        │
        ▼
   ┌─────────┐     Overloaded for 5+ frames
   │ Monitor ├──────────────────────────────▶ Scale DOWN
   │         │                                 • Reduce columns (×0.90)
   │         │     Healthy for 120+ frames     • Reduce FPS (if at min cols)
   │         ├──────────────────────────────▶ Scale UP
   └─────────┘                                 • Increase columns (×1.05)
                                               • Increase FPS (if at max cols)
```

Configuration:

```python
from core import AdaptiveController, AdaptiveConfig

controller = AdaptiveController(
    columns=240,
    target_fps=60,
    config=AdaptiveConfig(
        min_columns=80,
        max_columns=320,
        min_fps=15,
        max_fps=60,
    ),
)
```

---

## Installation

### Requirements

- Python 3.9+
- FFmpeg & FFprobe
- Modern browser (Canvas + WebSocket support)

### Setup

```bash
git clone https://github.com/kushal98457-ctrl/ASCILINE.git
cd ASCILINE
```

Install dependencies:

```bash
pip install fastapi uvicorn opencv-python numpy websockets
```

> **Headless / server environments:** use `opencv-python-headless` instead.

Optional — YouTube support:

```bash
pip install yt-dlp
```

### FFmpeg

```bash
winget install ffmpeg          # Windows
brew install ffmpeg            # macOS
sudo apt install ffmpeg        # Linux
```

### Run

```bash
python ASCILINE/stream_server.py video.mp4 --cols 240
```

Open **http://localhost:8000**.

---

## Usage Examples

```bash
# Single video
python ASCILINE/stream_server.py video.mp4 --cols 240

# Pixel mode (high fidelity colored blocks)
python ASCILINE/stream_server.py video.mp4 --pixel --cols 560

# YouTube URL
python ASCILINE/stream_server.py "https://youtu.be/VIDEO_ID" --cols 240

# Webcam
python ASCILINE/stream_server.py --webcam --cols 240

# Folder of videos
python ASCILINE/stream_server.py --folder videos --cols 200 --loop

# Terminal-only mode (no browser)
python ASCILINE/ascii_video_player2.py video.mp4 --cols 100
```

---

## Running Tests

```bash
# Adaptive controller tests
python -m pytest core/tests/test_adaptive.py -v

# Frame queue tests
python -m pytest core/tests/test_frame_queue.py -v

# Performance benchmark
python -m core.benchmarks.benchmark_performance
```

---

## Docker

```bash
docker compose up --build
```

Or manually:

```bash
docker build -t asciline ./ASCILINE
docker run -p 8000:8000 -v $(pwd)/videos:/app/videos asciline
```

---

## Troubleshooting

| Problem | Solution |
| :--- | :--- |
| Audio/video desync | Lower `--cols` — your machine can't encode fast enough |
| `ffmpeg` not found | Install via package manager or drop binaries next to `stream_server.py` |
| YouTube fails | Install `yt-dlp`: `pip install yt-dlp` |
| High CPU usage | Reduce `--cols` or switch from pixel to ASCII mode |
| Terminal output garbled | Don't resize terminal during playback |

---

## Acknowledgments

Built on top of the [ASCILINE](https://github.com/YusufB5/ASCILINE) engine by [YusufB5](https://github.com/YusufB5).

---

## License

See [LICENSE](ASCILINE/LICENSE) for terms.

---

<div align="center">

**ASCILINE** — turning video into programmable visual data.

</div>
