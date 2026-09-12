import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openSongs(page: Parameters<typeof test>[0]["page"]): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
}

async function enableAudio(page: Parameters<typeof test>[0]["page"]): Promise<void> {
  await page.getByRole("button", { name: "Play on screen", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-audio-ready", "true", { timeout: 15_000 });
}

test("filters the lesson library by source status and material type with an honest empty state", async ({ page }) => {
  await openSongs(page);

  await page.locator("#lesson-status-filter").selectOption("source-backed");
  await expect(page.locator(".song-result")).toHaveCount(3);
  await page.locator("#lesson-type-filter").selectOption("melody");
  await expect(page.locator(".song-result")).toHaveCount(1);
  await expect(page.locator(".song-result")).toHaveAttribute("data-song-id", "twinkle-twinkle");

  await page.locator("#song-search").fill("Khaab");
  await expect(page.locator("#song-results")).toContainText("No lessons match this search and filter combination.");
  await expect(page.locator("#song-results")).toContainText("Clear the search or choose All");
});

test("shows source scope and downloads the selected lesson's actual practice score", async ({ page }) => {
  await openSongs(page);
  await expect(page.locator("#lesson-download")).toBeDisabled();
  await expect(page.locator("#lesson-download")).toHaveText("Practice JSON unavailable");
  await page.locator('.song-result[data-song-id="khaab"]').click();
  await expect(page.locator("#lesson-download")).toBeDisabled();
  await page.locator('.song-result[data-song-id="yellow"]').click();

  await expect(page.locator("#lesson-trust-label")).toHaveText("Source-backed study");
  await expect(page.locator("#lesson-download")).toBeEnabled();
  await page.locator("#lesson-provenance summary").click();
  const source = page.locator('#lesson-source-list a[href="https://ukutabs.com/c/coldplay/yellow/"]');
  await expect(source).toHaveText("Yellow by Coldplay — Ukulele Chords & Tabs");
  await expect(page.locator("#lesson-provenance")).toContainText("do not endorse or review this Four Strings arrangement");
  await expect(page.locator("#lesson-provenance")).toContainText("G4 · C4 · E4 · A4");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download practice JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("four-strings-yellow-practice-score.json");
  const path = await download.path();
  expect(path).not.toBeNull();
  const score = JSON.parse(await readFile(path!, "utf8"));
  expect(score.song).toMatchObject({ id: "yellow", status: "source-backed", type: "accompaniment" });
  expect(score.lines[3].chords.map((chord: { name: string }) => chord.name)).toEqual(["F", "Am", "G"]);
  expect(score.chapters[2].phases.full.lines[3].events).toHaveLength(18);
});

test("keeps source controls touch-friendly on a narrow lesson library", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSongs(page);

  for (const selector of ["#lesson-status-filter", "#lesson-type-filter", "#lesson-download"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test("blocks every reference action for unverified lessons while verified lessons stay playable", async ({ page }) => {
  await openSongs(page);
  await enableAudio(page);

  for (const songId of ["lathe-di-chadar", "khaab"]) {
    await page.locator(`.song-result[data-song-id="${songId}"]`).click();
    await expect(page.locator("#lesson-hear-chord")).toBeDisabled();
    await expect(page.locator("#lesson-hear-bar")).toBeDisabled();

    for (const referenceId of ["lesson-hear-chord", "lesson-hear-bar"]) {
      await page.locator(`#${referenceId}`).evaluate((button: HTMLButtonElement) => {
        button.disabled = false;
        button.click();
      });
      await page.waitForTimeout(50);
      expect(await page.locator(`#${referenceId}`).getAttribute("aria-pressed")).toBe("false");
    }
  }

  await page.locator('.song-result[data-song-id="yellow"]').click();
  await expect(page.locator("#lesson-hear-chord")).toBeEnabled();
  await expect(page.locator("#lesson-hear-bar")).toBeEnabled();
  await page.locator("#lesson-hear-chord").click();
  await expect(page.locator("#lesson-hear-chord")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#lesson-reference-status")).toContainText("Playing C");
});

test("does not start a blocked lesson reference when selection changes during audio loading", async ({ page }) => {
  let releaseAudio: () => void = () => {};
  const audioGate = new Promise<void>((resolve) => { releaseAudio = resolve; });
  await page.route("**/audio/**", async (route) => {
    await audioGate;
    await route.continue();
  });
  await openSongs(page);
  await page.locator('.song-result[data-song-id="yellow"]').click();
  await page.locator("#lesson-hear-chord").click();
  await expect(page.locator("#lesson-reference-status")).toContainText("Loading the sampled ukulele");

  await page.locator('.song-result[data-song-id="khaab"]').click();
  releaseAudio();
  await expect(page.locator("body")).toHaveAttribute("data-audio-ready", "true", { timeout: 15_000 });
  await page.waitForTimeout(50);
  expect(await page.locator("#lesson-hear-chord").getAttribute("aria-pressed")).toBe("false");
});

test("keeps Source and Material selects native when sound is enabled", async ({ page }, testInfo) => {
  await openSongs(page);
  await enableAudio(page);
  await page.evaluate(() => {
    const keyEvents: Array<{ id: string; key: string; defaultPrevented: boolean }> = [];
    Object.assign(window, { selectKeyEvents: keyEvents });
    document.addEventListener("keydown", (event) => {
      if (event.target instanceof HTMLSelectElement) {
        keyEvents.push({ id: event.target.id, key: event.key, defaultPrevented: event.defaultPrevented });
      }
    });
  });
  const noteBefore = await page.locator("#last-note").textContent();

  const source = page.locator("#lesson-status-filter");
  await source.focus();
  await source.press("Digit1");
  await expect(page.locator("#last-note")).toHaveText(noteBefore ?? "");
  await source.press("ArrowDown");
  await expect(source).toBeFocused();

  const material = page.locator("#lesson-type-filter");
  await material.focus();
  await material.press("Digit2");
  await expect(page.locator("#last-note")).toHaveText(noteBefore ?? "");
  await material.press("ArrowDown");
  await expect(material).toBeFocused();
  expect(await page.evaluate(() => (window as typeof window & { selectKeyEvents: unknown }).selectKeyEvents)).toEqual([
    { id: "lesson-status-filter", key: "1", defaultPrevented: false },
    { id: "lesson-status-filter", key: "ArrowDown", defaultPrevented: false },
    { id: "lesson-type-filter", key: "2", defaultPrevented: false },
    { id: "lesson-type-filter", key: "ArrowDown", defaultPrevented: false },
  ]);
  await page.locator(".lesson-library-tools").screenshot({ path: testInfo.outputPath("lesson-library-selects.png") });
});
