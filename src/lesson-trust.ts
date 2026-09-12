import {
  canPracticeLessonSong,
  chordMidiNotes,
  LESSON_CHORDS,
  lessonBackingChordEvents,
  lessonLineBeats,
  lessonLineEvents,
  type ChordName,
  type LessonGesture,
  type LessonMaterialType,
  type LessonPhase,
  type LessonSong,
  type LessonSourceStatus,
} from "./lesson";

export type LessonTrust = {
  status: LessonSourceStatus;
  label: "Source-backed study" | "Original exercise" | "Unverified";
  issues: string[];
};

export type LessonLibraryFilters = {
  status: "all" | LessonSourceStatus;
  type: "all" | "melody" | "accompaniment";
};

export type PracticeNote = {
  kind: "note";
  role?: "melody";
  stringIndex: number;
  physicalString: number;
  fret: number;
  midi: number;
  beat: number;
  durationBeats: number;
  chord?: ChordName;
  solfege?: string;
};

export type PracticeChord = {
  kind: "chord";
  name: ChordName;
  frets: number[];
  midi: number[];
  beat: number;
  durationBeats: number;
};

export type PracticeStrum = {
  kind: "chord";
  role?: "rhythm";
  chord: ChordName;
  direction: "down" | "up";
  frets: number[];
  midi: number[];
  beat: number;
  durationBeats: number;
};

export type PracticeBackingChord = {
  kind: "chord";
  role: "backing";
  chord: ChordName;
  frets: number[];
  midi: number[];
  beat: number;
  durationBeats: number;
};

export type LessonPracticeScore = {
  format: "four-strings-practice-score";
  schemaVersion: 1;
  song: {
    id: LessonSong["id"];
    title: string;
    type: LessonMaterialType;
    status: LessonSourceStatus;
    tuning: string[];
    key: string;
    arrangementVersion: string;
  };
  sources: { title: string; url: string; supports: string }[];
  lines: {
    label: string;
    beats: number;
    chords: PracticeChord[];
    notes: PracticeNote[];
  }[];
  chapters: {
    id: number;
    title: string;
    bpm: number;
    phases: Record<"guided" | "full", { lines: { label: string; beats: number; events: (PracticeNote | PracticeStrum | PracticeBackingChord)[] }[] }>;
  }[];
};

const STATUS_LABELS: Record<LessonSourceStatus, LessonTrust["label"]> = {
  "source-backed": "Source-backed study",
  original: "Original exercise",
  unverified: "Unverified",
};

const OPEN_STRING_MIDI = [67, 60, 64, 69] as const;

export function safeLessonSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "" ? url.href : null;
  } catch {
    return null;
  }
}

export function lessonTrust(song: LessonSong): LessonTrust {
  const issues: string[] = [];
  const provenance = song.provenance;
  if (!provenance || !["melody", "accompaniment", "exercise"].includes(provenance.type)) {
    issues.push("Lesson type is missing or invalid.");
  }
  if (!provenance?.arrangementVersion?.trim()) issues.push("Arrangement version is required.");
  if (!song.key.trim()) issues.push("Lesson key is required.");
  if (provenance?.tuning?.join(" ") !== "G4 C4 E4 A4") issues.push("Tuning must identify G4 C4 E4 A4.");
  if (provenance?.status === "source-backed") {
    if (provenance.sources.length === 0) issues.push("Source-backed lessons need at least one valid source.");
    if (provenance.sources.some((source) => !source.title.trim() || !source.supports.trim())) {
      issues.push("Every lesson source needs a title and a statement of what it supports.");
    }
    if (provenance.sources.some((source) => safeLessonSourceUrl(source.url) === null)) {
      issues.push("Every lesson source must use a valid HTTPS URL.");
    }
  }
  const status = issues.length > 0 ? "unverified" : provenance.status;
  return { status, label: STATUS_LABELS[status], issues };
}

export function filterLessonLibrary(
  songs: readonly LessonSong[],
  query: string,
  filters: LessonLibraryFilters,
): LessonSong[] {
  const normalized = query.trim().toLocaleLowerCase();
  return songs.filter((song) => {
    const trust = lessonTrust(song);
    const matchesStatus = filters.status === "all" || trust.status === filters.status;
    const matchesType = filters.type === "all" || song.provenance.type === filters.type;
    const haystack = [
      song.title,
      song.artist,
      song.genre,
      song.searchTerms,
      trust.label,
      song.provenance.type,
      ...song.provenance.sources.flatMap((source) => [source.title, source.supports]),
    ].join(" ").toLocaleLowerCase();
    return matchesStatus && matchesType && (!normalized || haystack.includes(normalized));
  });
}

export function buildLessonPracticeScore(song: LessonSong): LessonPracticeScore {
  if (!canPracticeLessonSong(song)) {
    throw new Error("Practice score export is unavailable for unverified lessons.");
  }
  const trust = lessonTrust(song);
  const lines = song.lines.map((line) => ({
    label: line.label,
    beats: line.notes ? lessonLineBeats(line, song.chapters.find((chapter) => chapter.technique === "melody") ?? song.chapters[0]) : Math.max(1, line.chords.length) * 4,
    chords: line.chords.map((name, index) => ({
      kind: "chord" as const,
      name,
      frets: [...LESSON_CHORDS[name].frets],
      midi: [...chordMidiNotes(name)],
      beat: index * 4,
      durationBeats: 4,
    })),
    notes: (line.notes ?? []).map((note) => noteToPracticeNote(note)),
  }));

  const score: LessonPracticeScore = {
    format: "four-strings-practice-score",
    schemaVersion: 1,
    song: {
      id: song.id,
      title: song.title,
      type: song.provenance.type,
      status: trust.status,
      tuning: [...song.provenance.tuning],
      key: song.key,
      arrangementVersion: song.provenance.arrangementVersion,
    },
    sources: song.provenance.sources
      .map((source) => ({ ...source, url: safeLessonSourceUrl(source.url) }))
      .filter((source): source is { title: string; url: string; supports: string } => source.url !== null),
    lines,
    chapters: song.chapters.map((chapter, chapterIndex) => ({
      id: chapter.id,
      title: chapter.title,
      bpm: chapter.bpm,
      phases: {
        guided: { lines: expandChapterLines(song, chapterIndex, "lines") },
        full: { lines: expandChapterLines(song, chapterIndex, "full") },
      },
    })),
  };
  const validation = validateLessonPracticeScore(score);
  if (!validation.valid) throw new Error(`Invalid lesson practice score: ${validation.issues.join(" ")}`);
  return score;
}

export function validateLessonPracticeScore(score: LessonPracticeScore): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (score.format !== "four-strings-practice-score" || score.schemaVersion !== 1) issues.push("Unsupported score format.");
  if (score.song.tuning.join(" ") !== "G4 C4 E4 A4") issues.push("Invalid tuning.");
  score.lines.forEach((line, lineIndex) => {
    if (!finiteNonNegative(line.beats)) issues.push(`Line ${lineIndex + 1} has an invalid beat length.`);
    line.notes.forEach((note, noteIndex) => validateNote(note, `Line ${lineIndex + 1} note ${noteIndex + 1}`, issues));
    line.chords.forEach((chord, chordIndex) => validateChord(chord, `Line ${lineIndex + 1} chord ${chordIndex + 1}`, issues));
  });
  score.chapters.forEach((chapter, chapterIndex) => {
    if (!finiteNonNegative(chapter.bpm) || chapter.bpm === 0) issues.push(`Chapter ${chapterIndex + 1} has an invalid tempo.`);
    (["guided", "full"] as const).forEach((phase) => {
      chapter.phases[phase].lines.forEach((line, lineIndex) => {
        if (!finiteNonNegative(line.beats)) issues.push(`Chapter ${chapterIndex + 1} ${phase} line ${lineIndex + 1} has an invalid beat length.`);
        line.events.forEach((event, eventIndex) => {
          const path = `Chapter ${chapterIndex + 1} ${phase} event ${eventIndex + 1}`;
          if (event.kind === "note") validateNote(event, path, issues);
          else validateChord(event, path, issues);
        });
      });
    });
  });
  return { valid: issues.length === 0, issues };
}

function expandChapterLines(song: LessonSong, chapterIndex: number, phase: Exclude<LessonPhase, "preview" | "complete">) {
  const chapter = song.chapters[chapterIndex];
  return song.lines.map((line) => {
    const events = chapter.technique === "melody"
      ? [
          ...lessonBackingChordEvents(line, chapter).map(({ chord, beat, durationBeats }) => ({
            kind: "chord" as const,
            role: "backing" as const,
            chord,
            frets: [...LESSON_CHORDS[chord].frets],
            midi: [...chordMidiNotes(chord)],
            beat,
            durationBeats,
          })),
          ...(line.notes ?? []).map((note) => noteToPracticeNote(note, "melody")),
        ].sort((a, b) => a.beat - b.beat)
      : line.chords.flatMap((chord, chordIndex) => expandChordGestures(chord, chordIndex * 4, lessonLineEvents(line, chapter, phase)));
    return { label: line.label, beats: lessonLineBeats(line, chapter), events };
  });
}

function expandChordGestures(chord: ChordName, offset: number, gestures: readonly LessonGesture[]): (PracticeNote | PracticeStrum)[] {
  return gestures.map((gesture) => {
    if (gesture.kind === "strum") {
      return {
        kind: "chord" as const,
        chord,
        direction: gesture.direction,
        frets: [...LESSON_CHORDS[chord].frets],
        midi: [...chordMidiNotes(chord)],
        beat: offset + gesture.beat,
        durationBeats: 0.5,
      };
    }
    const fret = LESSON_CHORDS[chord].frets[gesture.stringIndex];
    return {
      kind: "note" as const,
      chord,
      stringIndex: gesture.stringIndex,
      physicalString: 4 - gesture.stringIndex,
      fret,
      midi: OPEN_STRING_MIDI[gesture.stringIndex] + fret,
      beat: offset + gesture.beat,
      durationBeats: gesture.durationBeats ?? 1,
      ...(gesture.solfege ? { solfege: gesture.solfege } : {}),
    };
  });
}

function noteToPracticeNote(note: Extract<LessonGesture, { kind: "pluck" }>, role?: "melody"): PracticeNote {
  return {
    kind: "note",
    ...(role ? { role } : {}),
    stringIndex: note.stringIndex,
    physicalString: 4 - note.stringIndex,
    fret: note.fret ?? 0,
    midi: OPEN_STRING_MIDI[note.stringIndex] + (note.fret ?? 0),
    beat: note.beat,
    durationBeats: note.durationBeats ?? 1,
    ...(note.solfege ? { solfege: note.solfege } : {}),
  };
}

function validateNote(note: PracticeNote, path: string, issues: string[]): void {
  if (!Number.isInteger(note.stringIndex) || note.stringIndex < 0 || note.stringIndex > 3) issues.push(`${path} has an invalid string index.`);
  if (!Number.isInteger(note.fret) || note.fret < 0 || note.fret > 12) issues.push(`${path} has an invalid fret.`);
  if (!finiteNonNegative(note.beat)) issues.push(`${path} has an invalid beat.`);
  if (!Number.isFinite(note.durationBeats) || note.durationBeats <= 0) issues.push(`${path} has an invalid duration.`);
  if (!Number.isFinite(note.midi)) issues.push(`${path} has an invalid MIDI note.`);
}

function validateChord(chord: PracticeChord | PracticeStrum | PracticeBackingChord, path: string, issues: string[]): void {
  if (chord.frets.length !== 4 || chord.frets.some((fret) => !Number.isInteger(fret) || fret < 0 || fret > 12)) issues.push(`${path} has invalid frets.`);
  if (chord.midi.length !== 4 || chord.midi.some((midi) => !Number.isFinite(midi))) issues.push(`${path} has invalid MIDI notes.`);
  if (!finiteNonNegative(chord.beat)) issues.push(`${path} has an invalid beat.`);
  if (!Number.isFinite(chord.durationBeats) || chord.durationBeats <= 0) issues.push(`${path} has an invalid duration.`);
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
