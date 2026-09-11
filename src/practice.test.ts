import { describe, expect, it } from "vitest";
import { adaptPracticeTempo, formatPracticeTime, practiceStageOffsetSeconds, TEN_MINUTE_SECONDS, TEN_MINUTE_STAGES } from "./practice";

describe("adaptive ten-minute practice", () => {
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
});
