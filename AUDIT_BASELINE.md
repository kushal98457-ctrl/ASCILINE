# ASCILINE Repository Audit Baseline

**Branch:** `chore/repo-repair`  
**Date:** September 16, 2026

## 1. Physical Metrics
- **Total Disk Size:** 65.88 MB (69,083,882 bytes)
- **Total File Count:** 1,164 files
- **Git Tracked Files:** 975 files (heavily inflated by `ASCILINE/frontend-v2/node_modules/` committed to git)

## 2. Test Suite Status

### Python (`pytest`)
- **Root execution (`pytest` from repo root):** **FAILED**
  - Result: 6 collection errors during collection (`ModuleNotFoundError: No module named 'core'` and `import file mismatch` due to duplicate files in `ASCILINE/test/` vs `test/`).
- **Subdirectory execution (`pytest` from `ASCILINE/`):** **FAILED**
  - Result: 6 failed, 8 passed, 6 skipped.
  - Failures: `test/test_ytdl.py` failed due to missing `yt-dlp` dependency (`RuntimeError: yt-dlp is not installed`).

### Frontend V2 (`npm test`)
- **Local Windows execution (`npm test` in `ASCILINE/frontend-v2`):** Passed locally (36 passed across 5 test files).
- **CI / Linux execution:** **FAILED** (`Cannot find module @rollup/rollup-linux-x64-gnu` because committed `node_modules` contains Windows-specific binaries).

## 3. Structural Deficiencies Documented
- **B1:** Real project nested in `ASCILINE/`, root contains duplicate stub files.
- **B2:** GitHub Actions workflow at `ASCILINE/.github/workflows/ci.yml` never executes.
- **B3:** `frontend-v2/node_modules` is tracked in git.
- **B4:** Root `app.js` is a placeholder stub.
- **B5:** Root `core/` package is orphaned/dead code.
- **B6:** `process_html_pro.py` crashes on import.
- **B7–B9:** V2 live client has broken playback, timeline seeking, and backpressure logic.
