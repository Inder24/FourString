import { describe, expect, it } from "vitest";
import { canPracticeLessonSong, LESSON_SONGS, type LessonSong } from "./lesson";
import {
  buildLessonPracticeScore,
  filterLessonLibrary,
  lessonTrust,
  safeLessonSourceUrl,
  validateLessonPracticeScore,
} from "./lesson-trust";
import { lessonDownloadFilename, serializeLessonPracticeScore, trustLabel } from "./lesson-trust-ui";

describe("lesson provenance", () => {
  it("does not call a source-backed lesson source-backed when its evidence metadata is missing", () => {
    const twinkle = LESSON_SONGS.find((song) => song.id === "twinkle-twinkle")!;
    const missingSources = {
      ...twinkle,
      provenance: { ...twinkle.provenance, sources: [] },
    } as LessonSong;

    expect(lessonTrust(twinkle)).toMatchObject({ status: "source-backed", label: "Source-backed study", issues: [] });
    expect(lessonTrust(missingSources)).toMatchObject({ status: "unverified", label: "Unverified" });
    expect(lessonTrust(missingSources).issues).toContain("Source-backed lessons need at least one valid source.");
    expect(canPracticeLessonSong(missingSources)).toBe(false);
  });

  it("keeps an original exercise distinct from source-backed studies and review claims", () => {
    const sargam = LESSON_SONGS.find((song) => song.id === "sargam")!;

    expect(lessonTrust(sargam)).toEqual({ status: "original", label: "Original exercise", issues: [] });
    expect(trustLabel(sargam)).toBe("Original exercise");
    expect(trustLabel(sargam).toLowerCase()).not.toContain("review");
  });

  it("keeps Lathe Di Chadar and Khaab blocked as unverified studies", () => {
    const blocked = LESSON_SONGS.filter((song) => song.id === "lathe-di-chadar" || song.id === "khaab");

    expect(blocked.map((song) => lessonTrust(song).status)).toEqual(["unverified", "unverified"]);
    expect(blocked.every((song) => song.provenance.playable === false)).toBe(true);
    for (const song of blocked) {
      expect(() => buildLessonPracticeScore(song)).toThrow("Practice score export is unavailable for unverified lessons.");
      expect(() => serializeLessonPracticeScore(song)).toThrow("Practice score export is unavailable for unverified lessons.");
    }
  });

  it("rejects unsafe and malformed source URLs", () => {
    expect(safeLessonSourceUrl("https://ukuleletricks.com/strum-your-first-song/")).toBe("https://ukuleletricks.com/strum-your-first-song/");
    expect(safeLessonSourceUrl("javascript:alert(1)")).toBeNull();
    expect(safeLessonSourceUrl("/relative-source")).toBeNull();
    expect(safeLessonSourceUrl("not a url")).toBeNull();

    const yellow = LESSON_SONGS.find((song) => song.id === "yellow")!;
    const unsafe = {
      ...yellow,
      provenance: {
        ...yellow.provenance,
        sources: [{ title: "Unsafe", url: "javascript:alert(1)", supports: "Nothing trustworthy" }],
      },
    } as LessonSong;
    expect(lessonTrust(unsafe).status).toBe("unverified");
    expect(lessonTrust(unsafe).issues).toContain("Every lesson source must use a valid HTTPS URL.");
  });
});

describe("practice score export", () => {
  it("expands actual Twinkle notes and chord gestures with frets, MIDI notes, and beats", () => {
    const twinkle = LESSON_SONGS.find((song) => song.id === "twinkle-twinkle")!;
    const score = buildLessonPracticeScore(twinkle);

    expect(score.song).toMatchObject({
      id: "twinkle-twinkle",
      type: "melody",
      status: "source-backed",
      tuning: ["G4", "C4", "E4", "A4"],
      key: "C",
    });
    expect(score.lines[0].notes[0]).toEqual({
      kind: "note",
      stringIndex: 1,
      physicalString: 3,
      fret: 0,
      midi: 60,
      beat: 0,
      durationBeats: 1,
    });
    expect(score.lines[0].chords[1]).toMatchObject({ name: "F", frets: [2, 0, 1, 0], midi: [69, 60, 65, 69], beat: 4 });
    expect(score.chapters[1].phases.full.lines[0].events[4]).toMatchObject({
      kind: "chord",
      chord: "F",
      direction: "down",
      frets: [2, 0, 1, 0],
      midi: [69, 60, 65, 69],
      beat: 4,
    });
    expect(validateLessonPracticeScore(score)).toEqual({ valid: true, issues: [] });
  });

  it("exports Twinkle's backing chord bed in the same beat order as the player", () => {
    const twinkle = LESSON_SONGS.find((song) => song.id === "twinkle-twinkle")!;
    const line = buildLessonPracticeScore(twinkle).chapters[2].phases.full.lines[0];
    const backing = line.events.filter((event) => event.role === "backing");

    expect(backing).toEqual([
      { kind: "chord", role: "backing", chord: "C", frets: [0, 0, 0, 3], midi: [67, 60, 64, 72], beat: 0, durationBeats: 8 / 3 },
      { kind: "chord", role: "backing", chord: "F", frets: [2, 0, 1, 0], midi: [69, 60, 65, 69], beat: 8 / 3, durationBeats: 8 / 3 },
      { kind: "chord", role: "backing", chord: "C", frets: [0, 0, 0, 3], midi: [67, 60, 64, 72], beat: 16 / 3, durationBeats: 8 / 3 },
    ]);
    expect(line.events.map((event) => event.beat)).toEqual([0, 0, 1, 2, 8 / 3, 3, 4, 5, 16 / 3, 6]);
    expect(line.events.at(-1)).toMatchObject({ kind: "note", beat: 6, durationBeats: 2 });
  });

  it.each([
    ["fret above 12", { fret: 13 }],
    ["negative fret", { fret: -1 }],
    ["string above 3", { stringIndex: 4 }],
    ["negative beat", { beat: -0.5 }],
    ["non-finite beat", { beat: Number.NaN }],
  ])("rejects a score with an invalid %s", (_name, mutation) => {
    const sargam = LESSON_SONGS.find((song) => song.id === "sargam")!;
    const score = structuredClone(buildLessonPracticeScore(sargam));
    Object.assign(score.lines[0].notes[0], mutation);

    expect(validateLessonPracticeScore(score).valid).toBe(false);
  });

  it("serializes the validated actual score as a stable lesson download", () => {
    const yellow = LESSON_SONGS.find((song) => song.id === "yellow")!;
    const payload = JSON.parse(serializeLessonPracticeScore(yellow));

    expect(lessonDownloadFilename(yellow)).toBe("four-strings-yellow-practice-score.json");
    expect(payload.song.arrangementVersion).toBe(yellow.provenance.arrangementVersion);
    expect(payload.lines[3].chords.map((chord: { name: string }) => chord.name)).toEqual(["F", "Am", "G"]);
    expect(payload.chapters[2].phases.full.lines[3].events).toHaveLength(18);
  });
});

describe("lesson library filtering", () => {
  it("combines search with provenance and lesson-type filters", () => {
    expect(filterLessonLibrary(LESSON_SONGS, "", { status: "source-backed", type: "all" }).map((song) => song.id)).toEqual([
      "twinkle-twinkle", "yellow", "im-yours",
    ]);
    expect(filterLessonLibrary(LESSON_SONGS, "", { status: "original", type: "all" }).map((song) => song.id)).toEqual(["sargam"]);
    expect(filterLessonLibrary(LESSON_SONGS, "yellow", { status: "source-backed", type: "accompaniment" }).map((song) => song.id)).toEqual(["yellow"]);
    expect(filterLessonLibrary(LESSON_SONGS, "khaab", { status: "source-backed", type: "all" })).toEqual([]);
  });
});
