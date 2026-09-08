"""
ASCILINE Performance Monitor

Tracks:
- FPS
- frame processing time
- encode time
- dropped frames
- queue depth
- bandwidth

Designed to have zero external dependencies.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass


@dataclass
class PerformanceSnapshot:
    fps: float
    frame_time_ms: float
    dropped_frames: int
    queue_depth: int
    bandwidth_mbps: float


class PerformanceMonitor:
    def __init__(self, window_size: int = 60):
        self.window_size = max(10, window_size)

        self._frame_times = deque(maxlen=self.window_size)
        self._bytes_sent = deque(maxlen=self.window_size)

        self._last_frame_time = None
        self._last_bandwidth_time = time.perf_counter()

        self.dropped_frames = 0

    def frame_started(self) -> None:
        self._last_frame_time = time.perf_counter()

    def frame_finished(self, bytes_sent: int = 0) -> None:
        if self._last_frame_time is None:
            return

        elapsed = time.perf_counter() - self._last_frame_time

        self._frame_times.append(elapsed)
        self._bytes_sent.append(bytes_sent)

    def frame_dropped(self) -> None:
        self.dropped_frames += 1

    @property
    def fps(self) -> float:
        if not self._frame_times:
            return 0.0

        average_time = sum(self._frame_times) / len(self._frame_times)

        if average_time <= 0:
            return 0.0

        return 1.0 / average_time

    @property
    def frame_time_ms(self) -> float:
        if not self._frame_times:
            return 0.0

        return (
            sum(self._frame_times)
            / len(self._frame_times)
            * 1000.0
        )

    @property
    def bandwidth_mbps(self) -> float:
        now = time.perf_counter()
        elapsed = now - self._last_bandwidth_time

        if elapsed <= 0:
            return 0.0

        total_bytes = sum(self._bytes_sent)

        return (total_bytes * 8) / elapsed / 1_000_000

    def snapshot(self, queue_depth: int = 0) -> PerformanceSnapshot:
        return PerformanceSnapshot(
            fps=self.fps,
            frame_time_ms=self.frame_time_ms,
            dropped_frames=self.dropped_frames,
            queue_depth=queue_depth,
            bandwidth_mbps=self.bandwidth_mbps,
        )

    def reset_dropped_frames(self) -> None:
        self.dropped_frames = 0
