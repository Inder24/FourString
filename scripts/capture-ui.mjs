import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4174/';
const output = new URL('../ui/v0/', import.meta.url).pathname;
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

  await shot('play');
  await page.locator('#nav-practice').click();
  await shot('practice-session');
  if (extraPracticeViews) {
    await page.locator('#mode-chapters').click();
    await shot('practice-songs');
    await page.locator('#song-search').fill('harry potter');
    await page.locator('.song-result[data-song-id="hedwigs-theme"]').click();
    await shot('hedwig-overview');
    await page.locator('#mode-coach').click();
    await shot('practice-quick-drills');
  }
  await page.locator('#mode-ai-coach').click();
  await shot('ai-coach');
  await page.locator('#mode-tuner').click();
  await shot('tune');
  await page.locator('#mode-tempo').click();
  await page.locator('#tempo-variation').check();
  await page.locator('#tempo-variation-cycle').selectOption('8');
  await shot('tempo');
  await page.locator('#mode-chord-check').click();
  await shot('check-chord');
  await page.close();
}

try {
  await captureSet(await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }), 'desktop', true);
  await captureSet(await browser.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1 }), 'mobile', true);
} finally {
  await browser.close();
}
