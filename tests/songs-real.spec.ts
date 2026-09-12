import { expect, test, type Page } from "@playwright/test";

async function enableAudio(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Play on screen", exact: true }).click();
  await expect(page.locator("#instrument-frame")).toHaveAttribute("data-audio-ready", "true", { timeout: 15_000 });
}

async function openSong(page: Page, id: string): Promise<void> {
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.locator(`.song-result[data-song-id="${id}"]`).click();
}

async function installSyntheticMic(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = { frequency: 0, amplitude: 0, stopped: 0 };
    (window as unknown as { songMic: typeof state }).songMic = state;
    class SyntheticAnalyser {
      fftSize = 4096;
      smoothingTimeConstant = 0;
      getFloatTimeDomainData(buffer: Float32Array) {
        const { frequency, amplitude } = (window as unknown as { songMic: typeof state }).songMic;
        for (let index = 0; index < buffer.length; index += 1) {
          buffer[index] = frequency > 0 ? Math.sin((2 * Math.PI * frequency * index) / 48_000) * amplitude : 0;
        }
      }
    }
    class SyntheticAudioContext {
      state = "running";
      sampleRate = 48_000;
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createAnalyser() { return new SyntheticAnalyser(); }
      async resume() {}
      async close() {}
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: SyntheticAudioContext });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => { state.stopped += 1; } }] }) },
    });
  });
}

async function setMic(page: Page, frequency: number, amplitude = 0.4): Promise<void> {
  await page.evaluate(({ frequency, amplitude }) => {
    const state = (window as unknown as { songMic: { frequency: number; amplitude: number } }).songMic;
    state.frequency = frequency;
    state.amplitude = amplitude;
  }, { frequency, amplitude });
}

async function pulsePitch(page: Page, frequency: number, durationMs = 180): Promise<void> {
  await setMic(page, frequency);
  await page.waitForTimeout(durationMs);
  await setMic(page, 0, 0);
}

test("real Twinkle requires a fresh attack for its repeated opening note", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await installSyntheticMic(page);
  await openSong(page, "twinkle-twinkle");
  await page.getByRole("button", { name: "Real ukulele", exact: true }).click();
  await page.getByRole("button", { name: "Start practice", exact: true }).click();

  await setMic(page, 261.63);
  await expect(page.locator("#lesson-cue-beat")).toHaveText("Move 2 of 7");
  await page.waitForTimeout(260);
  await expect(page.locator("#lesson-cue-beat")).toHaveText("Move 2 of 7");
  await setMic(page, 0, 0);
  await page.waitForTimeout(220);
  await setMic(page, 261.63);
  await expect(page.locator("#lesson-cue-beat")).toHaveText("Move 3 of 7");
  await expect(page.locator("#lesson-heard-status")).toContainText("Expected G4");
  await setMic(page, 0, 0);
});

test("real Sargam crosses line boundaries and accepts the high C5", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await installSyntheticMic(page);
  await openSong(page, "sargam");
  await page.getByRole("button", { name: "Real ukulele", exact: true }).click();
  await page.getByRole("button", { name: "Start practice", exact: true }).click();

  await pulsePitch(page, 261.63, 200);
  await page.waitForTimeout(220);
  await pulsePitch(page, 293.66, 260);
  await expect(page.locator("#lesson-cue-line")).toContainText("Part 2 · Ga · Ma");
  await expect(page.locator("#lesson-cue-frets")).toContainText("2,0 · E4");
  for (const frequency of [329.63, 349.23, 392, 440, 493.88, 523.25]) {
    await setMic(page, frequency);
    await page.waitForTimeout(300);
  }
  await setMic(page, 0, 0);
  await expect(page.locator("#lesson-progress")).toContainText("Full run · part 1 of 4");
  await expect(page.locator("#lesson-cue-frets")).toContainText("3,0 · C4");
});

test("real chord reference sound is suppressed before a learner onset is counted", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await installSyntheticMic(page);
  await openSong(page, "yellow");
  await page.getByRole("button", { name: "Real ukulele", exact: true }).click();
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await page.locator("#lesson-shape-check").check();
  await page.locator("#lesson-direction-check").check();

  await page.locator("#lesson-hear-chord").click();
  await setMic(page, 200, 0.2);
  await page.waitForTimeout(260);
  await setMic(page, 0, 0);
  await page.locator("#lesson-hear-chord").click();
  await expect(page.locator("#lesson-cue-beat")).toHaveText("Move 1 of 4");
  await page.waitForTimeout(220);
  await setMic(page, 200, 0.2);
  await page.waitForTimeout(80);
  await setMic(page, 0, 0);
  await expect(page.locator("#lesson-cue-beat")).toHaveText("Move 2 of 4");
});

test("real song permission denial stays retryable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException("Denied", "NotAllowedError"); } },
    });
  });
  await page.goto("/");
  await openSong(page, "sargam");
  await page.getByRole("button", { name: "Real ukulele", exact: true }).click();
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await expect(page.locator("#lesson-heard-status")).toContainText("Microphone access was denied");
  await expect(page.locator("#lesson-heard-status")).toContainText("retry");
  await expect(page.getByRole("button", { name: "Reset practice", exact: true })).toBeEnabled();
});

test("navigation cancels pending real song permission and stops the late stream", async ({ page }) => {
  await page.addInitScript(() => {
    const pending = { resolve: null as null | ((stream: { getTracks: () => { stop: () => void }[] }) => void), stopped: 0 };
    (window as unknown as { pendingSongMic: typeof pending }).pendingSongMic = pending;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => new Promise((resolve) => { pending.resolve = resolve; }) },
    });
  });
  await page.goto("/");
  await openSong(page, "sargam");
  await page.getByRole("button", { name: "Real ukulele", exact: true }).click();
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await expect(page.locator("#lesson-heard-status")).toContainText("Waiting for microphone permission");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() => {
    const pending = (window as unknown as { pendingSongMic: { resolve: (stream: { getTracks: () => { stop: () => void }[] }) => void; stopped: number } }).pendingSongMic;
    pending.resolve({ getTracks: () => [{ stop: () => { pending.stopped += 1; } }] });
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { pendingSongMic: { stopped: number } }).pendingSongMic.stopped)).toBe(1);
  await expect(page.locator("body")).toHaveAttribute("data-app-view", "strum");
});
