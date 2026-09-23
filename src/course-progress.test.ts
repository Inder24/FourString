import { describe, expect, it } from "vitest";
import {
  COURSE_PROGRESS_KEY,
  createCourseProgress,
  loadCourseProgress,
  nextRecommendedLessonId,
  parseCourseProgress,
  recordLessonAttempt,
  resetCourseProgress,
  saveCourseProgress,
  type CourseStorage,
} from "./course-progress";

class MemoryStorage implements CourseStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("Book One progress", () => {
  it("starts at lesson one and recommends the first incomplete lesson", () => {
    let progress = createCourseProgress();
    expect(nextRecommendedLessonId(progress)).toBe("your-ukulele");

    progress = recordLessonAttempt(progress, "your-ukulele", {
      attempted: true,
      secure: false,
      accuracy: 0.6,
      evidence: { checklist: 4 },
      retryHint: "Review the posture checklist.",
    }, "2026-09-23T10:00:00.000Z");
    expect(progress.lessons["your-ukulele"].attempts).toBe(1);
    expect(progress.lessons["your-ukulele"].completedAt).toBe("2026-09-23T10:00:00.000Z");
    expect(progress.lessons["your-ukulele"].secureAt).toBeNull();
    expect(nextRecommendedLessonId(progress)).toBe("four-strings");
  });

  it("preserves the best result and recommends incomplete before completed-but-not-secure", () => {
    let progress = createCourseProgress();
    progress = recordLessonAttempt(progress, "your-ukulele", {
      attempted: true, secure: false, accuracy: 0.9, evidence: {}, retryHint: "Try once more.",
    }, "2026-09-23T10:00:00.000Z");
    progress = recordLessonAttempt(progress, "your-ukulele", {
      attempted: true, secure: false, accuracy: 0.4, evidence: {}, retryHint: "Try once more.",
    }, "2026-09-23T10:01:00.000Z");
    expect(progress.lessons["your-ukulele"].bestResult?.accuracy).toBe(0.9);

    for (const id of ["four-strings", "find-the-pulse", "find-sa", "climb-sargam", "steps-skips-echoes", "beat-bar-four-four", "split-the-beat", "rhythm-echo", "right-hand-sound", "fingerpicking-flow", "strumming-vocabulary", "notes-become-chord", "first-chord-family", "tension-comes-home", "clean-chord-changes", "hear-progression", "accompany-phrase", "melody-over-harmony", "hear-hide-remember", "musical-sentence", "dynamics-accents", "syncopation-groove", "final-music-lab"]) {
      progress = recordLessonAttempt(progress, id, {
        attempted: true, secure: true, accuracy: 1, evidence: {}, retryHint: "",
      }, "2026-09-23T11:00:00.000Z");
    }
    expect(nextRecommendedLessonId(progress)).toBe("your-ukulele");
  });

  it("persists a valid versioned record and rejects corrupt or future data", () => {
    const storage = new MemoryStorage();
    const progress = recordLessonAttempt(createCourseProgress(), "four-strings", {
      attempted: true, secure: true, accuracy: 1, evidence: { strings: 4 }, retryHint: "",
    }, "2026-09-23T12:00:00.000Z");
    saveCourseProgress(storage, progress);
    expect(loadCourseProgress(storage)).toEqual(progress);

    storage.setItem(COURSE_PROGRESS_KEY, "not json");
    expect(loadCourseProgress(storage)).toEqual(createCourseProgress());
    expect(parseCourseProgress(JSON.stringify({ ...progress, schemaVersion: 2 }))).toBeNull();
    expect(parseCourseProgress(JSON.stringify({ ...progress, lessons: { unknown: {} } }))).toBeNull();
  });

  it("resets only course progress", () => {
    const storage = new MemoryStorage();
    storage.setItem(COURSE_PROGRESS_KEY, "saved");
    storage.setItem("four-strings-lesson-take", "keep me");
    resetCourseProgress(storage);
    expect(storage.getItem(COURSE_PROGRESS_KEY)).toBeNull();
    expect(storage.getItem("four-strings-lesson-take")).toBe("keep me");
  });

  it("rejects attempts for unknown lessons", () => {
    expect(() => recordLessonAttempt(createCourseProgress(), "unknown", {
      attempted: true, secure: false, accuracy: null, evidence: {}, retryHint: "",
    })).toThrow("Unknown course lesson");
  });
});
