import { expect, test, type Page } from '@playwright/test';

async function openToolsIfCompact(page: Page): Promise<void> {
  const tools = page.locator('#nav-tools');
  if (await tools.isVisible() && await tools.getAttribute('aria-expanded') === 'false') await tools.click();
}

async function openChordCheck(page: Page): Promise<void> {
  await openToolsIfCompact(page);
  await page.getByRole('button', { name: 'Check my chord' }).click();
}

test('Check my chord is beside Tempo and exposes a local, confidence-aware flow', async ({ page }) => {
  await page.goto('/');
  await openToolsIfCompact(page);
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('button', { name: 'Check my chord' })).toBeVisible();
  const labels = await nav.getByRole('button').allTextContents();
  expect(labels.findIndex((label) => label.includes('Check chord'))).toBe(labels.findIndex((label) => label.includes('Tempo')) + 1);
  await nav.getByRole('button', { name: 'Check my chord' }).click();
  await expect(page.locator('#chord-check-workbench')).toBeVisible();
  await expect(page.getByRole('button', { name: 'C major' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A minor' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'F major' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'G major' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Listen to my chord' })).toBeVisible();
});

test('a captured C strum reaches the on-device result, then releases the microphone on navigation', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const realStart = MediaRecorder.prototype.start;
    MediaRecorder.prototype.start = function (...args) {
      realStart.apply(this, args);
      (window as Window & { playFixtureChord?: () => void }).playFixtureChord?.();
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        const context = new AudioContext();
        const destination = context.createMediaStreamDestination();
        const examples: Array<[string, number]> = [['G4', 1], ['C4', 1], ['E4', 1], ['Cs5', 2 ** (-1 / 12)]];
        const buffers = await Promise.all(examples.map(async ([name]) => context.decodeAudioData(await (await fetch(`/audio/${name}.flac`)).arrayBuffer())));
        (window as Window & { playFixtureChord?: () => void }).playFixtureChord = () => {
          buffers.forEach((buffer, index) => {
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = examples[index][1];
            const gain = context.createGain();
            gain.gain.value = .25;
            source.connect(gain).connect(destination);
            source.start(context.currentTime + .15 + index * .035);
          });
        };
        await context.resume();
        return destination.stream;
      },
    });
  });
  await page.goto('/');
  await openChordCheck(page);
  await page.getByRole('button', { name: 'Listen to my chord' }).click();
  await expect(page.locator('#chord-check-status')).toContainText('Checking notes', { timeout: 20_000 });
  await expect(page.locator('#chord-check-result-title')).toContainText('C major sounds likely', { timeout: 40_000 });
  await openToolsIfCompact(page);
  await page.getByRole('button', { name: 'Tempo', exact: true }).click();
  await expect(page.locator('#chord-check-workbench')).toBeHidden();
});

test('phone layout keeps every top-level destination and the chord controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await openToolsIfCompact(page);
  const chordNav = page.getByRole('button', { name: 'Check my chord' });
  const box = await chordNav.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await chordNav.click();
  await expect(page.locator('#chord-check-workbench')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Listen to my chord' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('uncertain chord can be checked string by string without a recording codec', async ({ page }) => {
  test.setTimeout(30_000);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: undefined });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        const context = new AudioContext();
        const destination = context.createMediaStreamDestination();
        [67, 60, 64, 72].forEach((midi, index) => {
          const oscillator = context.createOscillator();
          oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
          const gain = context.createGain();
          gain.gain.value = .12;
          oscillator.connect(gain).connect(destination);
          oscillator.start(context.currentTime + .25 + index * .9);
          oscillator.stop(context.currentTime + .7 + index * .9);
        });
        await context.resume();
        return destination.stream;
      },
    });
  });
  await page.goto('/');
  await openChordCheck(page);
  await page.getByRole('button', { name: 'Listen to my chord' }).click();
  await page.getByRole('button', { name: 'Check strings one by one' }).click();
  await expect(page.locator('#chord-check-result-title')).toHaveText('Each string sounded right ✓', { timeout: 10_000 });
});

test('count-in can be cancelled and releases its microphone track', async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { chordMicStopped?: boolean }).chordMicStopped = false;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        const destination = new AudioContext().createMediaStreamDestination();
        for (const track of destination.stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => {
            (window as Window & { chordMicStopped?: boolean }).chordMicStopped = true;
            stop();
          };
        }
        return destination.stream;
      },
    });
  });
  await page.goto('/');
  await openChordCheck(page);
  await page.getByRole('button', { name: 'Listen to my chord' }).click();
  await expect(page.locator('#chord-check-countdown')).toHaveText('3');
  await page.getByRole('button', { name: 'Cancel chord check' }).click();
  await expect(page.locator('#chord-check-countdown')).toBeEmpty();
  await expect.poll(() => page.evaluate(() => (window as Window & { chordMicStopped?: boolean }).chordMicStopped)).toBe(true);
});
