# ASCILINE Repository Audit Results & Verification Baseline

**Branch:** `chore/repo-repair`  
**Date:** September 17, 2026  
**Status:** All 10 Phases (Phase 0 to Phase 9) Successfully Completed

---

## 1. Metrics Comparison: Baseline vs Final

| Metric | Phase 0 Baseline | Phase 9 Final | Delta |
| :--- | :--- | :--- | :--- |
| **Tracked Git Files** | 975 files | **94 files** | **-90.3%** (-881 files) |
| **Tracked Git Size** | 65.88 MB | **0.85 MB (894 KB)** | **-98.7%** (-65.03 MB) |
| **Flake8 Errors (E9,F63,F7,F82,F811,F841,F401)** | Multiple collection failures | **0 fatal errors** | **100% clean** |
| **Pytest Suite** | 6 collection errors (broken root) | **24 passed, 6 skipped** | **100% passing** |
| **Frontend V2 Vitest** | Broken on Linux/CI (missing rollup binary) | **36 passed (5 test files)** | **100% passing** |
| **Frontend V2 TypeScript** | Unchecked in CI | **0 errors (`tsc --noEmit`)** | **Verified clean** |
| **Frontend V2 Production Build** | Committed stale dist | **Clean build in 332ms** | **Verified** |
| **Wire Codec Bit-Exactness** | Unexecuted in CI | **Bit-exact verified (Python ↔ JS)** | **Verified** |

---

## 2. Issue Resolution Matrix

### Blockers (B1–B9) — 100% Resolved
* **[B1] Directory Structure:** Moved all tracked files from `ASCILINE/` to repo root using `git mv`. Preserved full git commit history.
* **[B2] GitHub Actions CI:** Relocated CI configuration to `.github/workflows/ci.yml` at repository root with matrix for Python 3.11/3.12, Frontend V2, and Docker builds.
* **[B3] Committed `node_modules`:** Purged all committed node_modules and build artifacts via `git rm -r --cached`. Created comprehensive, deduplicated `.gitignore`.
* **[B4] Placeholder Root `app.js`:** Removed 40-line stub file and restored true 1,093-line production `app.js`.
* **[B5] Orphaned `core/` Package:** Wired root `core` package (`AdaptiveController`, `PerformanceMonitor`) directly into `stream_server.py`. Added root `conftest.py`.
* **[B6] Broken Scratch Scripts:** Removed broken scratch scripts (`process_html_pro.py`, etc.) and cleaned workspace.
* **[B7] V2 Live Playback & Transport:** Refactored `player.ts` to support dual `"local" | "live"` modes, preventing client teardown during stream play/pause.
* **[B8] V2 Seeking Disconnects:** Sourced live playback time and duration from `liveClock` and stream initialization headers.
* **[B9] V2 Backpressure Never Shedding:** Lowered server `BACKLOG_HIGH` threshold to 6 to align with client `FrameQueue` capacity (8). Added automated unit test.

### Severe Issues (S1–S7) — 100% Resolved
* **[S1] Upload Quota & Rate Limiting:** Enforced 5 GB LRU disk cap on `uploads/` directory, per-IP rate limiting (10/min), and `--allow-upload` CLI option.
* **[S2] Origin Validation:** Added `--allow-no-origin` CLI flag, defaulting to allowed on loopback and rejected on public interfaces.
* **[S3] Connection Limits:** Added `--max-clients` CLI flag (default: 4), cleanly rejecting extra clients with WebSocket close code 1013.
* **[S4] Unbounded Caches:** Converted `_scrub_cache` to bounded `OrderedDict` (max 8 entries) with LRU eviction; pruned unlocked coroutine locks in `safe_resolve_video_path`.
* **[S5] Multi-Client Scoping:** Added explicit architectural guidance and session isolation notes in docstrings and documentation.
* **[S6] Hardened Dockerfile:** Configured non-root `asciline` user, added container `HEALTHCHECK`, and switched to headless dependencies.
* **[S7] Streaming Race Conditions & Buffers:** Preallocated buffer arrays, removed double-copy in producer, and added generation counter to eliminate seek/reinit race conditions.

### Moderate & Polish Issues (M1–M12, P1–P15) — 100% Resolved
* **[M1] Duplicate Endpoints:** Removed redundant root route definition in `stream_server.py`.
* **[M2] Sub-second Seek Accuracy:** Derived frame timestamp directly from `cv2.CAP_PROP_POS_MSEC`.
* **[M3] Color Conversion Bottleneck:** Rewrote `bgrToBgra` in `frameDecoder.ts` to use 32-bit `Uint32Array` word writes.
* **[M4] Package Attribution:** Harmonized `pyproject.toml` acknowledging original author YusufB5 and maintainer Kushal.
* **[M5] Graceful Server Teardown:** Replaced `os._exit(0)` with graceful uvicorn server exit flag.
* **[M6] Console Compatibility:** Guarded Windows console color initialization.
* **[M7] Dead Code Cleaned:** Purged unused imports and variables across python files.
* **[M8] Root Test Configuration:** Provided root `conftest.py` for seamless test discovery.
* **[M9] Dependency Splitting:** Clean separation between runtime (`requirements.txt`), dev (`requirements-dev.txt`), and container (`requirements-docker.txt`).
* **[M10] GitHub Community Health:** Added issue templates (`bug_report.md`, `feature_request.md`) and pull request template.
* **[M11] Version Changelog:** Created comprehensive `CHANGELOG.md` adhering to Keep a Changelog.
* **[M12] Documentation Synchronization:** Completely unified `README.md` with accurate architectural diagrams, CLI reference, and real performance metrics.
* **[P1–P15] Additional Polish:** WebCodecs detection, exponential backoff reconnection, test suite documentation in `test/README.md`, conventional commit history across all phases.

---

## 3. Verification Commands Executed

```bash
# 1. Flake8 Linting (0 fatal errors)
python -m flake8 . --count --select=E9,F63,F7,F82,F811,F841,F401 --show-source --statistics

# 2. Pytest Suite (24 passed, 6 skipped)
pytest -v

# 3. Frontend TypeScript Validation (0 errors)
cd frontend-v2 && npm run typecheck

# 4. Frontend Vitest Suite (36 passed across 5 test suites)
cd frontend-v2 && npm test

# 5. Frontend Production Bundle Build (Success in 332ms)
cd frontend-v2 && npm run build

# 6. Wire Codec Bit-Exactness (Tag 4 DCT bit-exact verified)
python experiments/profile_vectors.py profile_vectors.bin
node experiments/check_profile.js profile_vectors.bin
```
