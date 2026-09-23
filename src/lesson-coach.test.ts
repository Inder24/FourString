import { describe, expect, it, vi } from "vitest";
import { extractLessonCoachDecision, sanitizeLessonCoachSummary } from "../server/lesson-coach-api";
import { createLessonCoachRequest, validateLessonCoachDecision } from "./lesson-coach";
import type { LessonCoachSummary } from "./lesson-coach";

const safeSummary: LessonCoachSummary = {
  lessonId: "find-the-pulse",
  activityId: "find-the-pulse-check",
  activityKind: "rhythm",
  attempted: true,
  secure: false,
  accuracy: 0.625,
  evidence: { expected: 8, onTime: 5, missed: 2, extra: 1, directionMeasured: false },
};

describe("lesson coach contract", () => {
  it("serializes only validated lesson metadata and scalar evidence", () => {
    const sanitized = sanitizeLessonCoachSummary({
      ...safeSummary,
      audio: "must not pass",
      waveform: [0.1, 0.2],
      evidence: { ...safeSummary.evidence, rawSamples: [0.1], learnerName: { value: "private" } },
    });
    expect(sanitized).toEqual(safeSummary);
    expect(JSON.stringify(sanitized)).not.toContain("audio");
    expect(JSON.stringify(sanitized)).not.toContain("waveform");
    expect(JSON.stringify(sanitized)).not.toContain("rawSamples");
    expect(createLessonCoachRequest(sanitized!)).toEqual(safeSummary);
  });

  it("rejects unknown lessons, unrelated retry activities, unsafe tempos, and long text", () => {
    expect(sanitizeLessonCoachSummary({ ...safeSummary, lessonId: "invented" })).toBeNull();
    expect(validateLessonCoachDecision({ correction: "Relax.", evidence: "Five of eight attacks landed.", retryActivityId: "climb-sargam-play", tempoBpm: 55, repetitions: 2 }, safeSummary)).toBeNull();
    expect(validateLessonCoachDecision({ correction: "Relax.", evidence: "Five of eight attacks landed.", retryActivityId: "find-the-pulse-play", tempoBpm: 130, repetitions: 2 }, safeSummary)).toBeNull();
    expect(validateLessonCoachDecision({ correction: "x".repeat(181), evidence: "Measured timing.", retryActivityId: "find-the-pulse-play", tempoBpm: 55, repetitions: 2 }, safeSummary)).toBeNull();
  });

  it("accepts one constrained retry belonging to the active lesson", () => {
    expect(validateLessonCoachDecision({
      correction: "Let your hand fall with each bright pulse.",
      evidence: "Five of eight attacks landed inside the timing window.",
      retryActivityId: "find-the-pulse-play",
      tempoBpm: 55,
      repetitions: 2,
    }, safeSummary)).toMatchObject({ retryActivityId: "find-the-pulse-play", tempoBpm: 55 });
  });

  it("extracts exactly one valid tool call and rejects malformed output", () => {
    const valid = {
      type: "function_call",
      name: "configure_lesson_retry",
      arguments: JSON.stringify({
        correction: "Let your hand fall with each bright pulse.",
        evidence: "Five of eight attacks landed inside the timing window.",
        retryActivityId: "find-the-pulse-play",
        tempoBpm: 55,
        repetitions: 2,
      }),
    };
    expect(extractLessonCoachDecision({ output: [valid] }, safeSummary)?.repetitions).toBe(2);
    expect(extractLessonCoachDecision({ output: [{ ...valid, arguments: "bad-json" }] }, safeSummary)).toBeNull();
    expect(extractLessonCoachDecision({ output: [{ ...valid, name: "other" }] }, safeSummary)).toBeNull();
    expect(extractLessonCoachDecision({ output: [valid, valid] }, safeSummary)).toBeNull();
  });

  it("keeps missing-key and malformed-request failures deterministic", async () => {
    const { createLessonCoachHandler } = await import("../server/lesson-coach-api");
    const provider = vi.fn();
    expect((await createLessonCoachHandler("", provider)(new Request("http://local/api/lesson-coach", { method: "POST", body: JSON.stringify(safeSummary) })))?.status).toBe(503);
    expect((await createLessonCoachHandler("key", provider)(new Request("http://local/api/lesson-coach", { method: "POST", body: "{}" })))?.status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
});
