<div align="center">

```
 █████╗ ███████╗ ██████╗██╗██╗     ██╗███╗   ██╗███████╗
██╔══██╗██╔════╝██╔════╝██║██║     ██║████╗  ██║██╔════╝
███████║███████╗██║     ██║██║     ██║██╔██╗ ██║█████╗  
██╔══██║╚════██║██║     ██║██║     ██║██║╚██╗██║██╔══╝  
██║  ██║███████║╚██████╗██║███████╗██║██║ ╚████║███████╗
╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝
```

### *Real-time ASCII Video Rendering Engine*

**Turn any video into a live, styleable typographic stream — no GPU, no `<video>` tag, no codec restrictions.**

<br>

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](#0-requirements)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org/)
[![JavaScript](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5 Canvas](https://img.shields.io/badge/HTML5_Canvas-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![NumPy](https://img.shields.io/badge/NumPy-013243?style=for-the-badge&logo=numpy&logoColor=white)](https://numpy.org/)

<br>

<a href="https://trendshift.io/repositories/50861?utm_source=trendshift-badge&amp;utm_medium=badge&amp;utm_campaign=badge-trendshift-50861" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50861/daily?language=Python" alt="YusufB5%2FASCILINE | Trendshift" width="250" height="55"/></a>
<a href="https://trendshift.io/repositories/50861?utm_source=trendshift-badge&amp;utm_medium=badge&amp;utm_campaign=badge-trendshift-50861" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50861/weekly?language=Python" alt="YusufB5%2FASCILINE | Trendshift" width="250" height="55"/></a>
<a href="https://trendshift.io/repositories/50861?utm_source=trendshift-badge&amp;utm_medium=badge&amp;utm_campaign=badge-trendshift-50861" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50861/daily" alt="YusufB5%2FASCILINE | Trendshift" width="250" height="55"/></a>

</div>

---

## 🎬 What is ASCILINE?

ASCILINE is a **high-performance, cross-platform real-time ASCII video rendering engine**. It decodes video server-side, maps pixels to text-based representations via NumPy, and streams the result over a low-overhead binary WebSocket protocol — turning the browser canvas into a typographic display surface.

<table>
<tr>
<td align="center" width="33%">
<img src="https://github.com/user-attachments/assets/ccc727c9-c697-49f2-85e1-6f8c366f2019" width="100%" alt="Original Source" />
<br><b>📹 Original Source</b>
<br><sub>Standard MP4 video file</sub>
</td>
<td align="center" width="33%">
<img src="https://github.com/user-attachments/assets/6bd7f5c0-81de-49fe-ba0d-9a8872ec8ae3" width="100%" alt="ASCII Mode" />
<br><b>🔤 ASCII Mode</b>
<br><sub>Mode 4 (32K colors) · 30fps</sub>
</td>
<td align="center" width="33%">
<img src="https://github.com/user-attachments/assets/1fd88c3d-97d1-441a-a071-16de24ea82c0" width="100%" alt="PIXEL Mode" />
<br><b>🟩 PIXEL Mode</b>
<br><sub>High-fidelity colored blocks █</sub>
</td>
</tr>
</table>

---

## 📑 Table of Contents

<details>
<summary><b>Click to expand</b></summary>

- [Design Philosophy](#-design-philosophy)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
  - [System Overview](#system-overview)
  - [Data Flow Pipeline](#data-flow-pipeline)
  - [Project Structure](#project-structure)
- [Adaptive Frame Codec](#-adaptive-frame-codec)
- [Zero-Dependency Static Player](#-zero-dependency-static-web-player)
- [Installation](#-installation)
- [Usage](#-usage)
- [Docker Deployment](#-running-with-docker)
- [Customization](#-customization)
- [Troubleshooting](#-troubleshooting)
- [Live Demo](#-live-demo)
- [Contributing & Community](#-community)
- [License](#-license)
- [Support](#-support-)

</details>

---

## 🎯 Design Philosophy

<table>
<tr>
<td>🎨</td>
<td><b>Pure Typographic Manipulation</b></td>
<td>The visual stream is raw HTML/Canvas text — not a standard media file. Real-time CSS filters (glows, shadows, animations) can be applied directly to what would otherwise be a video.</td>
</tr>
<tr>
<td>⚡</td>
<td><b>Zero GPU, Ultra-Low Bandwidth</b></td>
<td>Standard codecs (H.264/VP9) require dedicated hardware decoders. ASCILINE does the heavy lifting server-side and streams lightweight text frames — fewer columns means proportionally less bandwidth. Fluid playback on constrained networks and zero-GPU devices (smart appliances, retro terminals, microcontrollers).</td>
</tr>
<tr>
<td>🌐</td>
<td><b>Universal Compatibility</b></td>
<td>No <code>&lt;video&gt;</code> tag, no browser-side codec decoding, no autoplay restrictions. To the browser, it's just text on a canvas.</td>
</tr>
</table>

> **Roadmap idea (not yet implemented):** Because ASCII output is already a compact, structured text representation, it could in principle serve as a lightweight input for downstream text/LLM processing — instead of feeding raw pixel streams to a vision model. Flagging this as a direction, not a shipped feature.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| 🖥️ **Cross-Platform** | Windows, macOS, Linux |
| 🎥 **Dual Rendering Modes** | Real-time ASCII streaming + Pixel mode (colored blocks approaching 360p quality) |
| 🎨 **6 Color Modes** | B&W → 64 → 512 → 32K → 262K → 16M colors |
| 🔊 **Master Clock Sync** | Audio track is the absolute time reference, keeping A/V perfectly synchronized |
| 📡 **Binary WebSocket Protocol** | Frames streamed as raw `Uint8Array` directly to canvas — minimal overhead |
| 🖼️ **HTML5 Canvas Rendering** | Tuned for 24–30 FPS; higher-FPS sources are automatically decimated |
| 📋 **Flexible Playback** | JSON playlists, folder-based auto-queuing, single-file mode, infinite loop, YouTube URLs |
| 📷 **Live Webcam** | Real-time ASCII webcam streaming with configurable FPS and mirroring |
| 🗜️ **Adaptive Compression** | Opt-in codec with RAW/ZLIB/DELTA/RLE/DCT — up to 375× bandwidth savings |
| 📦 **Static Compilation** | Compile videos to `.ascf` files — host anywhere, no backend needed |

---

## 🏗 Architecture

### System Overview

ASCILINE uses a **modular, layered architecture** that cleanly separates the core rendering engine, network transport, and delivery methods into independent components.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ASCILINE ENGINE                                │
│                                                                        │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   VIDEO INPUT     │    │   CORE ENGINE    │    │   DELIVERY       │  │
│  │                   │    │                  │    │                  │  │
│  │  • Local Files    │───▶│  VideoDecoder    │───▶│  WebSocket Live  │  │
│  │  • YouTube/URLs   │    │  AsciiMapper     │    │  Static .ascf    │  │
│  │  • Webcam         │    │  Frame Codec     │    │  Terminal ANSI   │  │
│  │  • Playlists      │    │  NumPy Pipeline  │    │  Browser Studio  │  │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘  │
│                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Pipeline

The engine processes video through a **three-stage pipeline** with adaptive compression at the transport layer:

```
                    ┌─────────────┐
                    │ VIDEO SOURCE │
                    │  (MP4/URL/   │
                    │   Webcam)    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   DECODE    │  OpenCV frame extraction
                    │  (Backend)  │  FPS decimation & normalization
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    MAP      │  Pixel → ASCII character mapping
                    │  (NumPy)   │  Color quantization (modes 1-6)
                    └──────┬──────┘  Pixel block rendering (█ mode)
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌──▼───┐ ┌──────▼──────┐
       │  COMPRESS   │ │ RAW  │ │  TERMINAL   │
       │  (Adaptive) │ │      │ │  (Direct    │
       │  ZLIB/DELTA │ │      │ │   ANSI)     │
       │  RLE/DCT    │ │      │ │             │
       └──────┬──────┘ └──┬───┘ └──────┬──────┘
              │            │            │
       ┌──────▼──────┐    │     ┌──────▼──────┐
       │  WebSocket  │    │     │  stdout     │
       │  Binary     │    │     │  (True      │
       │  Stream     │    │     │   Color)    │
       └──────┬──────┘    │     └─────────────┘
              │            │
       ┌──────▼────────────▼─────┐
       │     BROWSER CLIENT      │
       │                         │
       │  INIT Handshake         │
       │  ↓                      │
       │  Jitter Buffer          │
       │  ↓                      │
       │  Canvas Grid Renderer   │
       │  ↓                      │
       │  Audio Sync (master     │
       │  clock)                 │
       └─────────────────────────┘
```

### Communication Protocol

```
 Client                              Server
   │                                    │
   │──── WS Connect ──────────────────▶│
   │                                    │
   │◀─── INIT { cols, rows, fps,  ─────│  Handshake: negotiate
   │          mode, codec }             │  resolution & capabilities
   │                                    │
   │◀─── [tag][binary frame data] ─────│  Continuous binary stream
   │◀─── [tag][binary frame data] ─────│  Tag byte selects decoder
   │◀─── [tag][binary frame data] ─────│  (RAW/ZLIB/DELTA/RLE/DCT)
   │          ...                       │
   │                                    │
   │◀─── [audio chunk] ───────────────│  Parallel audio stream
   │          ...                       │  (master clock reference)
   │                                    │
```

### Project Structure

```text
ASCILINE/
│
├── 🔧 CORE ENGINE ─────────────────────────────────────────────────────
│   ├── ascii_video_player2.py      # VideoDecoder, AsciiMapper & standalone terminal player
│   ├── codec.py                    # Master encoder (RAW / ZLIB / DELTA / RLE / DCT)
│   └── codec.js                    # Root JS decoder (optimized for live WebSocket streaming)
│
├── 🌐 LIVE STREAMING CLIENT ───────────────────────────────────────────
│   ├── index.html                  # Web client UI for the live streaming server
│   ├── app.js                      # Frontend WebSocket connection & Canvas render loop
│   └── style.css                   # UI styling, responsive layout & real-time FX
│
├── 📦 STATIC PLAYER & COMPILER ────────────────────────────────────────
│   ├── compiler.py                 # CLI compiler: video → .ascf (ASCII Compressed Format)
│   └── static_player/
│       ├── index.html              # Main UI for the offline web player
│       ├── reader.js               # .ascf parser, chunk loader & rolling buffer manager
│       ├── codec.js                # Standalone JS decoder (optimized for static buffers)
│       └── studio/                 # Browser-based compiler IDE
│           ├── index.html          # Studio UI with built-in preview & seekbar
│           └── encoder.js          # Client-side encoder (compiles videos in-browser)
│
├── ⚙️ SERVER & BACKEND ────────────────────────────────────────────────
│   ├── stream_server.py            # FastAPI WebSocket server for real-time streaming
│   └── ytdl.py                     # yt-dlp integration for YouTube/URL fetching
│
├── 🧪 DEVELOPMENT & TESTING ───────────────────────────────────────────
│   ├── experiments/                # Codec benchmarks, test vectors & experimental scripts
│   └── test/                       # E2E tests, unit tests & backpressure validation
│
├── 🎨 ASSETS ──────────────────────────────────────────────────────────
│   ├── logo.py                     # ASCII branding banner displayed on server startup
│   └── videos/                     # Auto-managed LRU cache for downloaded media
│
└── 📄 CONFIGURATION ──────────────────────────────────────────────────
    ├── playlist.json               # Playback queue with per-video overrides
    ├── pyproject.toml              # Python project metadata & dependencies
    ├── requirements.txt            # Python dependency lockfile
    ├── Dockerfile                  # Container image configuration
    └── docker-compose.yml          # Multi-service Docker orchestration
```

---

## 🗜 Adaptive Frame Codec

> **Opt-in for ASCII modes 2–6** — add `?codec=adaptive` to the WebSocket URL.

The original protocol re-sends the full grid every frame. The adaptive codec picks the **smallest encoding per frame** and tags it with a 1-byte header, without changing the rendered output:

| Tag | Encoding | Best For | Encoder Support |
| :--: | :--- | :--- | :--- |
| `0` | **RAW** — framebuffer as-is | Incompressible frames | Python ✅ · Browser ✅ |
| `1` | **ZLIB** — `zlib(framebuffer)` | General motion | Python ✅ · Browser ✅ |
| `2` | **DELTA** — only changed cells | Static / low-motion scenes | Python ✅ · Browser ✅ |
| `3` | **RLE_FULL** — run-length encoded | Large flat-color regions | Python ✅ · Browser ❌ |
| `4` | **DCT** — Discrete Cosine Transform | Spatial compression (static player) | Python ✅ · Browser ❌ |

> **Design note:** The browser-side encoder (`studio/encoder.js`) intentionally only emits RAW/ZLIB/DELTA to keep the in-browser compiler simple. This is a deliberate simplicity/size trade-off — decoders stay permissive, encoders stay conservative.

### Measured Wire Savings

*(Mode 6, 200×80 grid)*

| Content Type | Bandwidth vs Legacy |
| :--- | :--- |
| Static screen / slideshow | **0.3%** of legacy (≈ **375× reduction**) |
| High-motion / full-frame change | **63%** of legacy (never worse) |

### Lossy Quality Presets

An optional `--quality` flag enables lossy *temporal delta* — a color cell is only re-sent once it drifts past a tolerance threshold:

```bash
python stream_server.py video.mp4 --quality balanced    # ~15-30% further savings
```

| Preset | Behavior |
| :--- | :--- |
| `lossless` | Bit-exact (default) |
| `high` | Near-imperceptible quality loss |
| `balanced` | Best quality/size trade-off |
| `low` | Maximum compression |

> **Monitor bandwidth in real time:** pass `--debug` to see live RAW vs WIRE comparisons and compression ratios.

> **Verification:** Tested two independent ways — Python-encoded vectors decoded by `codec.js` in Node (`experiments/gen_vectors.py` → `experiments/check_vectors.js`), and a live `adaptive` vs `legacy` WebSocket diff (`experiments/test_e2e.js`).

**LAN / network streaming:**
```bash
python stream_server.py video.mp4 --host 0.0.0.0
```

---

## 📦 Zero-Dependency Static Web Player

Compile any video into a self-contained **`.ascf`** (ASCII Compressed Format) file and play it with a static HTML page — **no Python backend at runtime**, hostable anywhere (GitHub Pages, Vercel, Netlify).

> **Trade-off:** `.ascf` files are larger than standard `.mp4`. In exchange you get true DOM-level interaction, pixel-perfect text selection, and zero dependency on browser video codecs.

### Option 1: Python Compiler *(Recommended)*

```bash
python compiler.py your_video.mp4 --cols 250 --pixel --quantize 2
```

| Flag | Description |
| :--- | :--- |
| `--quantize 0-3` | Drop color bits to reduce file size (0 = lossless, 3 = aggressive) |
| `--profile` | Enable DCT spatial compression — highest ratio, enforces `--pixel` |
| `--qf 1-100` | DCT quality factor (default: 70) |
| `--tolerance` | Color drift tolerance before a pixel update is sent |
| `--hard` | Max zlib compression (level 9) — slower compile, smaller output |

> This is what powers the live demo at [asciline.dev](https://www.asciline.dev).

<a id="browser-studio"></a>

### Option 2: Browser Studio *(Zero Install)*

`static_player/studio/` compiles video to `.ascf` **entirely client-side** — drop a video in, get a `.ascf` out, nothing ever leaves your browser.

🔗 **Try it:** [ASCILINE Studio](https://yusufb5.github.io/ASCILINE/static_player/studio/)

Includes a built-in preview with a **custom seekbar** for instant scrubbing. Natively decodes all compression tags including DCT.

> *The client-side encoder is conservative (RAW/ZLIB/DELTA only). For production output or maximum compression, use the Python compiler.*

<a id="playing-a-compiled-file"></a>

### Playing a Compiled File

| Method | How |
| :--- | :--- |
| **Drag & Drop** *(No server needed)* | Open `static_player/index.html` → drag `.ascf` + optional `.mp3` onto the page |
| **Local File Server** | `python -m http.server` in the project directory |

> **Infinite Playback & Low RAM:** The static player uses a rolling ~3s buffer. Rendered frames are instantly garbage-collected — no duration limit, near-zero memory footprint.

---

## 📥 Installation

### Prerequisites

| Requirement | Notes |
| :--- | :--- |
| **Python 3.9+** | Required |
| **FFmpeg & FFprobe** | Required for audio extraction and hover thumbnails |
| **Modern Browser** | Any browser with Canvas + WebSocket support |

### Step 1 — Clone

```bash
git clone https://github.com/YusufB5/ASCILINE.git
cd ASCILINE
```

### Step 2 — Install Dependencies

```bash
# Using pyproject.toml (recommended)
pip install .

# Or manually
pip install fastapi uvicorn opencv-python numpy websockets
```

> **Headless / server environments:** Use `opencv-python-headless` — a lighter drop-in that skips GUI dependencies.

**Optional — YouTube playback:**
```bash
pip install ".[ytdlp]"
```

### FFmpeg & FFprobe

```bash
# Package managers (recommended)
winget install ffmpeg          # Windows
brew install ffmpeg            # macOS
sudo apt install ffmpeg        # Linux
```

> **Manual (Windows):** Download the [FFmpeg ZIP](https://github.com/BtbN/FFmpeg-Builds/releases/latest), extract `ffmpeg.exe` + `ffprobe.exe` from `bin/`, and drop both next to `stream_server.py`.

### Step 3 — Launch

```bash
python stream_server.py video.mp4 --cols 240
```

Open **http://localhost:8000** in your browser. 🎉

---

## 🚀 Usage

### Single Video
```bash
python stream_server.py video.mp4 --cols 240
```

### YouTube / URL *(requires `ytdlp` extra)*
```bash
python stream_server.py "https://youtu.be/VIDEO_ID" --cols 240
python stream_server.py "https://www.youtube.com/playlist?list=..." --cols 220 --loop
```

### Folder Mode
```bash
python stream_server.py --folder videos --cols 200
python stream_server.py --folder videos --pixel --cols 320 --vol 2
```

### JSON Playlist
```bash
python stream_server.py --playlist playlist.json --cols 220 --loop
```

### Live Webcam
```bash
python stream_server.py --webcam --cols 240
python stream_server.py --webcam --webcam-device 1 --webcam-fps 60
python stream_server.py --webcam --no-mirror
```

### Terminal Mode *(No Browser)*
```bash
python ascii_video_player2.py video.mp4 --cols 100 --quality 0
python ascii_video_player2.py --webcam --cols 100
```

> ⚠️ Don't resize the terminal window during playback — dynamic text wrapping will corrupt the layout.

### YouTube Caching

| Behavior | Detail |
| :--- | :--- |
| **Download quality** | ≤480p (ASCII only needs a small grid) |
| **Cache location** | `videos/` directory, keyed by video ID |
| **Replays** | Instant from cache |
| **Normalization** | H.264/AAC constant frame rate for reliable A/V sync |
| **Size limit** | Configurable via `--cache-limit` (default: 10240 MB) |

```bash
python stream_server.py --cache-limit 5000   # Cap cache at 5 GB
```

---

## 🐳 Running with Docker

ASCILINE ships with `Dockerfile` + `docker-compose.yml` for the live streaming server. The image is based on `python:3.11-slim` with FFmpeg and `opencv-python-headless`.

### Docker Compose *(Recommended)*

```bash
docker compose up --build
```

Mounts `./videos` → `/app/videos`. Drop media files into your local `videos/` folder — no rebuild needed.

### Plain Docker

```bash
docker build -t asciline .
docker run -p 8000:8000 -v $(pwd)/videos:/app/videos asciline
```

Override defaults with CLI flags:
```bash
docker run -p 8000:8000 -v $(pwd)/videos:/app/videos asciline --folder videos --cols 220 --loop
```

> **YouTube in Docker:** `yt-dlp` isn't included by default. Add `RUN pip install ".[ytdlp]"` to the Dockerfile to enable URL playback.

---

## 🎨 Customization

### CSS Theming

Edit `style.css` to change accent colors and typography:
```css
:root {
    --accent-color: #00ff41; /* Matrix Green */
    --bg-color: #050505;
}
```

### Real-Time FX *(ASCII Modes)*

Press **F** or click **FX** on the player controls:

| Filter | Description |
| :--- | :--- |
| **Contrast** | Light/dark difference adjustment |
| **Brightness** | Overall lightness control |
| **Gamma** | Recover detail from dark/washed-out sources |
| **Sharpen** | Unsharp Mask, levels 0–10 |
| **Invert** | Invert all brightness values |
| **Palettes** | Swap character sets live: *Default* · *Flat/Anime* · *Block* |

### Rendering Modes

```bash
python stream_server.py --mode 6 --cols 240 --rows 100

# Pixel mode (highest color fidelity, no mode number needed)
python stream_server.py video.mp4 --pixel --cols 560
```

| Mode | Colors |
| :--: | :--- |
| `1` | Black & White (DOM) |
| `2` | 64 colors |
| `3` | 512 colors |
| `4` | 32K colors |
| `5` | 262K colors |
| `6` | 16M colors (ultra) |

> The `--pixel` flag operates independently and automatically applies the highest color fidelity.

### Resolution Guidelines

| Mode | Recommended `--cols` | Notes |
| :--- | :--- | :--- |
| ASCII | 200–240 | Best detail/performance balance at 30 FPS |
| Pixel | 600–900 | Near-HD quality; CPU-dependent |
| Default (no flag) | 200 (ASCII) / 450 (pixel) | — |

> **A/V sync tip:** If video falls behind audio, lower `--cols`. The engine auto-derives `--rows` from the source aspect ratio.

### Volume Control

```bash
python stream_server.py video.mp4 --vol 0   # Muted (no audio processing)
python stream_server.py video.mp4 --vol 3   # 1.5× volume
python stream_server.py video.mp4 --vol 5   # 2.0× volume
```

### Playlist Format

```json
[
    { "video": "intro.mp4",  "mode": 1, "vol": 1 },
    { "video": "main.mp4",   "pixel": true, "vol": 3, "cols": 520 },
    { "video": "https://youtu.be/VIDEO_ID", "mode": 4, "vol": 2, "cols": 240 }
]
```

---

## 🔧 Troubleshooting

| Issue | Fix |
| :--- | :--- |
| **A/V desync** | Lower `--cols` — your machine can't encode/send fast enough. See [Resolution Guidelines](#resolution-guidelines). |
| **`FileNotFoundError` for ffmpeg** | Install FFmpeg via package manager or drop binaries next to `stream_server.py`. |
| **Terminal playback garbles** | Don't resize the terminal during `ascii_video_player2.py` playback. |
| **YouTube playback fails** | Install the ytdlp extra: `pip install ".[ytdlp]"` |
| **Slow first YouTube play** | Expected — the server downloads & normalizes to H.264/AAC. Replays are instant from cache. |
| **Disk filling up** | Set a lower `--cache-limit` (in MB) to cap the LRU video cache. |
| **Studio output too large** | Browser encoder is conservative (RAW/ZLIB/DELTA only). Use `compiler.py` for production output. |

---

## 🌐 Live Demo

Experience ASCILINE in your browser across multiple rendering modes:

<div align="center">

### **[🔗 asciline.dev](https://www.asciline.dev)**

</div>

---

## ⭐ Star History

[![Star History Chart](https://stars.unv.one/svg/YusufB5/ASCILINE?theme=dark)](https://github.com/YusufB5/ASCILINE)

---

## 👥 Community

- 💬 **Discord:** [Join the ASCILINE Server](https://discord.gg/9bpWwx9EHV)
- 📖 **Contributing:** See [CONTRIBUTING.md](CONTRIBUTING.md)
- 📧 **Contact:** [asciline.engine@gmail.com](mailto:asciline.engine@gmail.com)

---

## 📄 License

ASCILINE is distributed under a **Custom License (Based on MIT)** with an anti-advertisement clause. See [LICENSE](LICENSE) for the full text.

---

<a id="support"></a>

## Support ❤️

If you find this project useful, consider supporting its development:

<div align="center">

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor_on_GitHub-ea4aaa?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/YusufB5)

| Currency | Address |
| :--- | :--- |
| **Solana** (SOL / USDC) | `H1wSQAhjgsu7AxenF4e5ZBYiBjkhDLVzkKaZuVPcrE14` |
| **Ethereum** (ETH / USDT) | `0x85B2f970045c0F7c282089Ab6CF897C20230e086` |
| **Bitcoin** (BTC) | `bc1qvtcl55v54gkzwnp2zxn70usea3gf5ncncqa0fv` |

</div>

---

<div align="center">

**Built with ❤️ for the terminal-art community**

</div>
