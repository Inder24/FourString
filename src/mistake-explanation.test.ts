import { expect, it } from 'vitest';
import { buildMistakeRequest, sanitizeMistakeRequest, mistakeEvidence, validateMistakeExplanation, mistakePassage, recordingPassage } from './mistake-explanation';
import { analyzeRhythmAttempt, buildExpectedEvents, rhythmPattern, type RhythmAttempt } from './adaptive-coach';
const pattern = rhythmPattern('steady-downs');
const expected = buildExpectedEvents(pattern, 70);
const detected = [0, 850, 1710, 2820, 3430, 4280, 5140, 6000];
const attempt: RhythmAttempt = { id:'private-id', patternId:pattern.id, kind:'baseline', bpm:70, repetitions:2, focus:null, detectedAtMs:detected, metrics:analyzeRhythmAttempt(expected, detected,70), recordingUrl:'blob:private', captureQuality:{calibrated:true,noiseFloorRms:.002,peakRms:.12,clippedFraction:0,frameCount:240,activeFrameFraction:.3,detectedCount:8,expectedCount:8, maxFrameGapMs: 0} };
it('binds explanation to the selected measured event, excluding recordings and unrelated state', () => {
  const request = buildMistakeRequest(attempt, 3)!;
  expect(request).not.toBeNull();
  expect(JSON.stringify(request)).not.toContain('private');
  expect(mistakeEvidence(request).hit.slot).toBe(6);
  expect(mistakeEvidence(request).hit.deltaMs).toBeGreaterThan(200);
  expect(buildMistakeRequest(attempt,99)).toBeNull();
});
it('rejects invented event references and a faster demonstration', () => {
  const request = buildMistakeRequest(attempt,3)!;
  const answer = { eventIndex:3, recipe:'steady-spacing', explanation:'Give this stroke its full beat before it lands.', bpm:55 };
  expect(validateMistakeExplanation(answer,request)).toEqual(answer);
  expect(validateMistakeExplanation({...answer,eventIndex:0},request)).toBeNull();
  expect(validateMistakeExplanation({...answer,bpm:70},request)).toBeNull();
  expect(validateMistakeExplanation({...answer,recipe:'run-script'},request)).toBeNull();
});
it('rejects coerced counts and a focus without enough musical context', () => {
  const request = buildMistakeRequest(attempt,3)!;
  expect(sanitizeMistakeRequest({...request,repetitions:'2'})).toBeNull();
  expect(sanitizeMistakeRequest({...request,focus:{startSlot:6,endSlot:7},selectedEventIndex:0,detectedAtMs:[350,1500],captureQuality:{...request.captureQuality,detectedCount:2,expectedCount:2}})).toBeNull();
});
it('keeps the exact local pattern and silent return at the slower tempo', () => {
  const passage = mistakePassage(buildMistakeRequest(attempt,3)!,50);
  expect(passage.events.map(e=>e.atMs)).toEqual([0,1200,2400,3600]);
  expect(passage.events.every(e=>e.direction==='down')).toBe(true);
  expect(passage.durationMs).toBe(4800);
});
it('does not replace the island upstroke at a padded passage boundary with silence',()=>{
  const p=rhythmPattern('island-rhythm');
  const events=buildExpectedEvents(p,70);
  const detectedAtMs=events.map((e,i)=>e.atMs+(i===0?250:0));
  const source={...attempt,patternId:p.id,detectedAtMs,metrics:analyzeRhythmAttempt(events,detectedAtMs,70),captureQuality:{...attempt.captureQuality!,detectedCount:events.length,expectedCount:events.length}};
  const request=buildMistakeRequest(source,0)!;
  const passage=mistakePassage(request,50);
  expect(passage.focus).toEqual({startSlot:0,endSlot:3});
  expect(passage.events.slice(0,3).map(e=>[e.slot,e.direction,e.atMs])).toEqual([[0,'down',0],[2,'down',1200],[3,'up',1800]]);
});
it('seeks the selected cycle of the raw recording with device offset and bounds', () => {
  const request = buildMistakeRequest(attempt,3)!;
  const slice = recordingPassage(request);
  expect(slice.startSeconds).toBeGreaterThanOrEqual(0);
  expect(slice.endSeconds).toBeLessThanOrEqual(7.2);
  expect(slice.endSeconds).toBeGreaterThan(2.8);
});
