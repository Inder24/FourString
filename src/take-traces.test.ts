import { expect, it } from "vitest";
import { analyzeRhythmAttempt, buildExpectedEvents, rhythmPattern, type RhythmAttempt } from "./adaptive-coach";
import { takeTracePoints } from "./take-traces";

function attempt(bpm: number, detected: number[]): RhythmAttempt {
  const events = buildExpectedEvents(rhythmPattern("steady-downs"), bpm, 1);
  return { id: "test", kind: "baseline", patternId: "steady-downs", bpm, repetitions: 1, focus: null,
    recordingUrl: null, detectedAtMs: detected, metrics: analyzeRhythmAttempt(events, detected, bpm) };
}
it("normalises different tempos to the same musical beat positions", () => {
  const focus = { startSlot: 0, endSlot: 3 };
  const first = takeTracePoints(attempt(60, [0,1000,2000,3000]), focus);
  const slower = takeTracePoints(attempt(50, [0,1200,2400,3600]), focus);
  expect(first.map(p => p.position)).toEqual([0, .5]);
  expect(slower.map(p => p.position)).toEqual([0, .5]);
});
it("shows misses and unassigned extras rather than fabricating a waveform", () => {
  const points = takeTracePoints(attempt(60, [0,500,1000,3000]), { startSlot: 0, endSlot: 7 });
  expect(points.filter(p => p.grade === "missed")).toHaveLength(1);
  expect(points.filter(p => p.grade === "extra")).toHaveLength(1);
  expect(points.find(p => p.grade === "extra")!.position).toBe(.125);
});
