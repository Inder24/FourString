import { expect, test } from '@playwright/test';
import { installTeachingFixture, completeCalibration, captureStrums } from './helpers/ai-fixture';

test('calibrates silently, then rejects a silent take without calling Astra', async ({ page }) => {
  await installTeachingFixture(page);
  let requests = 0;
  await page.route('**/api/adaptive-coach', route => { requests++; return route.fulfill({ json: {} }); });
  await page.locator('#ai-start').click();
  await expect(page.locator('#ai-calibration')).toBeVisible();
  await expect(page.locator('#ai-calibration-copy')).toContainText('quiet');
  await page.clock.runFor(1500);
  await expect(page.locator('#ai-calibration-copy')).toContainText('pluck');
  await page.evaluate(() => { (window as any).teachingFixture.rms = .09; });
  await page.clock.runFor(80);
  await expect(page.locator('#ai-calibration-continue')).toBeEnabled();
  await page.evaluate(() => { (window as any).teachingFixture.rms = .001; });
  await page.locator('#ai-calibration-continue').click();
  await expect(page.locator('body')).toHaveAttribute('data-audio-ready', 'true');
  await page.clock.runFor(16000);
  await expect(page.locator('#ai-quality-problem')).toBeVisible();
  await expect(page.locator('#ai-quality-message')).toContainText('Not enough');
  expect(requests).toBe(0);
  await expect(page.locator('#ai-quality-replay')).toBeEnabled();
});

test('can cancel calibration without starting a recording', async ({ page }) => {
  await installTeachingFixture(page);
  await page.locator('#ai-start').click();
  await expect(page.locator('#ai-calibration')).toBeVisible();
  await page.locator('#ai-cancel').click();
  await page.clock.runFor(16000);
  await expect(page.locator('#ai-coach-workbench')).toHaveAttribute('data-phase', 'setup');
  expect(await page.evaluate(() => (window as any).teachingFixture.stoppedTracks)).toBeGreaterThan(0);
});

test('blocks noisy calibration, then supports a quiet recheck', async ({page})=>{
  await installTeachingFixture(page);
  await page.evaluate(()=>{(window as any).teachingFixture.rms=.06;});
  await page.locator('#ai-start').click(); await page.clock.runFor(1500);
  await expect(page.locator('#ai-calibration-copy')).toContainText('too loud');
  await expect(page.locator('#ai-calibration-continue')).toBeDisabled();
  await page.evaluate(()=>{(window as any).teachingFixture.rms=.001;});
  await page.locator('#ai-calibration-retry').click();
  await completeCalibration(page);
  await expect(page.locator('#ai-coach-workbench')).toHaveAttribute('data-phase','preparing');
});

test('keeps a clipped take unscored and can record a clear replacement', async({page})=>{
  await installTeachingFixture(page);
  await page.locator('#ai-start').click(); await completeCalibration(page);
  await expect(page.locator('body')).toHaveAttribute('data-audio-ready','true');
  await page.clock.runFor(8650);
  await page.evaluate(()=>{(window as any).teachingFixture.rms=1;});
  await page.clock.runFor(7200);
  await expect(page.locator('#ai-quality-message')).toContainText('overloading');
  await page.evaluate(()=>{(window as any).teachingFixture.rms=.001;});
  await page.locator('#ai-quality-recheck').click(); await completeCalibration(page);
  await page.clock.runFor(8650); await captureStrums(page,4,700); await page.clock.runFor(4400);
  await expect(page.locator('#ai-coach-workbench')).toHaveAttribute('data-phase','retry-count-in');
});
test('does not turn a sampling stall into player timing feedback',async({page})=>{
  await installTeachingFixture(page); let calls=0;
  await page.route('**/api/adaptive-coach',route=>{calls++;return route.fulfill({json:{}});});
  await page.locator('#ai-start').click(); await completeCalibration(page);
  await expect(page.locator('body')).toHaveAttribute('data-audio-ready','true');
  await page.clock.runFor(8650); await captureStrums(page,4,650);
  await page.clock.fastForward(2000); await page.clock.runFor(2800);
  await expect(page.locator('#ai-quality-message')).toContainText('analysis paused');
  expect(calls).toBe(0);
});
