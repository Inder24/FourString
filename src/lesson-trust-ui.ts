import type { LessonSong } from "./lesson";
import { buildLessonPracticeScore, lessonTrust } from "./lesson-trust";

export function trustLabel(song: LessonSong): string {
  return lessonTrust(song).label;
}

export function lessonDownloadFilename(song: LessonSong): string {
  return `four-strings-${song.id}-practice-score.json`;
}

export function serializeLessonPracticeScore(song: LessonSong): string {
  return `${JSON.stringify(buildLessonPracticeScore(song), null, 2)}\n`;
}

export function downloadLessonPracticeScore(song: LessonSong): void {
  const url = URL.createObjectURL(new Blob([serializeLessonPracticeScore(song)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = lessonDownloadFilename(song);
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
