import { describe, expect, it } from "vitest";
import { extractCoachingDecision, sanitizeCoachAttemptSummary } from "../server/adaptive-coach-api";
import { analyzeRhythmAttempt, buildExpectedEvents, rhythmPattern, summarizeAttemptForCoach } from "./adaptive-coach";

describe("adaptive coach API contract", () => {
  it("extracts a valid forced function call", () => {
    const decision = extractCoachingDecision({
      output: [{
        type: "function_call",
        name: "configure_retry",
        arguments: JSON.stringify({
          issue: "uneven",
          correction: "Keep your wrist moving through the middle pair.",
          evidence: "The middle pair varied by 86 ms.",
          focusStartSlot: 0,
          focusEndSlot: 2,
          retryBpm: 60,
          repetitions: 3,
          visualCue: "even-swing",
        }),
      }],
    }, "steady-downs");
    expect(decision?.issue).toBe("uneven");
  });

  it("rejects prose, unknown tools, and invalid arguments", () => {
    expect(extractCoachingDecision({ output: [{ type: "message" }] }, "steady-downs")).toBeNull();
    expect(extractCoachingDecision({
      output: [{ type: "function_call", name: "other_tool", arguments: "{}" }],
    }, "steady-downs")).toBeNull();
    expect(extractCoachingDecision({
      output: [{ type: "function_call", name: "configure_retry", arguments: "not-json" }],
    }, "steady-downs")).toBeNull();
  });

  it("whitelists numeric measurements before anything reaches Astra", () => {
    const pattern = rhythmPattern("steady-downs");
    const events = buildExpectedEvents(pattern, 70);
    const metrics = analyzeRhythmAttempt(events, events.map((event) => event.atMs), 70);
    const summary = summarizeAttemptForCoach(pattern, {
      id: "safe-attempt",
      patternId: pattern.id,
      kind: "baseline",
      bpm: 70,
      repetitions: 2,
      focus: null,
      metrics,
      recordingUrl: null,
      captureQuality: { calibrated: true, noiseFloorRms: .002, peakRms: .12, clippedFraction: 0, frameCount: 240, activeFrameFraction: .3, detectedCount: 8, expectedCount: 8, maxFrameGapMs: 0 },
    }, 0, null);
    const sanitized = sanitizeCoachAttemptSummary({
      ...summary,
      rawAudio: "must-not-pass",
      metrics: { ...summary.metrics, waveform: [0.1, 0.2] },
    });
    expect(sanitized).not.toBeNull();
    expect(JSON.stringify(sanitized)).not.toContain("rawAudio");
    expect(JSON.stringify(sanitized)).not.toContain("waveform");
    expect(sanitizeCoachAttemptSummary({ ...summary, bpm: 71 })).toBeNull();
    expect(sanitizeCoachAttemptSummary({ ...summary, captureQuality: undefined })).toBeNull();
    expect(sanitizeCoachAttemptSummary({ ...summary, captureQuality: { ...summary.captureQuality, clippedFraction: .05 } })).toBeNull();
    expect(sanitizeCoachAttemptSummary({ ...summary, captureQuality: { ...summary.captureQuality, detectedCount: 1 } })).toBeNull();
  });
});
