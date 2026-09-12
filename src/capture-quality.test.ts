import { expect, it } from "vitest";
import { assessCaptureQuality, calibrationResult, CaptureQualityMonitor, sanitizeCaptureEvidence } from "./capture-quality";

const clear = { calibrated: true, noiseFloorRms: .002, peakRms: .12, clippedFraction: 0, frameCount: 240, activeFrameFraction: .3, detectedCount: 8, expectedCount: 8, maxFrameGapMs: 0 };
it("separates a usable capture from silence without judging timing", () => {
  expect(assessCaptureQuality(clear).status).toBe("usable");
  // Rhythm offsets are deliberately not inputs: a clear but late performance is usable.
  expect(assessCaptureQuality({ ...clear, detectedCount: 4 }).status).toBe("usable");
  expect(assessCaptureQuality({ ...clear, peakRms: .002, detectedCount: 0 }).status).toBe("insufficient");
});
it("rejects clipping, sustained noise, too few hits and missing calibration", () => {
  expect(assessCaptureQuality({ ...clear, clippedFraction: .02 }).status).toBe("clipped");
  expect(assessCaptureQuality({ ...clear, noiseFloorRms: .06 }).status).toBe("noisy");
  expect(assessCaptureQuality({ ...clear, activeFrameFraction: .95, detectedCount: 1 }).status).toBe("noisy");
  expect(assessCaptureQuality({ ...clear, detectedCount: 2 }).status).toBe("insufficient");
  expect(assessCaptureQuality({ ...clear, calibrated: false }).status).toBe("uncalibrated");
});
it("requires a test pluck to rise above the quiet room floor", () => {
  expect(calibrationResult(.003, .006, 0).status).toBe("insufficient");
  expect(calibrationResult(.003, .05, 0).status).toBe("usable");
  expect(calibrationResult(.003, .99, .04).status).toBe("clipped");
});
it("projects numeric evidence and rejects nonfinite or impossible input", () => {
  expect(sanitizeCaptureEvidence({ ...clear, waveform: [1], apiKey: "secret" })).toEqual(clear);
  expect(sanitizeCaptureEvidence({ ...clear, noiseFloorRms: NaN })).toBeNull();
  expect(sanitizeCaptureEvidence({ ...clear, activeFrameFraction: 2 })).toBeNull();
});
it("aggregates frames without retaining waveforms and resets between takes", () => {
  const monitor = new CaptureQualityMonitor();
  monitor.start(.002);
  for (let i = 0; i < 100; i++) monitor.push({ rms: i < 25 ? .1 : .002, clippedFraction: 0 });
  expect(monitor.evidence(8, 8, true)).toEqual({ ...clear, peakRms: .1, frameCount: 100, activeFrameFraction: .25 });
  monitor.start(.003);
  expect(monitor.evidence(0, 8, true).frameCount).toBe(0);
});
it('rejects a long sampling stall despite sufficient frames and strums',()=>{
  const monitor=new CaptureQualityMonitor();
  monitor.start(.002,0);
  for(let i=0;i<50;i++) monitor.push({rms:.12,at:i*16});
  monitor.push({rms:.12,at:3000});
  const evidence=monitor.evidence(8,8,true,3016);
  expect(evidence.frameCount).toBe(51);
  expect(evidence.maxFrameGapMs).toBe(2216);
  expect(assessCaptureQuality(evidence).status).toBe('interrupted');
});
