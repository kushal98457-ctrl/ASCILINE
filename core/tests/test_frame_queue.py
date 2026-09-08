from core.frame_queue import FrameQueue, QueuedFrame


def test_queue_drops_old_frames():
    q = FrameQueue(max_size=2)

    q.put(QueuedFrame("frame1", 0.0, 1))
    q.put(QueuedFrame("frame2", 0.1, 2))
    q.put(QueuedFrame("frame3", 0.2, 3))

    assert q.qsize() == 2
    assert q.dropped_frames == 1

    first = q.get()

    assert first.frame_number == 2
