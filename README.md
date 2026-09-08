# ASCILINE

### Real-Time ASCII Video Rendering Engine

**ASCILINE** is a high-performance video rendering engine that transforms conventional video frames into real-time **ASCII and pixel-based visual streams**.

Instead of relying on the browser's traditional `<video>` pipeline, ASCILINE decodes, transforms, compresses, and streams video frames through a custom rendering pipeline — turning the browser into a programmable visual canvas.

> **Video → Frame Processing → ASCII / Pixel Encoding → Binary Streaming → Canvas Rendering**

---

## ✨ Highlights

* 🎬 **Real-time ASCII video rendering**
* ⚡ **Low-latency WebSocket streaming**
* 🖥️ **HTML5 Canvas-based renderer**
* 🎨 **Multiple color-fidelity modes**
* 🧱 **High-fidelity Pixel Mode**
* 🔊 **Audio / Video synchronization**
* 📦 **Custom binary frame protocol**
* 🗜️ **Optional frame compression**
* 🧩 **Standalone `.ascf` compilation pipeline**
* 🌐 **Static browser player**
* 📋 **JSON-based playlists**
* ▶️ **Single-video and playlist playback**
* 🔁 **Infinite playback / looping**
* 📐 **Automatic aspect-ratio scaling**
* 🧰 **CLI-based configuration**
* 🖥️ **Windows / macOS / Linux support**

---

# 🎥 What Makes ASCILINE Different?

Traditional video playback looks like:

```text
Video File
    ↓
Browser Video Decoder
    ↓
GPU / Hardware Acceleration
    ↓
Screen
```

ASCILINE uses a different pipeline:

```text
                ┌─────────────────┐
                │   Video Source  │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │  Frame Decoder  │
                │    OpenCV       │
                └────────┬────────┘
                         ↓
                ┌─────────────────┐
                │ Frame Processor  │
                │ NumPy / Mapping │
                └────────┬────────┘
                         ↓
             ┌───────────┴───────────┐
             ↓                       ↓
       ASCII Encoding           Pixel Encoding
             ↓                       ↓
             └───────────┬───────────┘
                         ↓
                ┌─────────────────┐
                │ Binary Protocol │
                └────────┬────────┘
                         ↓
                   WebSocket
                         ↓
                ┌─────────────────┐
                │ Browser Client  │
                │ HTML5 Canvas    │
                └────────┬────────┘
                         ↓
                     Display
```

This architecture allows the visual representation of video to become **programmable data** rather than simply a conventional media stream.

---

# 🧠 Core Architecture

ASCILINE is divided into several major components.

### 1. Video Decoder

Responsible for:

* Opening video sources
* Reading frames
* Extracting FPS and resolution
* Managing frame timing
* Handling different input sources

Primary technologies:

* Python
* OpenCV
* NumPy

---

### 2. ASCII Renderer

Converts frame luminance and color information into character-based representations.

Example:

```text
        .:-=+*#%@#
     .:-=+*#%@#*+=-:
   .:-=+*#%@#*+=-:. 
```

The renderer can dynamically control:

* Character density
* Output resolution
* Brightness
* Contrast
* Gamma
* Sharpening
* Character palettes
* Color depth

---

### 3. Pixel Renderer

Pixel Mode replaces traditional ASCII characters with colored block characters.

This provides significantly higher visual fidelity while preserving the text-based rendering architecture.

---

### 4. Binary Frame Protocol

ASCILINE does not need to send large HTML strings for every frame.

Frames can be encoded into compact binary structures and transmitted through WebSockets.

```text
Frame
 ↓
Encode
 ↓
Compress
 ↓
Binary Packet
 ↓
WebSocket
 ↓
Decode
 ↓
Canvas
```

This reduces unnecessary protocol overhead and improves real-time playback performance.

---

### 5. Browser Renderer

The frontend receives frame data and renders it through an HTML5 Canvas.

The renderer manages:

* Frame buffering
* Rendering timing
* FPS synchronization
* Resolution
* Playback controls
* Visual effects
* Filters
* Palettes

---

# 🎨 Rendering Modes

ASCILINE supports multiple visual fidelity levels.

| Mode | Description         |
| ---- | ------------------- |
| `1`  | Black & White       |
| `2`  | Low-color rendering |
| `3`  | Medium color        |
| `4`  | High color          |
| `5`  | Very high color     |
| `6`  | 16M-color / Ultra   |

Example:

```bash
python stream_server.py video.mp4 --mode 6 --cols 240
```

---

# 🧱 Pixel Mode

Pixel Mode provides higher visual fidelity by using colored block characters instead of conventional ASCII characters.

```bash
python stream_server.py video.mp4 --pixel --cols 600
```

Pixel Mode is substantially more computationally demanding than standard ASCII rendering.

Performance depends on:

* CPU
* Memory
* Video resolution
* Number of columns
* Source FPS
* Compression settings

---

# ⚡ Performance

ASCILINE is designed around real-time playback rather than maximum visual resolution at any cost.

Recommended starting points:

### ASCII Mode

```bash
--cols 200
```

to

```bash
--cols 240
```

### Pixel Mode

```bash
--cols 600
```

to

```bash
--cols 900
```

Higher resolutions increase:

* Frame-processing cost
* Encoding cost
* Network bandwidth
* Browser rendering workload
* Memory usage

If the renderer cannot process frames fast enough, reduce `--cols`.

---

# 🔊 Audio Synchronization

ASCILINE uses audio timing as the playback reference to maintain synchronization between the generated video stream and audio.

The pipeline is approximately:

```text
Audio Clock
     │
     ├───────────────┐
     ↓               ↓
Video Timing     Frame Rendering
     │               │
     └────── Sync ───┘
```

If the backend cannot encode frames quickly enough, reducing the rendering resolution is recommended.

---

# 📦 Installation

## Requirements

* Python **3.9+**
* FFmpeg
* FFprobe
* Modern web browser
* Git

Install Python dependencies:

```bash
pip install fastapi uvicorn opencv-python numpy websockets
```

Optional YouTube / URL support:

```bash
pip install yt-dlp
```

---

# 🔧 FFmpeg Setup

FFmpeg is required for audio processing and certain video operations.

### Windows

```bash
winget install ffmpeg
```

### macOS

```bash
brew install ffmpeg
```

### Linux

```bash
sudo apt install ffmpeg
```

Verify:

```bash
ffmpeg -version
ffprobe -version
```

---

# 🚀 Quick Start

Clone the repository:

```bash
git clone <YOUR_REPOSITORY_URL>
cd ASCILINE
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start a video:

```bash
python stream_server.py video.mp4 --cols 240
```

Then open the local player in your browser.

---

# 🌐 URL / YouTube Playback

ASCILINE can optionally process URLs supported by `yt-dlp`.

Example:

```bash
python stream_server.py "VIDEO_URL" --cols 240
```

Playlist example:

```bash
python stream_server.py "PLAYLIST_URL" --cols 220 --loop
```

Downloads are cached locally to avoid repeatedly downloading the same content.

---

# 🗂️ Playlist System

Videos can be configured through `playlist.json`.

Example:

```json
[
    {
        "video": "intro.mp4",
        "mode": 1,
        "vol": 1
    },
    {
        "video": "main.mp4",
        "mode": 6,
        "pixel": true,
        "vol": 3,
        "cols": 520
    },
    {
        "video": "outro.mp4",
        "mode": 4,
        "vol": 2,
        "cols": 240
    }
]
```

Each video can define its own:

* Rendering mode
* Pixel mode
* Resolution
* Volume
* Playback configuration

---

# 🧩 Static Compilation

ASCILINE also supports compiling videos into a custom:

```text
.ascf
```

format.

Example:

```bash
python compiler.py video.mp4 --cols 250 --pixel
```

The compiled file can then be played through the static player without requiring the Python backend during playback.

```text
Video
 ↓
ASCILINE Compiler
 ↓
.ascf
 ↓
Static Player
 ↓
HTML5 Canvas
```

This makes the compiled output suitable for static hosting environments.

---

# 🖥️ Static Player

The project contains a standalone player under:

```text
static_player/
```

It can be used to play compiled `.ascf` files directly in the browser.

The static player is designed to minimize runtime dependencies and maintain a rolling playback buffer rather than loading an entire video into memory.

---

# 🎛️ Real-Time Visual Processing

ASCILINE includes frontend-side visual controls such as:

* Brightness
* Contrast
* Gamma
* Sharpening
* Inversion
* ASCII palettes
* Rendering adjustments

This allows the visual appearance of the stream to be modified without re-encoding the original video.

---

# 📐 Automatic Scaling

ASCILINE requires primarily a column count rather than manually specifying both dimensions.

Example:

```bash
python stream_server.py video.mp4 --cols 240
```

The renderer calculates the appropriate number of rows based on the source video's aspect ratio.

Example:

```text
1920 × 1080
      ↓
240 columns
      ↓
~135 logical rows
```

This prevents unnecessary stretching and simplifies configuration.

---

# 🔊 Volume Control

Volume can be configured using:

```bash
--vol
```

Example:

```bash
python stream_server.py video.mp4 --vol 3
```

Mute:

```bash
python stream_server.py video.mp4 --vol 0
```

Setting volume to `0` can avoid unnecessary audio processing.

---

# 📁 Project Structure

```text
ASCILINE/
│
├── static_player/          # Standalone browser player
│
├── test/                   # Tests and experiments
├── experiments/            # Experimental implementations
├── videos/                 # Local video/cache directory
│
├── ascii_video_player2.py  # Terminal ASCII player
├── stream_server.py        # Streaming backend
├── compiler.py             # ASCILINE compiler
├── codec.py                # Python codec
├── codec.js                # Browser codec
│
├── app.js                  # Frontend application
├── index.html              # Web interface
├── style.css               # UI styling
│
├── playlist.json           # Playlist configuration
├── ytdl.py                 # URL/video handling
├── logo.py                 # ASCII branding
│
├── requirements.txt        # Python dependencies
├── Dockerfile              # Container configuration
├── docker-compose.yml      # Docker deployment
├── CONTRIBUTING.md         # Contribution guidelines
└── LICENSE                 # Project license
```

---

# 🐳 Docker

ASCILINE also includes containerization support.

Build:

```bash
docker build -t asciline .
```

Run:

```bash
docker run -p 8000:8000 asciline
```

For multi-container configuration:

```bash
docker compose up --build
```

---

# 🧪 Development

Run the project locally:

```bash
python stream_server.py video.mp4 --cols 240
```

For development, keep experimental implementations isolated under:

```text
experiments/
```

Tests are maintained under:

```text
test/
```

---

# 🛠️ Troubleshooting

### Video/audio becomes desynchronized

Your machine may not be processing frames fast enough.

Try:

```bash
--cols 160
```

or:

```bash
--cols 200
```

---

### FFmpeg not found

Verify:

```bash
ffmpeg -version
```

If unavailable, install FFmpeg and ensure it is available through your system PATH.

---

### YouTube playback fails

Install:

```bash
pip install yt-dlp
```

---

### High CPU usage

Reduce:

```bash
--cols
```

and/or switch from Pixel Mode to ASCII Mode.

---

### Browser playback is unstable

Try lowering:

* Rendering resolution
* FPS
* Pixel density
* Color complexity

---

# 🗺️ Roadmap

ASCILINE is designed to evolve into a broader programmable media-rendering platform.

### Current

* [x] Real-time ASCII rendering
* [x] Pixel rendering
* [x] WebSocket streaming
* [x] Canvas rendering
* [x] Multiple color modes
* [x] Audio synchronization
* [x] Playlist support
* [x] URL / YouTube support
* [x] Static `.ascf` compilation
* [x] Standalone browser player
* [x] Visual filters
* [x] Docker support

### Planned

* [ ] GPU-accelerated frame processing
* [ ] Adaptive bitrate / resolution
* [ ] Better compression algorithms
* [ ] Hardware acceleration
* [ ] Advanced frame interpolation
* [ ] Distributed rendering
* [ ] Improved mobile support
* [ ] WebGPU renderer
* [ ] Plugin architecture
* [ ] Advanced benchmarking suite
* [ ] Production-grade observability

---

# 🧪 Design Philosophy

ASCILINE is built around a simple idea:

> **Video does not have to be rendered as video.**

By converting visual information into structured, programmable representations, ASCILINE creates a different media pipeline where rendering, compression, interaction, and visual effects can be controlled at the frame level.

The project explores the intersection of:

```text
Computer Vision
      +
Video Processing
      +
Compression
      +
Real-Time Networking
      +
Web Rendering
      +
Generative / Text-Based Visuals
```

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/my-feature
```

3. Implement your changes
4. Test the implementation
5. Commit your changes

```bash
git commit -m "Add: my feature"
```

6. Push the branch

```bash
git push origin feature/my-feature
```

7. Open a Pull Request

Please read `CONTRIBUTING.md` before submitting significant changes.

---

# 📜 License

ASCILINE is distributed under the license included in this repository.

See:

```text
LICENSE
```

for the complete terms and conditions.

---

# ⭐ Project

If you find ASCILINE interesting, consider giving the repository a ⭐.

It helps the project gain visibility and encourages further development.

---

## Built With

**Python** · **OpenCV** · **NumPy** · **FastAPI** · **WebSockets** · **JavaScript** · **HTML5 Canvas** · **FFmpeg**

---

<p align="center">

### ASCILINE

**Turning video into programmable visual data.**

</p>
