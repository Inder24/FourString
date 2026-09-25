import { describe, expect, it } from "vitest";
import {
  evaluateCourseChordSequence,
  evaluateCourseComposite,
  evaluateCourseDynamics,
  evaluateCourseEarChoice,
  evaluateCourseNoteSequence,
  evaluateCourseRhythm,
  evaluateCourseRhythmTiming,
} from "./course-evaluation";

describe("course evaluations", () => {
  it("keeps an ear answer exploratory when the instrument revealed it first", () => {
    expect(evaluateCourseEarChoice("Home", "Home", false)).toMatchObject({ attempted: true, secure: true, accuracy: 1 });
    expect(evaluateCourseEarChoice("Home", "Home", true)).toMatchObject({ attempted: true, secure: false, accuracy: 1 });
    expect(evaluateCourseEarChoice("Home", "Higher", false)).toMatchObject({ attempted: true, secure: false, accuracy: 0 });
  });

  it("requires every expected pitch in order for a secure note sequence", () => {
    expect(evaluateCourseNoteSequence([60, 62, 64], [60, 62, 64])).toMatchObject({ secure: true, accuracy: 1 });
    expect(evaluateCourseNoteSequence([60, 62, 64], [60, 64])).toMatchObject({ secure: false, accuracy: 2 / 3 });
    expect(evaluateCourseNoteSequence([60, 62, 64], [60, 61, 64])).toMatchObject({ secure: false, accuracy: 2 / 3 });
  });

  it("treats uncertain chord evidence as incomplete rather than a wrong confident chord", () => {
    expect(evaluateCourseChordSequence(["C", "Am", "F"], ["C", "Am", "F"])).toMatchObject({ secure: true, accuracy: 1 });
    const uncertain = evaluateCourseChordSequence(["C", "Am", "F"], ["C", null, "F"]);
    expect(uncertain).toMatchObject({ secure: false, accuracy: 2 / 3 });
    expect(uncertain.retryHint).toContain("string-by-string");
  });

  it("uses the beginner rhythm threshold without claiming direction recognition", () => {
    expect(evaluateCourseRhythm({ expectedCount: 8, onTime: 6, missed: 1, extra: 1 })).toMatchObject({ secure: true, accuracy: 0.75 });
    expect(evaluateCourseRhythm({ expectedCount: 8, onTime: 6, missed: 2, extra: 0 })).toMatchObject({ secure: false });
    expect(evaluateCourseRhythm({ expectedCount: 8, onTime: 5, missed: 1, extra: 0 }).evidence.directionMeasured).toBe(false);
  });

  it("grades quarter-note gaps at the full beat duration", () => {
    const strokes = [0, 2, 4, 6].map((slot) => ({ slot, sounded: true }));
    expect(evaluateCourseRhythmTiming(strokes, 60, [100, 1100, 2100, 3100])).toMatchObject({ secure: true, accuracy: 1 });
    expect(evaluateCourseRhythmTiming(strokes, 60, [100, 600, 1100, 1600])).toMatchObject({ secure: false, accuracy: 0.25 });
  });

  it("grades accents relative to the unaccented strokes", () => {
    expect(evaluateCourseDynamics([0.8, 0.4, 0.42, 0.38], [0])).toMatchObject({ secure: true });
    expect(evaluateCourseDynamics([0.46, 0.4, 0.42, 0.38], [0])).toMatchObject({ secure: false });
    expect(evaluateCourseDynamics([0.8], [0])).toMatchObject({ secure: false, accuracy: null });
  });

  it("secures the final lab when three of four independent objectives land", () => {
    expect(evaluateCourseComposite({ ear: true, chords: true, rhythm: false, performance: true })).toMatchObject({ secure: true, accuracy: 0.75 });
    expect(evaluateCourseComposite({ ear: true, chords: false, rhythm: false, performance: true })).toMatchObject({ secure: false, accuracy: 0.5 });
  });
});
