"""
ASCILINE Adaptive Quality Controller.

Automatically adjusts:
- resolution
- FPS

based on frame processing performance.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AdaptiveConfig:
    min_columns: int = 80
    max_columns: int = 320

    min_fps: int = 15
    max_fps: int = 60

    target_frame_margin: float = 0.85

    scale_down: float = 0.90
    scale_up: float = 1.05


class AdaptiveController:
    def __init__(
        self,
        columns: int = 240,
        target_fps: int = 60,
        config: AdaptiveConfig | None = None,
    ):
        self.config = config or AdaptiveConfig()

        self.columns = columns
        self.target_fps = target_fps

        self._healthy_frames = 0
        self._overloaded_frames = 0

    @property
    def frame_budget(self) -> float:
        return 1.0 / max(self.target_fps, 1)

    def update(
        self,
        processing_time: float,
        queue_depth: int = 0,
    ) -> bool:
        """
        Update quality based on current processing performance.

        Returns True if quality changed.
        """

        overloaded = (
            processing_time
            > self.frame_budget * self.config.target_frame_margin
            or queue_depth >= 4
        )

        if overloaded:
            self._overloaded_frames += 1
            self._healthy_frames = 0
        else:
            self._healthy_frames += 1
            self._overloaded_frames = 0

        changed = False

        # Reduce quality only after sustained overload.
        if self._overloaded_frames >= 5:
            changed = self._reduce_quality()
            self._overloaded_frames = 0

        # Increase quality only after sustained healthy performance.
        elif self._healthy_frames >= 120:
            changed = self._increase_quality()
            self._healthy_frames = 0

        return changed

    def _reduce_quality(self) -> bool:
        old_columns = self.columns
        old_fps = self.target_fps

        self.columns = max(
            self.config.min_columns,
            int(self.columns * self.config.scale_down),
        )

        # Only reduce FPS when resolution has already been reduced.
        if self.columns <= self.config.min_columns * 1.25:
            self.target_fps = max(
                self.config.min_fps,
                self.target_fps - 5,
            )

        return (
            self.columns != old_columns
            or self.target_fps != old_fps
        )

    def _increase_quality(self) -> bool:
        old_columns = self.columns
        old_fps = self.target_fps

        self.columns = min(
            self.config.max_columns,
            int(self.columns * self.config.scale_up),
        )

        if self.columns >= self.config.max_columns * 0.75:
            self.target_fps = min(
                self.config.max_fps,
                self.target_fps + 5,
            )

        return (
            self.columns != old_columns
            or self.target_fps != old_fps
        )

    def status(self) -> dict:
        return {
            "columns": self.columns,
            "target_fps": self.target_fps,
            "frame_budget_ms": self.frame_budget * 1000,
        }
