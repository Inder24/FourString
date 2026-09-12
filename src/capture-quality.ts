/** POC capture heuristics, not a calibrated probability or chord detector. */
export interface CaptureEvidence {
  calibrated: boolean;
  noiseFloorRms: number;
  peakRms: number;
  clippedFraction: number;
  frameCount: number;
  activeFrameFraction: number;
  detectedCount: number;
  expectedCount: number;
  maxFrameGapMs: number;
}
export type CaptureStatus = "usable" | "insufficient" | "noisy" | "clipped" | "uncalibrated" | "interrupted";
export interface CaptureQuality { status: CaptureStatus; message: string; }
const advice: Record<CaptureStatus, string> = {
  usable: "Clear enough to assess timing. This checks signal quality, not chord accuracy.",
  insufficient: "Not enough clear strums were captured to judge timing. Move a little closer, pluck clearly and try again.",
  noisy: "The background or sustained sound is masking separate strums. Find a quieter spot and recheck the microphone.",
  clipped: "The microphone is overloading. Move farther away or lower its input level, then recheck.",
  uncalibrated: "Check the room and play a test pluck before timing is assessed.",
  interrupted: "Microphone analysis paused during this take. Keep this tab visible and record again; the gap is not scored as missed strums.",
};
function result(status: CaptureStatus): CaptureQuality { return { status, message: advice[status] }; }

export function calibrationResult(noiseFloor: number, peak: number, clipped: number): CaptureQuality {
  if (clipped > .01) return result("clipped");
  if (noiseFloor > .035) return result("noisy");
  if (peak < Math.max(.012, noiseFloor * 4)) return result("insufficient");
  return result("usable");
}

export function assessCaptureQuality(evidence: CaptureEvidence | null | undefined): CaptureQuality {
  if (!evidence?.calibrated) return result("uncalibrated");
  if (!Number.isFinite(evidence.maxFrameGapMs) || evidence.maxFrameGapMs > 500) return result("interrupted");
  const base = calibrationResult(evidence.noiseFloorRms, evidence.peakRms, evidence.clippedFraction);
  if (base.status !== "usable") return base;
  if (evidence.activeFrameFraction > .85 && evidence.detectedCount < 2) return result("noisy");
  if (evidence.frameCount < 12 || evidence.detectedCount < Math.max(2, Math.ceil(evidence.expectedCount * .4))) return result("insufficient");
  return result("usable");
}

export function sanitizeCaptureEvidence(value: unknown): CaptureEvidence | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.calibrated !== "boolean") return null;
  const ranges = { noiseFloorRms: 1, peakRms: 1, clippedFraction: 1, frameCount: 10000, activeFrameFraction: 1, detectedCount: 100, expectedCount: 100, maxFrameGapMs: 30000 };
  for (const [key, max] of Object.entries(ranges)) {
    if (typeof v[key] !== "number" || !Number.isFinite(v[key]) || v[key] < 0 || v[key] > max) return null;
  }
  if (![v.frameCount, v.detectedCount, v.expectedCount].every(Number.isInteger) || v.expectedCount === 0) return null;
  return { calibrated: v.calibrated, noiseFloorRms: Number(v.noiseFloorRms), peakRms: Number(v.peakRms), clippedFraction: Number(v.clippedFraction), frameCount: Number(v.frameCount), activeFrameFraction: Number(v.activeFrameFraction), detectedCount: Number(v.detectedCount), expectedCount: Number(v.expectedCount), maxFrameGapMs: Number(v.maxFrameGapMs) };
}

export class CaptureQualityMonitor {
  private floor = 0;
  private frames = 0;
  private active = 0;
  private peak = 0;
  private clipped = 0;
  private lastFrameAt = 0;
  private maxGapMs = 0;
  start(noiseFloor: number, at = 0): void { this.floor = noiseFloor; this.frames = 0; this.active = 0; this.peak = 0; this.clipped = 0; this.lastFrameAt = at; this.maxGapMs = 0; }
  push(frame: { rms: number; clippedFraction?: number; at?: number }): void {
    if (!Number.isFinite(frame.rms)) return;
    if (frame.at !== undefined && Number.isFinite(frame.at)) {
      this.maxGapMs = Math.max(this.maxGapMs, frame.at - this.lastFrameAt);
      this.lastFrameAt = frame.at;
    }
    this.frames++;
    this.peak = Math.max(this.peak, frame.rms);
    this.clipped += frame.clippedFraction ?? 0;
    if (frame.rms > Math.max(.012, this.floor * 4)) this.active++;
  }
  evidence(detectedCount: number, expectedCount: number, calibrated: boolean, endedAt = this.lastFrameAt): CaptureEvidence {
    return { calibrated, noiseFloorRms: this.floor, peakRms: this.peak, clippedFraction: this.frames ? this.clipped / this.frames : 0, frameCount: this.frames, activeFrameFraction: this.frames ? this.active / this.frames : 0, detectedCount, expectedCount, maxFrameGapMs: Math.max(this.maxGapMs, endedAt - this.lastFrameAt) };
  }
}
