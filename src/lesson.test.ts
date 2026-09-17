import { describe, expect, it } from "vitest";
import {
  chordMidiNotes,
  filterLessonSongs,
  LESSON_SONGS,
  isMelodyChapter,
  lessonLineEvents,
  lessonEvents,
  matchesChord,
  canPracticeLessonSong,
  lessonPlaybackEvents,
  lessonBackingChordEvents,
} from "./lesson";

describe("guided song chapters", () => {
  it("offers seven searchable courses with three chapters each", () => {
    expect(LESSON_SONGS.map((song) => song.title)).toEqual([
      "Lathe Di Chadar", "Khaab", "Sa Re Ga Ma", "Twinkle Twinkle", "Yellow", "I’m Yours", "Hedwig’s Theme",
    ]);
    expect(LESSON_SONGS.every((song) => song.lines.length === 4 && song.chapters.length === 3)).toBe(true);
    expect(filterLessonSongs("folk").map((song) => song.id)).toEqual(["lathe-di-chadar"]);
    expect(filterLessonSongs("akhil").map((song) => song.id)).toEqual(["khaab"]);
    expect(filterLessonSongs("solfege").map((song) => song.id)).toEqual(["sargam"]);
    expect(filterLessonSongs("nursery").map((song) => song.id)).toEqual(["twinkle-twinkle"]);
    expect(filterLessonSongs("coldplay").map((song) => song.id)).toEqual(["yellow"]);
    expect(filterLessonSongs("jason mraz").map((song) => song.id)).toEqual(["im-yours"]);
    expect(filterLessonSongs("harry potter").map((song) => song.id)).toEqual(["hedwigs-theme"]);
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

  it("teaches Yellow as C–G–F before the F–Am–G chorus turn", () => {
    const yellow = LESSON_SONGS.find((song) => song.id === "yellow")!;
    expect(yellow.lines.map((line) => line.chords)).toEqual([["C"], ["G"], ["F"], ["F", "Am", "G"]]);
    expect(yellow.chapters.map((chapter) => chapter.shortTitle)).toEqual(["Verse pulse", "Starry picking", "Island glow"]);
    expect(yellow.chapters[2].bpm).toBe(87);
    expect(yellow.chapters[2].fullPattern).toBe("D · D-U · U-D-U");
  });

  it("builds I’m Yours around the beginner C–G–Am–F loop", () => {
    const imYours = LESSON_SONGS.find((song) => song.id === "im-yours")!;
    expect(imYours.lines.flatMap((line) => line.chords)).toEqual(["C", "G", "Am", "F"]);
    expect(imYours.chapters.map((chapter) => chapter.shortTitle)).toEqual(["Four-chord loop", "Sunny picking", "Island strum"]);
    expect(imYours.chapters[2].fullPattern).toBe("D · D-U · U-D-U");
    expect(imYours.rightsDetail).toContain("lyrics and melody not included");
  });

  it("teaches a short G-minor Hedwig opening with a playable low-fret note path", () => {
    const hedwig = LESSON_SONGS.find((song) => song.id === "hedwigs-theme")!;
    const openMidi = [67, 60, 64, 69];
    const notes = hedwig.lines.flatMap((line) => line.notes ?? []);

    expect(hedwig.key).toBe("Gm");
    expect(hedwig.meter).toBe("3/4");
    expect(hedwig.provenance).toMatchObject({ type: "melody", status: "source-backed", playable: true });
    expect(canPracticeLessonSong(hedwig)).toBe(true);
    expect(hedwig.chapters.map((chapter) => chapter.technique)).toEqual(["melody", "melody", "melody"]);
    expect(notes.map((note) => openMidi[note.stringIndex] + note.fret)).toEqual([
      62, 67, 70, 69, 67, 74, 72, 69, 67, 70, 69, 66, 68, 74,
    ]);
    expect(notes.map((note) => [4 - note.stringIndex, note.fret])).toEqual([
      [3, 2], [2, 3], [1, 1], [1, 0], [2, 3], [1, 5], [1, 3], [1, 0],
      [2, 3], [1, 1], [1, 0], [2, 2], [2, 4], [1, 5],
    ]);
    expect(hedwig.lines.every((line) => line.beats === 3 && line.chords.length === 0)).toBe(true);
    expect(hedwig.rightsDetail).toContain("unofficial");
  });

  it("blocks unverified arrangements without deleting their course data", () => {
    const lathe = LESSON_SONGS.find((song) => song.id === "lathe-di-chadar")!;
    const khaab = LESSON_SONGS.find((song) => song.id === "khaab")!;
    const yellow = LESSON_SONGS.find((song) => song.id === "yellow")!;
    expect([lathe.provenance.status, khaab.provenance.status]).toEqual(["unverified", "unverified"]);
    expect(lathe.lines).toHaveLength(4);
    expect(khaab.chapters).toHaveLength(3);
    expect(canPracticeLessonSong(lathe)).toBe(false);
    expect(canPracticeLessonSong(khaab)).toBe(false);
    expect(canPracticeLessonSong(yellow)).toBe(true);
  });

  it("uses full chapter events while a demo is playing", () => {
    const yellow = LESSON_SONGS.find((song) => song.id === "yellow")!;
    const chapter = yellow.chapters[2];
    expect(lessonPlaybackEvents(yellow.lines[0], chapter, "preview", false)).toHaveLength(4);
    expect(lessonPlaybackEvents(yellow.lines[0], chapter, "preview", true)).toHaveLength(6);
  });

  it("schedules Twinkle's backing chord bed at the same phrase beats used by reference playback", () => {
    const twinkle = LESSON_SONGS.find((song) => song.id === "twinkle-twinkle")!;
    const chapter = twinkle.chapters[2];

    expect(lessonBackingChordEvents(twinkle.lines[0], chapter)).toEqual([
      { chord: "C", beat: 0, durationBeats: 8 / 3 },
      { chord: "F", beat: 8 / 3, durationBeats: 8 / 3 },
      { chord: "C", beat: 16 / 3, durationBeats: 8 / 3 },
    ]);
  });
});
