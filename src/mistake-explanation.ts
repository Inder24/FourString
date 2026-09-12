import { analyzeRhythmAttempt, buildExpectedEvents, rhythmPattern, type FocusRegion, type RhythmAttempt, type RhythmPatternId } from './adaptive-coach';
import { assessCaptureQuality, sanitizeCaptureEvidence, type CaptureEvidence } from './capture-quality';
import { loopSlotCount } from './rhythm-grid';

export interface MistakeRequest {
  patternId: RhythmPatternId;
  bpm: number;
  repetitions: number;
  focus: FocusRegion | null;
  detectedAtMs: number[];
  selectedEventIndex: number;
  captureQuality: CaptureEvidence;
}
export const DEMO_RECIPES = {
  'steady-spacing': 'Give each sounded stroke the same amount of space.',
  'unhurried-return': 'Return gently, then let the next stroke meet its cue.',
  'preserve-rest': 'Keep the silent space open before the next sounded stroke.',
} as const;
export interface MistakeExplanation { eventIndex: number; recipe: keyof typeof DEMO_RECIPES; explanation: string; bpm: number; }

export function buildMistakeRequest(attempt: RhythmAttempt, selectedEventIndex: number): MistakeRequest | null {
  return sanitizeMistakeRequest({ patternId: attempt.patternId, bpm: attempt.bpm, repetitions: attempt.repetitions, focus: attempt.focus, detectedAtMs: attempt.detectedAtMs, selectedEventIndex, captureQuality: attempt.captureQuality });
}

export function sanitizeMistakeRequest(value: unknown): MistakeRequest | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!['steady-downs','alternating-pulse','island-rhythm'].includes(String(v.patternId))) return null;
  if (typeof v.bpm !== 'number' || ![50,55,60,65,70].includes(v.bpm) || typeof v.repetitions !== 'number' || ![2,3].includes(v.repetitions)) return null;
  let focus: FocusRegion | null = null;
  if (v.focus !== null) {
    if (!v.focus || typeof v.focus !== 'object') return null;
    const f = v.focus as FocusRegion;
    if (!Number.isInteger(f.startSlot) || !Number.isInteger(f.endSlot) || f.startSlot < 0 || f.endSlot > 7 || f.endSlot-f.startSlot < 1 || f.endSlot-f.startSlot > 3) return null;
    focus = { startSlot:f.startSlot, endSlot:f.endSlot };
  }
  if (!Array.isArray(v.detectedAtMs) || v.detectedAtMs.length > 100 || !v.detectedAtMs.every(at=>typeof at==='number'&&Number.isFinite(at)&&at>=-250&&at<=16000)) return null;
  if (!Number.isInteger(v.selectedEventIndex)) return null;
  const captureQuality = sanitizeCaptureEvidence(v.captureQuality);
  if (!captureQuality || assessCaptureQuality(captureQuality).status !== 'usable') return null;
  const request: MistakeRequest = { patternId:v.patternId as RhythmPatternId, bpm:v.bpm, repetitions:Number(v.repetitions), focus, detectedAtMs:[...v.detectedAtMs], selectedEventIndex:Number(v.selectedEventIndex), captureQuality };
  const events = buildExpectedEvents(rhythmPattern(request.patternId),request.bpm,request.repetitions,focus);
  if (events.length / request.repetitions < 2) return null;
  if (captureQuality.detectedCount !== request.detectedAtMs.length || captureQuality.expectedCount !== events.length) return null;
  const hit = analyzeRhythmAttempt(events, request.detectedAtMs, request.bpm).alignedHits[request.selectedEventIndex];
  if (!hit || hit.grade === 'on-time') return null;
  return request;
}

export function mistakeEvidence(request: MistakeRequest) {
  const pattern = rhythmPattern(request.patternId);
  const events = buildExpectedEvents(pattern,request.bpm,request.repetitions,request.focus);
  const metrics = analyzeRhythmAttempt(events,request.detectedAtMs,request.bpm);
  const hit = metrics.alignedHits[request.selectedEventIndex];
  const first = request.focus?.startSlot ?? 0;
  const last = request.focus?.endSlot ?? 7;
  for (let width = 2; width <= 4; width++) {
    for (let start = Math.max(first,hit.slot-width+1); start <= hit.slot && start+width-1<=last; start++) {
      const focus = { startSlot:start, endSlot:start+width-1 };
      // Whole-beat looping may add one slot. Never silence a source stroke there.
      const paddedSlot = start + width;
      if (width % 2 && paddedSlot <= last && pattern.strokes.some(s=>s.slot===paddedSlot)) continue;
      if (pattern.strokes.filter(s=>s.slot>=start&&s.slot<=focus.endSlot).length >= 2) return { hit, focus, metrics };
    }
  }
  throw new Error('Selected passage needs two sounded strokes.');
}

export function validateMistakeExplanation(value: unknown, request: MistakeRequest): MistakeExplanation | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.eventIndex !== request.selectedEventIndex || typeof v.recipe !== 'string' || !Object.hasOwn(DEMO_RECIPES,v.recipe)) return null;
  if (typeof v.explanation !== 'string' || v.explanation.trim().length<8 || v.explanation.length>220) return null;
  if (typeof v.bpm !== 'number' || ![40,45,50,55,60,65].includes(v.bpm) || v.bpm>=request.bpm) return null;
  return { eventIndex:request.selectedEventIndex,recipe:v.recipe as keyof typeof DEMO_RECIPES,explanation:v.explanation.trim(),bpm:v.bpm };
}

export function mistakePassage(request: MistakeRequest, bpm: number) {
  if (![40,45,50,55,60,65].includes(bpm) || bpm>=request.bpm) throw new Error('Choose a slower supported tempo.');
  const { focus } = mistakeEvidence(request);
  return { focus, events:buildExpectedEvents(rhythmPattern(request.patternId),bpm,2,focus), durationMs:loopSlotCount(focus)*2*30000/bpm };
}

export function recordingPassage(request: MistakeRequest): { startSeconds: number; endSeconds: number } {
  const { hit, focus, metrics } = mistakeEvidence(request);
  const slotMs = 30000/request.bpm;
  const start = (hit.cycle*loopSlotCount(request.focus) + focus.startSlot-(request.focus?.startSlot??0))*slotMs+metrics.globalOffsetMs;
  const duration = loopSlotCount(request.focus)*request.repetitions*slotMs;
  return { startSeconds:Math.max(0,start-120)/1000, endSeconds:Math.min(duration+220,start+loopSlotCount(focus)*slotMs+180)/1000 };
}
