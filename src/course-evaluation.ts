import type { LessonEvaluation } from "./course-progress";

export interface CourseRhythmResult {
  expectedCount: number;
  onTime: number;
  missed: number;
  extra: number;
}

export interface CourseCompositeResult {
  ear: boolean;
  chords: boolean;
  rhythm: boolean;
  performance: boolean;
}

export function evaluateCourseEarChoice(
  expected: string,
  selected: string,
  instrumentRevealed: boolean,
): LessonEvaluation {
  const correct = expected === selected;
  return {
    attempted: true,
    secure: correct && !instrumentRevealed,
    accuracy: correct ? 1 : 0,
    evidence: { correct, instrumentRevealed },
    retryHint: instrumentRevealed
      ? "Try again before touching the instrument so the answer counts toward Secure."
      : correct
        ? "You heard it clearly."
        : "Hear the example again, then listen for the musical home.",
  };
}

export function evaluateCourseNoteSequence(
  expectedMidi: readonly number[],
  heardMidi: readonly number[],
): LessonEvaluation {
  const matched = longestCommonSubsequenceLength(expectedMidi, heardMidi);
  const accuracy = expectedMidi.length === 0 ? null : matched / expectedMidi.length;
  return {
    attempted: heardMidi.length > 0,
    secure: expectedMidi.length > 0 && matched === expectedMidi.length && heardMidi.length === expectedMidi.length,
    accuracy,
    evidence: { expected: expectedMidi.length, heard: heardMidi.length, matched },
    retryHint: matched === expectedMidi.length
      ? "The whole phrase landed in order."
      : "Slow it down and follow one highlighted note at a time.",
  };
}

export function evaluateCourseChordSequence(
  expected: readonly string[],
  heard: readonly (string | null)[],
): LessonEvaluation {
  const matched = expected.reduce((count, chord, index) => count + (heard[index] === chord ? 1 : 0), 0);
  const uncertain = heard.reduce((count, chord) => count + (chord === null ? 1 : 0), 0);
  const accuracy = expected.length === 0 ? null : matched / expected.length;
  return {
    attempted: heard.length > 0,
    secure: expected.length > 0 && matched === expected.length && heard.length === expected.length,
    accuracy,
    evidence: { expected: expected.length, heard: heard.length, matched, uncertain },
    retryHint: uncertain > 0
      ? "The whole chord was uncertain. Use the string-by-string check and let every note ring."
      : matched === expected.length
        ? "Every chord matched."
        : "Try the change again slowly and check each shape before strumming.",
  };
}

export function evaluateCourseRhythm(result: CourseRhythmResult): LessonEvaluation {
  const expected = Math.max(0, result.expectedCount);
  const accuracy = expected === 0 ? null : Math.min(1, Math.max(0, result.onTime / expected));
  const secure = accuracy !== null && accuracy >= 0.75 && result.missed <= 1 && result.extra <= 1;
  return {
    attempted: result.onTime + result.missed + result.extra > 0,
    secure,
    accuracy,
    evidence: {
      expected,
      onTime: result.onTime,
      missed: result.missed,
      extra: result.extra,
      directionMeasured: false,
    },
    retryHint: secure
      ? "Your attacks held the pulse."
      : "Keep the hand moving and aim each sound at the bright beat marker.",
  };
}

export function evaluateCourseDynamics(
  levels: readonly number[],
  accentIndices: readonly number[],
): LessonEvaluation {
  const accentSet = new Set(accentIndices);
  const accented = levels.filter((_, index) => accentSet.has(index));
  const unaccented = levels.filter((_, index) => !accentSet.has(index));
  if (accented.length === 0 || unaccented.length === 0) {
    return {
      attempted: levels.length > 0,
      secure: false,
      accuracy: null,
      evidence: { accented: accented.length, unaccented: unaccented.length },
      retryHint: "Play both accented and unaccented strokes so their relative loudness can be compared.",
    };
  }
  const accentMedian = median(accented);
  const plainMedian = median(unaccented);
  const ratio = plainMedian > 0 ? accentMedian / plainMedian : 0;
  const secure = ratio >= 1.2;
  return {
    attempted: true,
    secure,
    accuracy: Math.min(1, Math.max(0, ratio / 1.2)),
    evidence: { accentMedian, plainMedian, ratio },
    retryHint: secure
      ? "The accents stand out while the pulse stays intact."
      : "Keep the quiet strokes relaxed, then give the marked beat a little more weight.",
  };
}

export function evaluateCourseComposite(result: CourseCompositeResult): LessonEvaluation {
  const objectivesMet = Object.values(result).filter(Boolean).length;
  const accuracy = objectivesMet / 4;
  return {
    attempted: true,
    secure: objectivesMet >= 3,
    accuracy,
    evidence: { ...result, objectivesMet },
    retryHint: objectivesMet >= 3
      ? "Three musical skills came together in one performance."
      : "Repeat the weakest objective on its own, then return to the full lab.",
  };
}

function longestCommonSubsequenceLength(left: readonly number[], right: readonly number[]): number {
  const previous = new Array(right.length + 1).fill(0) as number[];
  for (const leftNote of left) {
    let diagonal = 0;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = leftNote === right[column - 1]
        ? diagonal + 1
        : Math.max(previous[column], previous[column - 1]);
      diagonal = above;
    }
  }
  return previous[right.length];
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
