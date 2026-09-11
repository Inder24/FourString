import { describe, expect, it } from "vitest";
import {
  chordMidiNotes,
  filterLessonSongs,
  LESSON_SONGS,
  isMelodyChapter,
  lessonLineEvents,
  lessonEvents,
  matchesChord,
} from "./lesson";

describe("guided song chapters", () => {
  it("offers four searchable courses with three chapters each", () => {
    expect(LESSON_SONGS.map((song) => song.title)).toEqual(["Lathe Di Chadar", "Khaab", "Sa Re Ga Ma", "Twinkle Twinkle"]);
    expect(LESSON_SONGS.every((song) => song.lines.length === 4 && song.chapters.length === 3)).toBe(true);
    expect(filterLessonSongs("folk").map((song) => song.id)).toEqual(["lathe-di-chadar"]);
    expect(filterLessonSongs("akhil").map((song) => song.id)).toEqual(["khaab"]);
    expect(filterLessonSongs("solfege").map((song) => song.id)).toEqual(["sargam"]);
    expect(filterLessonSongs("nursery").map((song) => song.id)).toEqual(["twinkle-twinkle"]);
    expect(filterLessonSongs("missing")).toEqual([]);
  });

  it("keeps the copyrighted song as a lyric-free chord study", () => {
    const khaab = LESSON_SONGS[1];
    expect(khaab.rights).toBe("Chord study");
    expect(khaab.lines.every((line) => line.label.startsWith("Loop") || line.label.includes("chord") || line.label.includes("pulse"))).toBe(true);
    expect(khaab.lines.flatMap((line) => line.chords)).toContain("Am");
  });

  it("maps the lesson chords to the correct GCEA notes", () => {
    expect(chordMidiNotes("C")).toEqual([67, 60, 64, 72]);
    expect(chordMidiNotes("F")).toEqual([69, 60, 65, 69]);
    expect(chordMidiNotes("G")).toEqual([67, 62, 67, 71]);
    expect(chordMidiNotes("Am")).toEqual([69, 60, 64, 69]);
    expect(matchesChord([0, 0, 0, 3], "C")).toBe(true);
    expect(matchesChord([0, 0, 0, 2], "C")).toBe(false);
  });

  it("progresses from pulse to fingerpick and full flowing strum", () => {
    const chapters = LESSON_SONGS[0].chapters;
    expect(lessonEvents(chapters[0], "lines")).toHaveLength(4);
    expect(lessonEvents(chapters[1], "lines").map((event) => event.kind)).toEqual([
      "pluck", "pluck", "pluck", "pluck",
    ]);
    expect(lessonEvents(chapters[2], "lines")).toHaveLength(4);
    expect(lessonEvents(chapters[2], "full")).toHaveLength(6);
  });

  it("keeps the requested sargam string-and-fret ascent exact", () => {
    const sargam = LESSON_SONGS[2];
    const notes = sargam.lines.flatMap((line) => line.notes ?? []);
    expect(notes.map((note) => [4 - note.stringIndex, note.fret])).toEqual([
      [3, 0], [3, 2], [2, 0], [2, 1], [2, 3], [1, 0], [1, 2], [1, 3],
    ]);
    expect(notes.map((note) => note.solfege)).toEqual(["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni", "Sa"]);
    expect(isMelodyChapter(sargam.chapters[0])).toBe(true);
  });

  it("marks the quick Twinkle transition and adds a beginner down-strum chapter", () => {
    const twinkle = LESSON_SONGS[3];
    const thirdLine = lessonLineEvents(twinkle.lines[2], twinkle.chapters[0], "lines");
    expect(thirdLine.map((note) => [note.kind === "pluck" ? 4 - note.stringIndex : -1, note.kind === "pluck" ? note.fret : -1])).toEqual([
      [2, 3], [2, 3], [2, 1], [2, 1], [2, 0], [2, 0], [3, 2],
    ]);
    expect(thirdLine[2]).toMatchObject({ quick: true, beat: 1.5 });
    expect(twinkle.chapters[1].fullEvents.map((event) => event.kind)).toEqual(["strum", "strum", "strum", "strum"]);
  });
});
