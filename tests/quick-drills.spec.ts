import { test, expect } from "@playwright/test";

test("Quick drills belongs to Practice and preserves its selected destination", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Quick drills", exact: true }).click();
  await expect(page.locator("#nav-practice")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#coach-workbench")).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.locator("#mode-coach")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "AI Coach", exact: true })).toBeVisible();
});

test("pulse displays independently graded gaps and a seven-gap summary", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Quick drills", exact: true }).click();
  await page.getByRole("button", { name: "Steady pulse" }).click();
  await page.getByRole("button", { name: "Start coaching", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-audio-ready", "true");
  await expect(page.locator("#audio-gate")).toHaveClass(/is-hidden/);
  await page.clock.install();
  await page.keyboard.press("Space");
  for (const gap of [1200, 833, 450, 833, 833, 833, 833]) {
    await page.clock.runFor(gap);
    await page.keyboard.press("Space");
  }
  await expect(page.locator("#coach-beats > span").nth(1)).toHaveAttribute("data-grade", "late");
  await expect(page.locator("#coach-beats > span").nth(2)).toHaveAttribute("data-grade", "on-time");
  await expect(page.locator("#coach-beats > span").nth(3)).toHaveAttribute("data-grade", "early");
  await expect(page.locator("#coach-heard-detail")).toContainText("Target: 833 ms");
  await expect(page.locator("#coach-status")).toContainText("5 of 7 gaps steady");
  await page.screenshot({ path: `test-results/quick-drills-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Practice again", exact: true }).click();
  await page.keyboard.press("Space");
  await page.clock.runFor(3000);
  await page.keyboard.press("Space");
  await expect(page.locator("#coach-progress")).toHaveText("1 of 8 strums");
  await expect(page.locator("#coach-status")).toContainText("Pause detected");
  await page.clock.runFor(833);
  await page.keyboard.press("Space");
  await expect(page.locator("#coach-beats > span").nth(1)).toHaveAttribute("data-grade", "on-time");
});

test("microphone confirmation survives brief gaps and stops when leaving Quick drills", async ({ page }) => {
  await page.addInitScript(() => {
    const fixture = { frequency: 391.995, frames: 0, stopped: 0 };
    (window as any).__drillMic = fixture;
    class FakeAnalyser {
      fftSize = 4096;
      smoothingTimeConstant = 0;
      getFloatTimeDomainData(buffer: Float32Array) {
        fixture.frames++;
        const volume = fixture.frames % 5 === 0 ? 0 : 0.4;
        for (let i = 0; i < buffer.length; i++) buffer[i] = Math.sin(2 * Math.PI * fixture.frequency * i / 48000) * volume;
      }
    }
    class FakeAudioContext {
      state = "running";
      sampleRate = 48000;
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createAnalyser() { return new FakeAnalyser(); }
      async resume() {}
      async close() {}
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async () => ({ getTracks: () => [{ stop() { fixture.stopped++; } }] }),
    } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Quick drills", exact: true }).click();
  await page.getByRole("button", { name: "My ukulele", exact: true }).click();
  await page.getByRole("button", { name: "Start coaching", exact: true }).click();
  await expect(page.locator("#coach-goal")).toHaveText("Play C4");
  await expect(page.locator("#coach-acceptance")).toContainText("G accepted ✓ — play C next");
  await page.evaluate(() => { (window as any).__drillMic.frequency = 261.626; });
  await expect(page.locator("#coach-goal")).toHaveText("Play E4");
  await expect(page.locator("#coach-acceptance")).toContainText("C accepted ✓ — play E next");
  await page.getByRole("button", { name: "10-minute session", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__drillMic.stopped)).toBe(1);
  await page.getByRole("button", { name: "Quick drills", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start coaching", exact: true })).toBeVisible();
});
