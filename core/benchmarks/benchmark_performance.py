import time

from core.adaptive import AdaptiveController
from core.performance import PerformanceMonitor


def run_benchmark():
    monitor = PerformanceMonitor()

    controller = AdaptiveController(
        columns=240,
        target_fps=60,
    )

    print("=" * 60)
    print("ASCILINE PERFORMANCE BENCHMARK")
    print("=" * 60)

    for frame in range(300):
        monitor.frame_started()

        # Simulated frame-processing workload.
        time.sleep(0.005)

        processing_time = 0.005

        controller.update(
            processing_time=processing_time,
            queue_depth=0,
        )

        monitor.frame_finished(
            bytes_sent=50_000,
        )

        if frame % 60 == 0:
            snapshot = monitor.snapshot()

            print(
                f"Frame: {frame:03d} | "
                f"FPS: {snapshot.fps:6.2f} | "
                f"Frame: {snapshot.frame_time_ms:6.2f} ms | "
                f"Columns: {controller.columns:3d} | "
                f"Target FPS: {controller.target_fps:2d}"
            )

    print("=" * 60)
    print("Benchmark complete")


if __name__ == "__main__":
    run_benchmark()
