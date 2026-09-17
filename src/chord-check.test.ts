import { describe, expect, it } from 'vitest';
import { classifyChordNotes } from './chord-check';

const notes = (...pitches: number[]) => pitches.map((pitchMidi) => ({
  pitchMidi,
  amplitude: 0.8,
  durationSeconds: 0.45,
  startTimeSeconds: 0.2,
}));

describe('chord checking', () => {
  it.each([
    ['C', [67, 60, 64, 72]],
    ['Am', [69, 60, 64, 69]],
    ['F', [69, 60, 65, 69]],
    ['G', [67, 62, 67, 71]],
  ] as const)('recognises the notes of %s without requiring doubled strings', (target, pitches) => {
    const result = classifyChordNotes(target, notes(...pitches));
    expect(result.status).toBe('match');
    expect(result.likelyChord).toBe(target);
  });

  it('does not declare C from C and E alone, which also fit Am', () => {
    expect(classifyChordNotes('C', notes(60, 64)).status).toBe('uncertain');
  });

  it('can identify a clearly different supported chord', () => {
    const result = classifyChordNotes('C', notes(67, 62, 71));
    expect(result.status).toBe('different');
    expect(result.likelyChord).toBe('G');
  });

  it('asks for another try when silence or only transients were heard', () => {
    expect(classifyChordNotes('F', []).status).toBe('uncertain');
    expect(classifyChordNotes('F', [{ ...notes(65)[0], durationSeconds: 0.02 }]).status).toBe('uncertain');
  });
});
