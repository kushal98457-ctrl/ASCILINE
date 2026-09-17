"""
Tests for security hardening features in stream_server.py:
- Origin validation and --allow-no-origin
- LRU bounded scrub cache
- Lock cleanup in safe_resolve_video_path
- Upload permissions, rate limiting, and disk quota enforcement
"""
import asyncio
import os
import sys
import tempfile
import time
import unittest
from unittest.mock import MagicMock
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import stream_server as ss


class SecurityHardeningTests(unittest.TestCase):
    def test_origin_allowed(self):
        # Localhost / loopback allowed
        self.assertTrue(ss._origin_allowed("http://localhost:8000"))
        self.assertTrue(ss._origin_allowed("http://127.0.0.1:8000"))
        self.assertTrue(ss._origin_allowed("https://127.0.0.1"))

        # Same origin with matching host header allowed
        self.assertTrue(ss._origin_allowed("http://192.168.1.100:8000", host_header="192.168.1.100:8000"))

        # Cross-site origin rejected
        self.assertFalse(ss._origin_allowed("http://attacker.com", host_header="192.168.1.100:8000"))
        self.assertFalse(ss._origin_allowed("http://malicious.org"))

        # No origin header behavior
        self.assertTrue(ss._origin_allowed(None, allow_no_origin=True))
        self.assertFalse(ss._origin_allowed(None, allow_no_origin=False))

    def test_scrub_cache_lru_bounded(self):
        ss._scrub_cache.clear()
        for i in range(10):
            key = f"fake_video_{i}.mp4"
            while len(ss._scrub_cache) >= ss.MAX_SCRUB_CACHE_ENTRIES:
                ss._scrub_cache.popitem(last=False)
            ss._scrub_cache[key] = {"meta": {"count": i}, "jpeg": b"fake"}

        self.assertEqual(len(ss._scrub_cache), ss.MAX_SCRUB_CACHE_ENTRIES)
        self.assertNotIn("fake_video_0.mp4", ss._scrub_cache)
        self.assertNotIn("fake_video_1.mp4", ss._scrub_cache)
        self.assertIn("fake_video_9.mp4", ss._scrub_cache)
        ss._scrub_cache.clear()

    def test_download_locks_pruned(self):
        vid = "https://youtube.com/watch?v=fake_test_id"
        ss._download_locks.clear()

        async def run_lock_test():
            original_resolve = ss.resolve_video_path
            try:
                ss.resolve_video_path = lambda v: "/path/to/downloaded.mp4"
                await ss.safe_resolve_video_path(vid)
            finally:
                ss.resolve_video_path = original_resolve

        asyncio.run(run_lock_test())
        self.assertNotIn(vid, ss._download_locks)

    def test_upload_disabled_by_config(self):
        ss.app.state.allow_upload = False
        fake_request = MagicMock()
        fake_file = MagicMock()

        try:
            with self.assertRaises(HTTPException) as cm:
                asyncio.run(ss.upload_video(fake_request, fake_file))
            self.assertEqual(cm.exception.status_code, 403)
        finally:
            ss.app.state.allow_upload = True

    def test_upload_rate_limiting(self):
        ss.app.state.allow_upload = True
        fake_request = MagicMock()
        fake_request.client.host = "192.0.2.42"
        ss._upload_rate_limits[fake_request.client.host] = [time.time()] * ss.MAX_UPLOADS_PER_MINUTE
        fake_file = MagicMock()

        with self.assertRaises(HTTPException) as cm:
            asyncio.run(ss.upload_video(fake_request, fake_file))
        self.assertEqual(cm.exception.status_code, 429)

        ss._upload_rate_limits.pop(fake_request.client.host, None)

    def test_upload_quota_enforcement(self):
        with tempfile.TemporaryDirectory(prefix="asciline_test_uploads_") as tmp_dir:
            orig_dir = ss.UPLOAD_DIR
            orig_cap = ss.MAX_UPLOADS_TOTAL_BYTES
            try:
                ss.UPLOAD_DIR = tmp_dir
                ss.MAX_UPLOADS_TOTAL_BYTES = 1000

                f1 = os.path.join(tmp_dir, "file1.mp4")
                f2 = os.path.join(tmp_dir, "file2.mp4")
                f3 = os.path.join(tmp_dir, "file3.mp4")

                with open(f1, "wb") as f:
                    f.write(b'A' * 400)
                time.sleep(0.02)
                with open(f2, "wb") as f:
                    f.write(b'B' * 400)
                time.sleep(0.02)
                with open(f3, "wb") as f:
                    f.write(b'C' * 400)

                ss._enforce_upload_quota()

                self.assertFalse(os.path.exists(f1))
                self.assertTrue(os.path.exists(f2))
                self.assertTrue(os.path.exists(f3))
            finally:
                ss.UPLOAD_DIR = orig_dir
                ss.MAX_UPLOADS_TOTAL_BYTES = orig_cap


if __name__ == '__main__':
    unittest.main(verbosity=2)
