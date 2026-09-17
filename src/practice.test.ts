import { describe, expect, it } from "vitest";
import {
  adaptPracticeTempo,
  formatPracticeTime,
  PracticePitchConfirmation,
  PracticePulseClock,
  practiceStageOffsetSeconds,
  TEN_MINUTE_SECONDS,
  TEN_MINUTE_STAGES,
} from "./practice";

describe("adaptive ten-minute practice", () => {
  it("keeps a phrase at its starting tempo even if the adaptive target changes", () => {
    const clock = new PracticePulseClock();
    expect(clock.grade(1000, 0, 72).grade).toBe("on-time");
    expect(clock.grade(1833, 1, 80).grade).toBe("on-time");
    expect(clock.bpm).toBe(72);
    clock.reset();
    expect(clock.grade(5000, 0, 80).grade).toBe("on-time");
    expect(clock.grade(5750, 1, 80).grade).toBe("on-time");
  });
  it("defines five stages totaling ten minutes", () => {
    expect(TEN_MINUTE_STAGES).toHaveLength(5);
    expect(TEN_MINUTE_SECONDS).toBe(600);
    expect(practiceStageOffsetSeconds(3)).toBe(360);
  });

  it("formats the countdown without negative values", () => {
    expect(formatPracticeTime(600)).toBe("10:00");
    expect(formatPracticeTime(61)).toBe("1:01");
    expect(formatPracticeTime(-1)).toBe("0:00");
  });

  it("slows after misses and raises tempo after a clean streak", () => {
    expect(adaptPracticeTempo(72, 0, 2)).toBe(64);
    expect(adaptPracticeTempo(72, 3, 0)).toBe(76);
    expect(adaptPracticeTempo(54, 0, 3)).toBe(52);
  });

  it("confirms one ringing note despite brief analysis gaps", () => {
    const confirmation = new PracticePitchConfirmation();

    expect(confirmation.observe("match", 0).progress).toBe(0.25);
    confirmation.observe("quiet", 40);
    confirmation.observe("match", 90);
    confirmation.observe("quiet", 130);
    confirmation.observe("match", 180);
    expect(confirmation.observe("match", 240).confirmed).toBe(true);
  });

  it("clears partial confirmation for a wrong note or a long silence", () => {
    const confirmation = new PracticePitchConfirmation();

    confirmation.observe("match", 0);
    confirmation.observe("match", 40);
    expect(confirmation.observe("mismatch", 70).matches).toBe(0);
    confirmation.observe("match", 100);
    expect(confirmation.observe("quiet", 500).matches).toBe(0);
  });
});
