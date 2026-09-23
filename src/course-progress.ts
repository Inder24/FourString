import { COURSE_LESSONS, courseLesson } from "./course";

export const COURSE_PROGRESS_KEY = "four-strings-course-foundations-v1";

export interface LessonEvaluation {
  attempted: boolean;
  secure: boolean;
  accuracy: number | null;
  evidence: Record<string, number | string | boolean>;
  retryHint: string;
}

export interface LessonProgress {
  attempts: number;
  completedAt: string | null;
  secureAt: string | null;
  bestResult: LessonEvaluation | null;
}

export interface CourseProgressV1 {
  schemaVersion: 1;
  courseId: "foundations-v1";
  lastLessonId: string | null;
  lessons: Record<string, LessonProgress>;
}

export interface CourseStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createCourseProgress(): CourseProgressV1 {
  return { schemaVersion: 1, courseId: "foundations-v1", lastLessonId: null, lessons: {} };
}

export function recordLessonAttempt(
  progress: CourseProgressV1,
  lessonId: string,
  evaluation: LessonEvaluation,
  at = new Date().toISOString(),
): CourseProgressV1 {
  courseLesson(lessonId);
  const previous = progress.lessons[lessonId] ?? { attempts: 0, completedAt: null, secureAt: null, bestResult: null };
  const accuracy = evaluation.accuracy ?? -1;
  const previousAccuracy = previous.bestResult?.accuracy ?? -1;
  const bestResult = !previous.bestResult || evaluation.secure && !previous.bestResult.secure || accuracy > previousAccuracy
    ? cloneEvaluation(evaluation)
    : previous.bestResult;
  return {
    schemaVersion: 1,
    courseId: "foundations-v1",
    lastLessonId: lessonId,
    lessons: {
      ...progress.lessons,
      [lessonId]: {
        attempts: previous.attempts + 1,
        completedAt: previous.completedAt ?? (evaluation.attempted ? at : null),
        secureAt: previous.secureAt ?? (evaluation.secure ? at : null),
        bestResult,
      },
    },
  };
}

export function nextRecommendedLessonId(progress: CourseProgressV1): string {
  const incomplete = COURSE_LESSONS.find((lesson) => !progress.lessons[lesson.id]?.completedAt);
  if (incomplete) return incomplete.id;
  return COURSE_LESSONS.find((lesson) => !progress.lessons[lesson.id]?.secureAt)?.id ?? COURSE_LESSONS[0].id;
}

export function parseCourseProgress(raw: string | null): CourseProgressV1 | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value) || value.schemaVersion !== 1 || value.courseId !== "foundations-v1") return null;
    if (value.lastLessonId !== null && (typeof value.lastLessonId !== "string" || !isKnownLesson(value.lastLessonId))) return null;
    if (!isRecord(value.lessons)) return null;
    const lessons: Record<string, LessonProgress> = {};
    for (const [id, candidate] of Object.entries(value.lessons)) {
      if (!isKnownLesson(id) || !isLessonProgress(candidate)) return null;
      lessons[id] = candidate;
    }
    return { schemaVersion: 1, courseId: "foundations-v1", lastLessonId: value.lastLessonId, lessons };
  } catch {
    return null;
  }
}

export function loadCourseProgress(storage: CourseStorage): CourseProgressV1 {
  return parseCourseProgress(storage.getItem(COURSE_PROGRESS_KEY)) ?? createCourseProgress();
}

export function saveCourseProgress(storage: CourseStorage, progress: CourseProgressV1): void {
  storage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(progress));
}

export function resetCourseProgress(storage: CourseStorage): void {
  storage.removeItem(COURSE_PROGRESS_KEY);
}

function isLessonProgress(value: unknown): value is LessonProgress {
  if (!isRecord(value) || !Number.isInteger(value.attempts) || (value.attempts as number) < 0) return false;
  if (!isNullableString(value.completedAt) || !isNullableString(value.secureAt)) return false;
  if (value.bestResult === null) return true;
  return isEvaluation(value.bestResult);
}

function isEvaluation(value: unknown): value is LessonEvaluation {
  if (!isRecord(value) || typeof value.attempted !== "boolean" || typeof value.secure !== "boolean") return false;
  if (value.accuracy !== null && (typeof value.accuracy !== "number" || !Number.isFinite(value.accuracy) || value.accuracy < 0 || value.accuracy > 1)) return false;
  return isRecord(value.evidence) && Object.values(value.evidence).every((entry) => ["number", "string", "boolean"].includes(typeof entry))
    && typeof value.retryHint === "string";
}

function cloneEvaluation(evaluation: LessonEvaluation): LessonEvaluation {
  return { ...evaluation, evidence: { ...evaluation.evidence } };
}

function isKnownLesson(id: string): boolean {
  return COURSE_LESSONS.some((lesson) => lesson.id === id);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
