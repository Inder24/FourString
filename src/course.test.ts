import { describe, expect, it } from "vitest";
import {
  COURSE_LESSONS,
  COURSE_STAGES,
  COURSE_UNITS,
  courseLesson,
  isCourseLessonOpen,
} from "./course";

describe("Book One curriculum", () => {
  it("contains eight ordered units with three unique lessons each", () => {
    expect(COURSE_UNITS).toHaveLength(8);
    expect(COURSE_LESSONS).toHaveLength(24);
    expect(COURSE_UNITS.map((unit) => unit.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(COURSE_UNITS.map((unit) => unit.lessonIds.length)).toEqual([3, 3, 3, 3, 3, 3, 3, 3]);
    expect(COURSE_LESSONS.map((lesson) => lesson.number)).toEqual(Array.from({ length: 24 }, (_, index) => index + 1));
    expect(new Set(COURSE_LESSONS.map((lesson) => lesson.id)).size).toBe(24);
    expect(COURSE_UNITS.flatMap((unit) => unit.lessonIds)).toEqual(COURSE_LESSONS.map((lesson) => lesson.id));
  });

  it("gives every lesson the complete six-stage method-book flow", () => {
    for (const lesson of COURSE_LESSONS) {
      expect(lesson.durationMinutes).toBeGreaterThanOrEqual(8);
      expect(lesson.durationMinutes).toBeLessThanOrEqual(12);
      expect(lesson.activities.map((activity) => activity.stage)).toEqual(COURSE_STAGES);
      expect(new Set(lesson.activities.map((activity) => activity.id)).size).toBe(6);
      expect(lesson.activities.some((activity) => activity.kind === "note-sequence"
        || activity.kind === "chord"
        || activity.kind === "rhythm"
        || activity.kind === "compose"
        || activity.kind === "performance"
        || activity.kind === "self-check")).toBe(true);
      expect(lesson.activities.some((activity) => activity.id === lesson.secureActivityId)).toBe(true);
      const guess = lesson.activities.find((activity) => activity.stage === "guess");
      expect(guess?.kind).toBe("ear-choice");
      if (guess?.kind === "ear-choice") {
        expect(guess.question.length).toBeGreaterThan(12);
        expect(guess.question).not.toBe("What did you hear?");
      }
    }
  });

  it("keeps instrument anatomy separate from pitch-path visuals", () => {
    const firstLesson = courseLesson("your-ukulele");
    const see = firstLesson.activities.find((activity) => activity.stage === "see");
    const guess = firstLesson.activities.find((activity) => activity.stage === "guess");
    expect(see).toMatchObject({ kind: "explain", visual: "ukulele" });
    expect(guess).toMatchObject({
      kind: "ear-choice",
      question: "Which part lets the ukulele body project the sound?",
      correctChoice: "Sound hole",
    });
  });

  it("teaches Sargam as the primary language with Western translations", () => {
    const findSa = courseLesson("find-sa");
    expect(findSa.primaryTerms).toContain("Sa");
    expect(findSa.westernTerms).toContain("C");
    expect(findSa.concept).toContain("movable");

    const scale = courseLesson("climb-sargam");
    expect(scale.primaryTerms).toEqual(["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni", "Sa"]);
    expect(scale.westernTerms).toEqual(["C", "D", "E", "F", "G", "A", "B", "C"]);
  });

  it("keeps every lesson open regardless of progress", () => {
    expect(COURSE_LESSONS.every((lesson) => isCourseLessonOpen(lesson.id, {}))).toBe(true);
    expect(COURSE_LESSONS.every((lesson) => isCourseLessonOpen(lesson.id, { [lesson.id]: "secure" }))).toBe(true);
  });

  it("rejects an unknown lesson id instead of silently substituting content", () => {
    expect(() => courseLesson("not-a-lesson")).toThrow("Unknown course lesson");
  });
});
