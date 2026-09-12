import { expect, test, type Page } from '@playwright/test';
import { installTeachingFixture, completeCalibration, captureStrums } from './helpers/ai-fixture';

async function selectMistake(page:Page) {
  await page.locator('#ai-start').click(); await completeCalibration(page);
  await expect(page.locator('body')).toHaveAttribute('data-audio-ready','true');
  await page.clock.runFor(8650); await captureStrums(page,4,700); await page.clock.runFor(4400);
  await expect(page.locator('#ai-coach-workbench')).toHaveAttribute('data-phase','retry-count-in');
  await page.locator('#ai-explain-focus').press('Enter');
  await expect(page.locator('#ai-mistake-panel')).toBeVisible();
}

test('explains a measured hit and plays its exact slower passage without recording', async({page})=>{
  await installTeachingFixture(page);
  await page.route('**/api/mistake-explanation', async route=>{
    const request=route.request().postDataJSON();
    await route.fulfill({json:{explanation:{eventIndex:request.selectedEventIndex,recipe:'steady-spacing',explanation:'Leave the same space between these strokes.',bpm:50}}});
  });
  await page.locator('#ai-start').click(); await completeCalibration(page);
  await expect(page.locator('body')).toHaveAttribute('data-audio-ready','true');
  await page.clock.runFor(8650);
  await captureStrums(page,4,700); await page.clock.runFor(4400);
  await expect(page.locator('#ai-coach-workbench')).toHaveAttribute('data-phase','retry-count-in');
  await page.locator('#ai-explain-focus').click();
  await expect(page.locator('#ai-mistake-panel')).toBeVisible();
  await expect(page.locator('#ai-mistake-evidence')).toContainText('Loop');
  await page.locator('#ai-mistake-explain').click();
  await expect(page.locator('#ai-mistake-answer')).toContainText('same space');
  await expect(page.locator('#ai-mistake-attribution')).toBeVisible();
  await page.evaluate(()=>{(window as any).teachingFixture.starts=[];});
  await page.locator('#ai-mistake-demo').click();
  await expect(page.locator('#ai-coach-workbench')).toHaveAttribute('data-phase','mistake-demo');
  await expect(page.locator('#ai-tempo')).toHaveText('50');
  await expect(page.locator('#ai-live-signal')).toContainText('Mic off');
  await page.clock.runFor(5000);
  await expect(page.locator('#ai-mistake-status')).toContainText('Playing');
  const starts=await page.evaluate(()=>(window as any).teachingFixture.starts as number[]);
  // First four sources are the count-in; each strum then starts four string voices.
  expect(starts[8]-starts[4]).toBeCloseTo(1.2,3);
  await page.locator('#ai-mistake-stop').click();
  await expect(page.locator('#ai-coach-workbench')).toHaveAttribute('data-phase','correction');
  await page.clock.runFor(10000);
  await expect(page.locator('#ai-mistake-status')).toContainText('Stopped');
  await page.screenshot({path:test.info().outputPath('explanation.png'),fullPage:true});
});

test('retries explanation without losing the take and clears it on navigation',async({page})=>{
  await installTeachingFixture(page); let calls=0;
  await page.route('**/api/mistake-explanation',async route=>{
    calls++;
    if(calls===1) return route.fulfill({status:429,json:{error:'Please retry this explanation.'}});
    return route.fulfill({json:{explanation:{eventIndex:route.request().postDataJSON().selectedEventIndex,recipe:'preserve-rest',explanation:'Keep the quiet space before your next sounded stroke.',bpm:55}}});
  });
  await selectMistake(page);
  await page.locator('#ai-mistake-explain').click();
  await expect(page.locator('#ai-mistake-answer')).toContainText('retry');
  await expect(page.locator('#ai-mistake-replay')).toBeEnabled();
  await page.locator('#ai-mistake-explain').click();
  await expect(page.locator('#ai-mistake-answer')).toContainText('quiet space');
  expect(calls).toBe(2);
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.getByRole('button',{name:'AI Coach',exact:true}).click();
  await expect(page.locator('#ai-mistake-panel')).toBeHidden();
  await expect(page.locator('#ai-coach-workbench')).toHaveAttribute('data-phase','setup');
});

test('ignores a late explanation after reset',async({page})=>{
  await installTeachingFixture(page);
  let release:()=>void=()=>{};
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/mistake-explanation',async route=>{
    await gate;
    await route.fulfill({json:{explanation:{eventIndex:route.request().postDataJSON().selectedEventIndex,recipe:'steady-spacing',explanation:'This stale answer must not replace a new selection.',bpm:50}}}).catch(()=>{});
  });
  await selectMistake(page);
  const pending=page.waitForRequest('**/api/mistake-explanation');
  await page.locator('#ai-mistake-explain').click(); await pending;
  await page.locator('#ai-reset').click(); release();
  await expect(page.locator('#ai-mistake-panel')).toBeHidden();
  await expect(page.locator('#ai-coach-workbench')).toHaveAttribute('data-phase','setup');
  await expect(page.locator('#ai-mistake-answer')).not.toContainText('stale answer');
});

test('trace selection replays only its passage and prevents overlapping whole-take playback',async({page})=>{
  await page.addInitScript(()=>{
    const players:{paused:boolean;currentTime:number;src:string}[]=[];
    Object.assign(window,{testPlayers:players});
    class Replay extends EventTarget {
      paused=true; currentTime=0; duration=10;
      constructor(public src:string){super();players.push(this);}
      async play(){this.paused=false;queueMicrotask(()=>this.dispatchEvent(new Event('loadedmetadata')));}
      pause(){this.paused=true;}
    }
    Object.defineProperty(window,'Audio',{value:Replay,configurable:true});
  });
  await installTeachingFixture(page); await selectMistake(page);
  await page.locator('#ai-retry-now').click();
  await page.clock.runFor(9200); await captureStrums(page,4,1000); await page.clock.runFor(400);
  await expect(page.locator('#ai-coach-workbench')).toHaveAttribute('data-phase','comparison');
  const firstRow=page.locator('.ai-trace-row').nth(1);
  await firstRow.locator('[data-grade="early"], [data-grade="late"], [data-grade="missed"]').first().press('Enter');
  await expect(page.locator('#ai-mistake-panel')).toBeVisible();
  await page.locator('#ai-play-first').click();
  await page.locator('#ai-mistake-replay').click();
  expect(await page.evaluate(()=>(window as any).testPlayers.map((p:any)=>p.paused))).toEqual([true,false]);
  expect(await page.evaluate(()=>(window as any).testPlayers[1].currentTime)).toBeGreaterThan(1);
  await page.clock.runFor(2200);
  expect(await page.evaluate(()=>(window as any).testPlayers[1].paused)).toBe(true);
  await page.locator('#ai-mistake-replay').click();
  await page.locator('#ai-play-new').click();
  expect(await page.evaluate(()=>(window as any).testPlayers.slice(-2).map((p:any)=>p.paused))).toEqual([true,false]);
  await page.locator('#ai-reset').click();
  expect(await page.evaluate(()=>(window as any).testPlayers.every((p:any)=>p.paused))).toBe(true);
});

test('keeps the slower demonstration tempo select native when sound is enabled',async({page},testInfo)=>{
  await installTeachingFixture(page); await selectMistake(page);
  await page.evaluate(()=>{
    const keyEvents:Array<{key:string;defaultPrevented:boolean}>=[];
    Object.assign(window,{mistakeTempoKeyEvents:keyEvents});
    document.addEventListener('keydown',event=>{
      if(event.target instanceof HTMLSelectElement&&event.target.id==='ai-mistake-tempo') keyEvents.push({key:event.key,defaultPrevented:event.defaultPrevented});
    });
  });
  const tempo=page.locator('#ai-mistake-tempo');
  const noteBefore=await page.locator('#last-note').textContent();
  await tempo.focus();
  await tempo.press('Digit1');
  await expect(page.locator('#last-note')).toHaveText(noteBefore??'');
  await tempo.press('ArrowUp');
  await expect(tempo).toBeFocused();
  expect(await page.evaluate(()=>(window as typeof window&{mistakeTempoKeyEvents:unknown}).mistakeTempoKeyEvents)).toEqual([
    {key:'1',defaultPrevented:false},{key:'ArrowUp',defaultPrevented:false},
  ]);
  await page.locator('#ai-mistake-panel').screenshot({path:testInfo.outputPath('explained-mistake-tempo.png')});
});
