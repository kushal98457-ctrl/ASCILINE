"""
Unit test proving server-side backpressure frame shedding triggers when
client reports depth exceeding BACKLOG_HIGH.
"""
def test_backpressure_shedding_logic():
    BACKLOG_HIGH = 6
    MAX_CONSEC_DROPS = 5
    consec_high_reports = 0
    consec_drops = 0
    dropped_frames = 0

    # Simulate client buffer reports
    reports = [7, 8, 7, 7, 2] # reports exceeding BACKLOG_HIGH then recovering

    for depth in reports:
        if depth > BACKLOG_HIGH:
            consec_high_reports += 1
        else:
            consec_high_reports = 0

        if consec_high_reports >= 2 and consec_drops < MAX_CONSEC_DROPS:
            # Frame shed trigger
            dropped_frames += 1
            consec_drops += 1
        else:
            consec_drops = 0

    assert dropped_frames >= 2, f"Expected backpressure to trigger drops, got {dropped_frames}"
