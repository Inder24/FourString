import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4174/';
const version = process.argv[3] ?? 'v0';
if (!/^v\d+$/.test(version)) throw new Error('Screenshot version must look like v0 or v1');
const output = new URL(`../ui/${version}/`, import.meta.url).pathname;
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function captureSet(context, suffix, extraPracticeViews) {
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.evaluate(() => document.fonts.ready);

  async function shot(name) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(output, `${name}-${suffix}.png`), fullPage: true, animations: 'disabled' });
  }

  async function tool(id) {
    if (await page.locator('#nav-tools').isVisible()) await page.locator('#nav-tools').click();
    await page.locator(id).click();
  }

  await shot('play');
  await page.locator('#enable-button').click();
  await page.locator('#instrument-frame[data-audio-ready="true"]').waitFor();
  await shot('play-ready');
  await page.locator('#nav-practice').click();
  await shot('practice-session');
  if (extraPracticeViews) {
    await page.locator('#nav-songs').click();
    await shot('practice-songs');
    await page.locator('#song-search').fill('harry potter');
    await page.locator('.song-result[data-song-id="hedwigs-theme"]').click();
    await shot('hedwig-overview');
    await page.locator('#nav-practice').click();
    await page.locator('#mode-coach').click();
    await shot('practice-quick-drills');
  }
  await page.locator('#mode-ai-coach').click();
  await shot('ai-coach');
  await tool('#mode-tuner');
  await shot('tune');
  await tool('#mode-tempo');
  await page.locator('#tempo-variation').check();
  await page.locator('#tempo-variation-cycle').selectOption('8');
  await shot('tempo');
  await tool('#mode-chord-check');
  await shot('check-chord');
  await page.close();
}

try {
  await captureSet(await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }), 'desktop', true);
  await captureSet(await browser.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1 }), 'mobile', true);
  if (version !== 'v0') {
    const comparison = await browser.newContext({ viewport: { width: 1586, height: 992 }, deviceScaleFactor: 1 });
    const page = await comparison.newPage();
    await page.goto(baseUrl);
    await page.locator('#enable-button').click();
    await page.locator('#instrument-frame[data-audio-ready="true"]').waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(output, 'play-ready-reference-viewport.png'), animations: 'disabled' });
    await comparison.close();
  }
} finally {
  await browser.close();
}
