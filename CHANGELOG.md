# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-09-17

### Added
- **WebGPU Client (Frontend V2)**: High-performance TypeScript + Vite workstation with hardware-accelerated WebGPU rendering, WGSL shaders, Canvas 2D fallback, and Vitest test suite.
- **Security & Resource Hardening**:
  - LRU disk quota on uploads/ directory capped at 5 GB to prevent disk exhaustion.
  - Per-IP rate limiting on /upload endpoint (max 10 requests per minute).
  - Configurable upload permission flags (--allow-upload / --no-allow-upload).
  - Strict WebSocket origin validation (_origin_allowed) and --allow-no-origin flag.
  - Bounded LRU cache for scrub preview sprites (max 8 entries).
  - Maximum concurrent WebSocket client limit (--max-clients, default: 4) returning close code 1013 on exhaustion.
  - Non-root sciline user, healthcheck, and optimized dependencies in Dockerfile.
- **Core Architecture & Telemetry**:
  - Integrated core.AdaptiveController and core.PerformanceMonitor into the streaming pipeline.
  - Sub-second keyframe seek accuracy using direct OpenCV timestamp mapping (CAP_PROP_POS_MSEC).
  - Generation tracking to eliminate producer/reinit race conditions during dynamic resolution swaps.
- **CI & Quality Assurance**:
  - Full GitHub Actions workflow (.github/workflows/ci.yml) validating Python, Vitest, TypeScript type checks, and Docker builds.
  - Cross-language bit-exact test vectors verifying Python encoder (codec.py) against JS decoder (codec.js).
  - Split runtime dependencies (
equirements.txt) from test dependencies (
equirements-dev.txt).

### Changed
- Flattened nested repository structure: removed redundant subdirectories, eliminated dead/stub files, and unified module paths at root.
- Replaced blocking console REPL exit (os._exit) with graceful server shutdown handlers.
- Purged committed 
ode_modules, build artifacts, and development scratch scripts.

---

## [0.1.0] - Initial Release

### Added
- Real-time Video-to-ASCII and colored Pixel streaming engine built with Python, FastAPI, and OpenCV.
- Adaptive binary wire protocol supporting raw, zlib, and lossy delta compression modes.
- Audio/video synchronized streaming via FFmpeg pipes.
- YouTube and remote video streaming integration via yt-dlp.
- Web UI workstation for playback and real-time palette/contrast/gamma controls.
