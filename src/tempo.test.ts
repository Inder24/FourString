import { describe, expect, it } from 'vitest';
import { BeatSchedule, TapTempo, nextGentleTempo } from './tempo';

describe('tempo transport', () => {
  it('schedules exact four-beat accents against the audio clock', () => {
    const schedule = new BeatSchedule(120);
    schedule.start(10);
    expect(schedule.due(10, .11)).toEqual([{ at: 10, beat: 1, accent: true }]);
    expect(schedule.due(10.45, .11)).toEqual([{ at: 10.5, beat: 2, accent: false }]);
    expect(schedule.due(10.95, .11)).toEqual([{ at: 11, beat: 3, accent: false }]);
    expect(schedule.due(11.45, .11)).toEqual([{ at: 11.5, beat: 4, accent: false }]);
    expect(schedule.due(11.95, .11)).toEqual([{ at: 12, beat: 1, accent: true }]);
  });

  it('changes BPM without carrying timing from an earlier tempo', () => {
    const schedule = new BeatSchedule(60);
    schedule.start(1);
    schedule.due(1, .1);
    schedule.setBpm(120, 1.5);
    expect(schedule.due(1.5, .1)).toEqual([{ at: 1.5, beat: 1, accent: true }]);
    expect(schedule.due(1.95, .1)).toEqual([{ at: 2, beat: 2, accent: false }]);
  });

  it('retimes the next beat at a loop boundary without restarting the four-beat count', () => {
    const schedule = new BeatSchedule(60);
    schedule.start(1);
    schedule.due(1, .1);
    schedule.due(2, .1);
    schedule.due(3, .1);
    expect(schedule.due(4, .1)).toEqual([{ at: 4, beat: 4, accent: false }]);
    schedule.retimeNextBeat(64, 4);
    expect(schedule.due(4.94, .1)).toEqual([{ at: 4.9375, beat: 1, accent: true }]);
  });

  it('moves gently both ways and stays near the selected base tempo', () => {
    const samples = [0, 0, .99, .99];
    const random = () => samples.shift()!;
    expect(nextGentleTempo(72, 72, random)).toBe(70);
    expect(nextGentleTempo(70, 72, random)).toBe(74);
    expect(nextGentleTempo(82, 72, () => .99)).toBe(78);
  });

  it('skips missed beats after a suspended tab instead of queuing stale audio', () => {
    const schedule = new BeatSchedule(60);
    schedule.start(0);
    schedule.due(0, .1);
    expect(schedule.due(103.5, .1)).toEqual([]);
    expect(schedule.due(103.95, .1)).toEqual([{ at: 104, beat: 1, accent: true }]);
  });

  it('calculates tap tempo from recent taps and resets after a long pause', () => {
    const tap = new TapTempo();
    tap.push(0);
    expect(tap.push(500)).toBe(120);
    expect(tap.push(1000)).toBe(120);
    expect(tap.push(4000)).toBeNull();
  });
});
