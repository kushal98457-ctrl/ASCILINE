/**
 * Playback clock driven by the media element's own currentTime (which is
 * itself PTS-accurate once the browser is decoding the stream), rather than
 * a fixed-interval timer. requestAnimationFrame handles presentation cadence;
 * this class only answers "what timestamp should be on screen right now".
 */
export class PlaybackClock {
  private videoEl: HTMLVideoElement | null = null;
  private manualOffsetSec = 0;
  private manualStartWallMs = 0;
  private useManualClock = false;

  attach(videoEl: HTMLVideoElement): void {
    this.videoEl = videoEl;
    this.useManualClock = false;
  }

  /** For sources without an HTMLMediaElement (e.g. raw WebSocket frame streams). */
  startManual(startSec = 0): void {
    this.useManualClock = true;
    this.manualOffsetSec = startSec;
    this.manualStartWallMs = performance.now();
  }

  seekManual(toSec: number): void {
    this.manualOffsetSec = toSec;
    this.manualStartWallMs = performance.now();
  }

  now(): number {
    if (this.useManualClock) {
      return this.manualOffsetSec + (performance.now() - this.manualStartWallMs) / 1000;
    }
    return this.videoEl?.currentTime ?? 0;
  }

  isPaused(): boolean {
    if (this.useManualClock) return false;
    return this.videoEl?.paused ?? true;
  }
}
