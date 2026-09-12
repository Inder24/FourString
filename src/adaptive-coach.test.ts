import { describe, expect, it } from "vitest";
import {
  AdaptiveOnsetDetector,
  analyzeRhythmAttempt,
  buildExpectedEvents,
  compareAttempts,
  comparisonTakeForFocus,
  rhythmPattern,
  summarizeAttemptForCoach,
  validateCoachingDecision,
  type RhythmAttempt,
} from "./adaptive-coach";

describe("adaptive rhythm analysis", () => {
  it("builds two complete bars for each pattern", () => {
    expect(buildExpectedEvents(rhythmPattern("steady-downs"), 70)).toHaveLength(8);
    expect(buildExpectedEvents(rhythmPattern("alternating-pulse"), 70)).toHaveLength(16);
    expect(buildExpectedEvents(rhythmPattern("island-rhythm"), 70)).toHaveLength(12);
  });

  it("normalizes a consistent device delay before grading", () => {
    const events = buildExpectedEvents(rhythmPattern("steady-downs"), 70);
    const detected = events.map((event) => event.atMs + 110);
    const metrics = analyzeRhythmAttempt(events, detected, 70);
    expect(metrics.globalOffsetMs).toBe(110);
    expect(metrics.onTime).toBe(events.length);
    expect(metrics.meanAbsoluteErrorMs).toBe(0);
  });

  it("finds rushing final strokes and keeps missing and extra attacks separate", () => {
    const events = buildExpectedEvents(rhythmPattern("alternating-pulse"), 70, 1);
    const detected = events.map((event, index) => event.atMs + (index >= 6 ? -170 : 0));
    detected.splice(2, 1);
    detected.push(events.at(-1)!.atMs + 350);
    const metrics = analyzeRhythmAttempt(events, detected, 70);
    expect(metrics.early).toBeGreaterThan(0);
    expect(metrics.missed).toBeGreaterThanOrEqual(1);
    expect(metrics.extra).toBeGreaterThanOrEqual(1);
    expect(metrics.worstRegion.endSlot).toBeGreaterThan(metrics.worstRegion.startSlot);
  });

  it("calibrates above room noise and suppresses ringing duplicates", () => {
    const detector = new AdaptiveOnsetDetector();
    for (let index = 0; index < 60; index += 1) detector.addCalibrationSample(0.006);
    expect(detector.finishCalibration()).toBeCloseTo(0.0192, 3);
    expect(detector.push(0.08, 1000)).toBe(true);
    expect(detector.push(0.09, 1050)).toBe(false);
    expect(detector.push(0.001, 1200)).toBe(false);
    expect(detector.push(0.08, 1300)).toBe(true);
  });
});

describe("Astra coaching contract", () => {
  const pattern = rhythmPattern("steady-downs");
  const events = buildExpectedEvents(pattern, 70);
  const metrics = analyzeRhythmAttempt(events, events.map((event) => event.atMs), 70);
  const attempt: RhythmAttempt = {
    id: "attempt-1",
    patternId: pattern.id,
    kind: "baseline",
    bpm: 70,
    repetitions: 2,
    focus: null,
    metrics,
    recordingUrl: "blob:private-recording",
  };

  it("serializes measurements without a recording URL", () => {
    const payload = summarizeAttemptForCoach(pattern, attempt, 0, null);
    expect(JSON.stringify(payload)).not.toContain("blob:");
    expect("alignedHits" in payload.metrics).toBe(false);
  });

  it("accepts only constrained retry decisions", () => {
    const valid = validateCoachingDecision({
      issue: "rushing",
      correction: "Leave more room before the final two strokes.",
      evidence: "The ending landed 92 ms early on average.",
      focusStartSlot: 4,
      focusEndSlot: 6,
      retryBpm: 60,
      repetitions: 3,
      visualCue: "relax-return",
    }, pattern);
    expect(valid?.retryBpm).toBe(60);
    expect(valid?.visualCue).toBe("relax-return");
    expect(validateCoachingDecision({ ...valid, visualCue: "run-code" }, pattern)).toBeNull();
    expect(validateCoachingDecision({ ...valid, retryBpm: "60" }, pattern)).toBeNull();
    expect(validateCoachingDecision({ ...valid, retryBpm: 43 }, pattern)).toBeNull();
    expect(validateCoachingDecision({ ...valid, focusStartSlot: 5, focusEndSlot: 6 }, pattern)).toBeNull();
  });

  it("compares the same focused region before and after", () => {
    const roughMetrics = analyzeRhythmAttempt(events, events.map((event) => event.atMs + (event.slot >= 4 ? -160 : 0)), 70);
    const retryEvents = buildExpectedEvents(pattern, 60, 3, { startSlot: 4, endSlot: 6 });
    const retryMetrics = analyzeRhythmAttempt(retryEvents, retryEvents.map((event) => event.atMs + 15), 60);
    const result = compareAttempts(
      { ...attempt, metrics: roughMetrics },
      { ...attempt, id: "attempt-2", kind: "retry", bpm: 60, repetitions: 3, focus: { startSlot: 4, endSlot: 6 }, metrics: retryMetrics },
      { startSlot: 4, endSlot: 6 },
    );
    expect(result.status).toBe("improved");
    expect(result.afterErrorMs).toBeLessThan(result.beforeErrorMs);
  });

  it("does not praise two silent takes as getting closer", () => {
    const focus = { startSlot: 4, endSlot: 6 };
    const retryEvents = buildExpectedEvents(pattern, 60, 2, focus);
    const result = compareAttempts(
      { ...attempt, metrics: analyzeRhythmAttempt(events, [], 70) },
      { ...attempt, kind: "retry", bpm: 60, focus, metrics: analyzeRhythmAttempt(retryEvents, [], 60) },
      focus,
    );
    expect(result.status).toBe("retry");
  });

  it("uses the full baseline when a later decision moves outside the previous retry", () => {
    const retry = { ...attempt, focus: { startSlot: 4, endSlot: 6 } };
    expect(comparisonTakeForFocus(retry, attempt, { startSlot: 0, endSlot: 2 })).toBe(attempt);
    expect(comparisonTakeForFocus(retry, attempt, { startSlot: 4, endSlot: 6 })).toBe(retry);
  });
});
