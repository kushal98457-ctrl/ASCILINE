from core.adaptive import AdaptiveController


def test_adaptive_reduces_quality_under_load():
    controller = AdaptiveController(
        columns=240,
        target_fps=60,
    )

    original_columns = controller.columns

    for _ in range(20):
        controller.update(
            processing_time=0.050,
            queue_depth=5,
        )

    assert controller.columns < original_columns


def test_adaptive_recovers_after_stable_performance():
    controller = AdaptiveController(
        columns=150,
        target_fps=30,
    )

    original_columns = controller.columns

    for _ in range(150):
        controller.update(
            processing_time=0.005,
            queue_depth=0,
        )

    assert controller.columns >= original_columns
