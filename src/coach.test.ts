import { describe, expect, it } from "vitest";
import { evaluateCoachPitch, gradeRhythmHit, OnsetDetector } from "./coach";
import { TUNING_TARGETS } from "./tuner";

describe("listen and coach analysis", () => {
  it("grades a stable target note and nearby tuning errors", () => {
    const target = TUNING_TARGETS[0];
    expect(evaluateCoachPitch({ frequency: target.frequency, confidence: 0.98, rms: 0.2 }, target).grade).toBe("correct");
    expect(evaluateCoachPitch({ frequency: target.frequency * 2 ** (-36 / 1200), confidence: 0.98, rms: 0.2 }, target).grade).toBe("flat");
    expect(evaluateCoachPitch({ frequency: target.frequency * 2 ** (22 / 1200), confidence: 0.98, rms: 0.2 }, target).grade).toBe("close");
  });

  it("rejects a different string and quiet input", () => {
    expect(evaluateCoachPitch({ frequency: 261.63, confidence: 0.98, rms: 0.2 }, TUNING_TARGETS[0]).grade).toBe("wrong-note");
    expect(evaluateCoachPitch(null, TUNING_TARGETS[0]).grade).toBe("quiet");
  });

  it("grades rhythm against the nearest beat", () => {
    expect(gradeRhythmHit(1_000, 1_000, 60).grade).toBe("on-time");
    expect(gradeRhythmHit(1_750, 1_000, 60).grade).toBe("early");
    expect(gradeRhythmHit(2_250, 1_000, 60).grade).toBe("late");
    expect(gradeRhythmHit(3_000, 1_000, 60, 1).grade).toBe("late");
  });

  it("detects separated signal attacks without double-triggering", () => {
    const detector = new OnsetDetector();
    expect(detector.push(0.005, 0)).toBe(false);
    expect(detector.push(0.08, 10)).toBe(true);
    expect(detector.push(0.1, 40)).toBe(false);
    expect(detector.push(0.004, 240)).toBe(false);
    expect(detector.push(0.09, 260)).toBe(true);
  });

  it("accepts a fresh chord strum over a decaying chord without counting its tail twice", () => {
    const detector = new OnsetDetector(.018, 220);
    const frames: Array<[number, number]> = [[0,.003],[20,.04],[40,.055],[100,.05],[260,.041],[500,.03],[820,.027],[840,.034],[860,.048],[900,.052]];
    expect(frames.filter(([at,rms]) => detector.push(rms,at)).map(([at]) => at)).toEqual([20,840]);
  });
});
