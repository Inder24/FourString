import { expect, test, type Page } from "@playwright/test";

async function enableAudio(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Enable sound" }).click();
  await expect(page.locator("#instrument-frame")).toHaveAttribute("data-audio-ready", "true", { timeout: 15_000 });
}

test("loads the real sample instrument and latches a mouse shape", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your uke, wherever you are." })).toBeVisible();
  await enableAudio(page);

  const cChordAString = page.locator('.fret-cell[data-string="3"][data-fret="3"]');
  await cChordAString.click();
  await expect(cChordAString).toHaveClass(/is-latched/);
  await page.keyboard.press("Space");
  await expect(page.locator("#readout-label")).toHaveText("Last chord");
  await expect(page.locator("#last-note")).toHaveText("Frets 0–0–0–3 · G4 · C4 · E4 · C5");

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(cChordAString).not.toHaveClass(/is-latched/);
});

test("explore mode plays a fret immediately", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Explore" }).click();
  await page.locator('.fret-cell[data-string="1"][data-fret="2"]').click();
  await expect(page.locator("#last-note")).toContainText("D4 · C string · fret 2");
});

test("supports keyboard navigation, plucking, and reverse strum", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.locator('.fret-cell[data-string="0"][data-fret="1"]')).toHaveClass(/is-latched/);
  await page.keyboard.press("Digit1");
  await expect(page.locator("#last-note")).toContainText("A string · open");
  await page.keyboard.press("Shift+Space");
  await expect(page.locator("#readout-label")).toHaveText("Last strum");
  await expect(page.locator("#last-note")).toHaveText("Frets 1–0–0–0 · A♭4 · C4 · E4 · A4");
  await page.keyboard.press("Escape");
  await expect(page.locator('.fret-cell[data-string="0"][data-fret="1"]')).not.toHaveClass(/is-latched/);
});

test("taps the body to play the selected four-string shape together", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.locator('.fret-cell[data-string="0"][data-fret="2"]').click();
  await page.locator('.fret-cell[data-string="2"][data-fret="1"]').click();

  await page.locator("#strum-surface").click();

  await expect(page.locator("#readout-label")).toHaveText("Last chord");
  await expect(page.locator("#note-orb")).toHaveText("4");
  await expect(page.locator("#last-note")).toHaveText("Frets 2–0–1–0 · A4 · C4 · F4 · A4");
});

test("labels all four strings on the neck and body", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".string-identity strong")).toHaveText(["G", "C", "E", "A"]);
  await expect(page.locator(".body-string-name strong")).toHaveText(["G", "C", "E", "A"]);
  await expect(page.locator(".string-identity small")).toHaveText(["4", "3", "2", "1"]);
});

test("builds, repeats, plays, and stops a fingerpicking pattern", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Explore" }).click();
  await page.getByRole("button", { name: "Add notes" }).click();

  const cStringD = page.locator('.fret-cell[data-string="1"][data-fret="2"]');
  const aStringC = page.locator('.fret-cell[data-string="3"][data-fret="3"]');
  await cStringD.click();
  await cStringD.click();
  await aStringC.click();

  await expect(page.locator("#pattern-count")).toHaveText("3 / 15");
  await expect(page.locator(".pattern-step")).toHaveCount(3);
  await expect(cStringD.locator(".sequence-badge")).toHaveText("×2");
  await expect(page.locator(".pattern-step").nth(0)).toContainText("3·C");
  await expect(page.locator(".pattern-step").nth(2)).toContainText("1·A");

  await page.getByRole("button", { name: "Play fingerpicking pattern" }).click();
  await expect(page.getByRole("button", { name: "Stop fingerpicking pattern" })).toBeEnabled();
  await expect(page.locator(".pattern-step.is-current")).toHaveCount(1);
  await page.getByRole("button", { name: "Stop fingerpicking pattern" }).click();
  await expect(page.locator(".pattern-step.is-current")).toHaveCount(0);
});

test("limits a fingerpicking pattern to fifteen repeated notes", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Explore" }).click();
  await page.getByRole("button", { name: "Add notes" }).click();

  const repeated = page.locator('.fret-cell[data-string="0"][data-fret="2"]');
  for (let index = 0; index < 16; index += 1) await repeated.click();

  await expect(page.locator("#pattern-count")).toHaveText("15 / 15");
  await expect(page.locator(".pattern-step")).toHaveCount(15);
  await expect(repeated.locator(".sequence-badge")).toHaveText("×15");
});

test("tracks multiple touch frets while a separate pointer strums", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);

  await page.locator('.fret-cell[data-string="0"][data-fret="2"]').dispatchEvent("pointerdown", {
    pointerId: 41,
    pointerType: "touch",
    pressure: 0.5,
  });
  await page.locator('.fret-cell[data-string="2"][data-fret="1"]').dispatchEvent("pointerdown", {
    pointerId: 42,
    pointerType: "touch",
    pressure: 0.5,
  });
  await expect(page.locator('.fret-cell[data-string="0"][data-fret="2"]')).toHaveClass(/is-held/);
  await expect(page.locator('.fret-cell[data-string="2"][data-fret="1"]')).toHaveClass(/is-held/);

  const box = await page.locator("#strum-surface").boundingBox();
  if (!box) throw new Error("Strum surface is not visible");
  await page.locator("#strum-surface").dispatchEvent("pointerdown", {
    pointerId: 50,
    pointerType: "touch",
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height * 0.12,
    pressure: 0.5,
  });
  await page.locator("#strum-surface").dispatchEvent("pointermove", {
    pointerId: 50,
    pointerType: "touch",
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height * 0.88,
    pressure: 0.5,
  });
  await expect(page.locator("#readout-label")).toHaveText("Last strum");
  await expect(page.locator("#last-note")).toHaveText("Frets 2–0–1–0 · A4 · C4 · F4 · A4");
});

test("shows a retry state when a required audio asset fails", async ({ page }) => {
  await page.route("**/audio/C4.flac", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Enable sound" }).click();
  await expect(page.locator("#gate-title")).toHaveText("The strings did not load.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
  await expect(page.locator("#audio-status")).toHaveAttribute("data-status", "error");
});

test("keeps the instrument usable in portrait", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile-only responsive assertion");
  await page.goto("/");
  await expect(page.locator("#neck-scroll")).toBeVisible();
  await expect(page.locator("#strum-surface")).toBeVisible();
  const bodyBox = await page.locator("#strum-surface").boundingBox();
  expect(bodyBox?.width).toBeGreaterThan(300);
  const scrollMetrics = await page.locator("#neck-scroll").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(scrollMetrics.scrollWidth).toBeGreaterThan(scrollMetrics.clientWidth);
  const layoutMetrics = await page.evaluate(() => {
    const lastFret = document.querySelector<HTMLElement>('.fret-cell[data-string="3"][data-fret="12"]');
    const play = document.querySelector<HTMLElement>("#pattern-play");
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      lastFretWidth: lastFret?.getBoundingClientRect().width ?? 0,
      playHeight: play?.getBoundingClientRect().height ?? 0,
    };
  });
  expect(layoutMetrics.pageWidth).toBeLessThanOrEqual(layoutMetrics.viewportWidth);
  expect(layoutMetrics.lastFretWidth).toBeGreaterThanOrEqual(44);

  await enableAudio(page);
  await page.getByRole("button", { name: "Explore" }).click();
  expect((await page.locator("#pattern-arm").boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await page.locator("#pattern-play").boundingBox())?.height).toBeGreaterThanOrEqual(44);
});

test("renders a decoded sample through an OfflineAudioContext", async ({ page }) => {
  await page.goto("/");
  const peak = await page.evaluate(async () => {
    const decodeContext = new AudioContext();
    const response = await fetch("/audio/C4.flac");
    const decoded = await decodeContext.decodeAudioData(await response.arrayBuffer());
    const frameCount = Math.min(decoded.length, Math.floor(decoded.sampleRate * 0.5));
    const offline = new OfflineAudioContext(1, frameCount, decoded.sampleRate);
    const source = offline.createBufferSource();
    const gain = offline.createGain();
    source.buffer = decoded;
    gain.gain.value = 0.8;
    source.connect(gain).connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    await decodeContext.close();
    let maximum = 0;
    for (const sample of rendered.getChannelData(0)) maximum = Math.max(maximum, Math.abs(sample));
    return maximum;
  });
  expect(peak).toBeGreaterThan(0.01);
  expect(peak).toBeLessThanOrEqual(1);
});
