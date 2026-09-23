import { courseLesson, type CourseActivity } from "./course";

export interface LessonCoachSummary {
  lessonId: string;
  activityId: string;
  activityKind: CourseActivity["kind"];
  attempted: boolean;
  secure: boolean;
  accuracy: number | null;
  evidence: Record<string, number | string | boolean>;
}

export interface LessonCoachDecision {
  correction: string;
  evidence: string;
  retryActivityId: string;
  tempoBpm: number | null;
  repetitions: 1 | 2 | 3;
}

export function createLessonCoachRequest(summary: LessonCoachSummary): LessonCoachSummary {
  return {
    lessonId: summary.lessonId,
    activityId: summary.activityId,
    activityKind: summary.activityKind,
    attempted: summary.attempted,
    secure: summary.secure,
    accuracy: summary.accuracy,
    evidence: { ...summary.evidence },
  };
}

export function validateLessonCoachDecision(
  value: unknown,
  summary: LessonCoachSummary,
): LessonCoachDecision | null {
  if (!isRecord(value)) return null;
  if (!shortText(value.correction) || !shortText(value.evidence)) return null;
  if (typeof value.retryActivityId !== "string") return null;
  if (![1, 2, 3].includes(value.repetitions as number)) return null;

  const lesson = courseLesson(summary.lessonId);
  const activity = lesson.activities.find((candidate) => candidate.id === value.retryActivityId);
  if (!activity || (activity.stage !== "play" && activity.stage !== "check")) return null;

  const activityTempo = "bpm" in activity ? activity.bpm : null;
  const tempoBpm = value.tempoBpm;
  if (tempoBpm !== null) {
    if (typeof tempoBpm !== "number" || !Number.isInteger(tempoBpm) || tempoBpm < 40 || tempoBpm > 120) return null;
    if (activityTempo === null || tempoBpm > activityTempo) return null;
  }

  return {
    correction: value.correction,
    evidence: value.evidence,
    retryActivityId: value.retryActivityId,
    tempoBpm: tempoBpm as number | null,
    repetitions: value.repetitions as 1 | 2 | 3,
  };
}

function shortText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 180;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
