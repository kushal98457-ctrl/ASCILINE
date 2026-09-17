# ASCILINE Test Suite & Fixtures

This directory contains test suites and test fixtures for ASCILINE, validating the Python server, wire codec, backpressure mechanisms, and security controls.

---

## Structure

```
test/
├── _gap_fixture.py               # Fixture generator for backpressure gap testing
├── test_backpressure_gap.js      # JS integration test for gap handling
├── test_backpressure_live.js     # JS integration test for live stream backpressure
├── test_backpressure_threshold.py# Python test for client queue depth and threshold limits
├── test_close_code.js            # WebSocket close code verification
├── test_e2e.js                   # End-to-end WebSocket stream playback test
├── test_scrub.py                 # Scrub thumbnail generation & caching tests
├── test_security_hardening.py    # Origin validation, upload quota, rate limits & locks
├── test_ytdl.py                  # YouTube URL resolver and cache tests
├── test_ytdl_hardening.py        # yt-dlp command sanitization and edge-case tests
└── test_ytdl_normalize.py        # Stream normalization tests

experiments/
├── gen_vectors.py                # Generates binary wire codec vectors from Python
├── check_vectors.js              # Verifies bit-exact decoding in JS/Node
├── profile_vectors.py            # Generates benchmark profile payload vectors
├── check_profile.js              # Verifies wire profile compatibility
└── make_test_clips.sh            # Helper script to generate synthetic test MP4s
```

---

## Running Tests

### 1. Python Unit Tests

Run all unit tests using pytest:

```bash
pytest -v
```

Or target specific modules:

```bash
pytest test/test_security_hardening.py -v
pytest test/test_backpressure_threshold.py -v
pytest test/test_scrub.py -v
```

### 2. Frontend-v2 Vitest Suite

Run frontend unit tests and type checks:

```bash
cd frontend-v2
npm ci
npm run typecheck
npm test
npm run build
```

### 3. Bit-Exact Codec Verification (CI Vectors)

The binary wire protocol between codec.py and codec.js is verified for bit-exactness:

```bash
# Generate vectors using Python encoder
python experiments/gen_vectors.py test_vectors.bin

# Verify with Node.js decoder
node experiments/check_vectors.js test_vectors.bin
```

### 4. Wire Profile Verification

```bash
python experiments/profile_vectors.py profile_vectors.bin
node experiments/check_profile.js profile_vectors.bin
```

### 5. Node.js WebSocket Integration Tests

```bash
# Verify close codes
node test/test_close_code.js

# Verify backpressure live handling (requires running server)
node test/test_backpressure_live.js
```
