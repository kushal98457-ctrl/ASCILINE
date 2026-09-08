"""
Bounded frame queue for ASCILINE.

Old frames are discarded when the encoder falls behind.
This keeps playback close to real-time.
"""

from __future__ import annotations

import queue
from dataclasses import dataclass
from typing import Any


@dataclass
class QueuedFrame:
    frame: Any
    timestamp: float
    frame_number: int


class FrameQueue:
    def __init__(self, max_size: int = 3):
        self.queue = queue.Queue(maxsize=max_size)

        self.dropped_frames = 0

    def put(self, frame: QueuedFrame) -> None:
        try:
            self.queue.put_nowait(frame)
            return
        except queue.Full:
            pass

        # Drop the oldest frame.
        try:
            self.queue.get_nowait()
            self.dropped_frames += 1
        except queue.Empty:
            pass

        try:
            self.queue.put_nowait(frame)
        except queue.Full:
            self.dropped_frames += 1

    def get(self, timeout: float | None = None) -> QueuedFrame:
        return self.queue.get(timeout=timeout)

    def empty(self) -> bool:
        return self.queue.empty()

    def qsize(self) -> int:
        return self.queue.qsize()

    def clear(self) -> None:
        while True:
            try:
                self.queue.get_nowait()
            except queue.Empty:
                break
