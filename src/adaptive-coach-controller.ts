import {
  AdaptiveOnsetDetector,
  RHYTHM_PATTERNS,
  analyzeRhythmAttempt,
  buildExpectedEvents,
  compareAttempts,
  comparisonTakeForFocus,
  rhythmPattern,
  summarizeAttemptForCoach,
  validateCoachingDecision,
  type CoachingDecision,
  type ExpectedRhythmEvent,
  type FocusRegion,
  type ImprovementResult,
  type RhythmAttempt,
  type RhythmPattern,
  type RhythmPatternId,
} from "./adaptive-coach";
import { AttemptRecorder } from "./attempt-recorder";
import { assessCaptureQuality, calibrationResult, CaptureQualityMonitor } from "./capture-quality";
import { loopSlotCount } from "./rhythm-grid";
import { renderTakeTraces } from "./take-traces";
import { MistakePanel } from "./mistake-panel";
import { buildMistakeRequest, mistakeEvidence, mistakePassage, type MistakeRequest } from "./mistake-explanation";
import "./ai-coach-feedback.css";
import type { AudioEngine } from "./audio";
import { chordMidiNotes, type ChordName } from "./lesson";
import { StrummingGuide } from "./strumming-guide";
import { heardMarker, strummingFrame } from "./strumming-motion";
import type { SignalFrame, TunerEngine, TunerStatus } from "./tuner";

type AdaptiveCoachPhase =
  | "calibrating"
  | "quality-check"
  | "setup"
  | "demo"
  | "focused-demo"
  | "mistake-demo"
  | "preparing"
  | "count-in"
  | "recording"
  | "analysing"
  | "correction"
  | "retry-count-in"
  | "comparison"
  | "error";

interface AdaptiveCoachControllerOptions {
  root: HTMLElement;
  audio: AudioEngine;
  tuner: TunerEngine;
  ensureAudio: () => Promise<boolean>;
}

export class AdaptiveCoachController {
  private readonly root: HTMLElement;
  private readonly audio: AudioEngine;
  private readonly tuner: TunerEngine;
  private readonly ensureAudio: () => Promise<boolean>;
  private readonly recorder = new AttemptRecorder();
  private readonly onsetDetector = new AdaptiveOnsetDetector();
  private readonly captureMonitor = new CaptureQualityMonitor();
  private calibrated = false;
  private noiseFloor = .002;
  private quietSamples: number[] = [];
  private calibrationStep: "quiet" | "pluck" | "ready" | "failed" = "quiet";
  private calibrationPeak = 0;
  private calibrationClip = 0;
  private phase: AdaptiveCoachPhase = "setup";
  private selectedPatternId: RhythmPatternId = "steady-downs";
  private apiConfigured = false;
  private apiChecked = false;
  private expectedEvents: ExpectedRhythmEvent[] = [];
  private detectedAtMs: number[] = [];
  private attemptStartedAt = 0;
  private attemptDurationMs = 0;
  private attemptKind: RhythmAttempt["kind"] = "baseline";
  private attemptBpm = 70;
  private attemptRepetitions = 2;
  private attemptFocus: FocusRegion | null = null;
  private baselineAttempt: RhythmAttempt | null = null;
  private comparisonBase: RhythmAttempt | null = null;
  private latestAttempt: RhythmAttempt | null = null;
  private decision: CoachingDecision | null = null;
  private comparison: ImprovementResult | null = null;
  private retryCount = 0;
  private runToken = 0;
  private timers: number[] = [];
  private animationFrame = 0;
  private recordingUrls: string[] = [];
  private replayAudio: HTMLAudioElement | null = null;
  private requestController: AbortController | null = null;
  private errorMessage = "";
  private countdownValue = 3;
  private activeSlot = -1;
  private activeCycle = 0;
  private skipPreparation = false;
  private readonly guide: StrummingGuide;
  private readonly mistakePanel: MistakePanel;
  private mistakeDemo: { request: MistakeRequest; bpm: number; counting: boolean } | null = null;
  private mistakeReturnPhase: AdaptiveCoachPhase = "correction";
  private readonly heardLane: HTMLElement;
  private readonly watchFocus: HTMLButtonElement;
  private waiters: Array<() => void> = [];

  private readonly connection: HTMLElement;
  private readonly stageLabel: HTMLElement;
  private readonly stageTitle: HTMLElement;
  private readonly stageCopy: HTMLElement;
  private readonly tempo: HTMLElement;
  private readonly timingString: HTMLElement;
  private readonly slots: HTMLElement;
  private readonly playhead: HTMLElement;
  private readonly liveSignal: HTMLElement;
  private readonly liveStatus: HTMLElement;
  private readonly hitCount: HTMLElement;
  private readonly demoButton: HTMLButtonElement;
  private readonly startButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly hearBeat: HTMLInputElement;
  private readonly coachNote: HTMLElement;
  private readonly readyNote: HTMLElement;
  private readonly thinking: HTMLElement;
  private readonly correctionPanel: HTMLElement;
  private readonly correctionText: HTMLElement;
  private readonly evidence: HTMLElement;
  private readonly retryTempo: HTMLElement;
  private readonly retryLoop: HTMLElement;
  private readonly retryRepetitions: HTMLElement;
  private readonly countdown: HTMLElement;
  private readonly countdownText: HTMLElement;
  private readonly retryNow: HTMLButtonElement;
  private readonly comparisonPanel: HTMLElement;
  private readonly comparisonTitle: HTMLElement;
  private readonly comparisonCopy: HTMLElement;
  private readonly beforeError: HTMLElement;
  private readonly afterError: HTMLElement;
  private readonly beforeBar: HTMLElement;
  private readonly afterBar: HTMLElement;
  private readonly onTimeChange: HTMLElement;
  private readonly missedCount: HTMLElement;
  private readonly extraCount: HTMLElement;
  private readonly playFirst: HTMLButtonElement;
  private readonly playNew: HTMLButtonElement;
  private readonly continueButton: HTMLButtonElement;
  private readonly errorNote: HTMLElement;
  private readonly errorText: HTMLElement;
  private readonly retryAnalysis: HTMLButtonElement;

  constructor(options: AdaptiveCoachControllerOptions) {
    this.root = options.root;
    this.audio = options.audio;
    this.tuner = options.tuner;
    this.ensureAudio = options.ensureAudio;
    this.guide = new StrummingGuide(this.element("#ai-strumming-guide"));
    this.heardLane = this.element("#ai-heard-lane");
    this.watchFocus = this.element("#ai-watch-focus");
    this.connection = this.element("#ai-connection");
    this.stageLabel = this.element("#ai-stage-label");
    this.stageTitle = this.element("#ai-stage-title");
    this.stageCopy = this.element("#ai-stage-copy");
    this.tempo = this.element("#ai-tempo");
    this.timingString = this.element("#ai-timing-string");
    this.slots = this.element("#ai-slots");
    this.playhead = this.element("#ai-playhead");
    this.liveSignal = this.element("#ai-live-signal");
    this.liveStatus = this.element("#ai-live-status");
    this.hitCount = this.element("#ai-hit-count");
    this.demoButton = this.element("#ai-demo");
    this.startButton = this.element("#ai-start");
    this.cancelButton = this.element("#ai-cancel");
    this.resetButton = this.element("#ai-reset");
    this.hearBeat = this.element("#ai-hear-beat");
    this.coachNote = this.element("#ai-coach-note");
    this.readyNote = this.element("#ai-ready-note");
    this.thinking = this.element("#ai-thinking");
    this.correctionPanel = this.element("#ai-correction-panel");
    this.correctionText = this.element("#ai-correction");
    this.evidence = this.element("#ai-evidence");
    this.retryTempo = this.element("#ai-retry-tempo");
    this.retryLoop = this.element("#ai-retry-loop");
    this.retryRepetitions = this.element("#ai-retry-repetitions");
    this.countdown = this.element("#ai-countdown");
    this.countdownText = this.element("#ai-countdown-value");
    this.retryNow = this.element("#ai-retry-now");
    this.comparisonPanel = this.element("#ai-comparison");
    this.comparisonTitle = this.element("#ai-comparison-title");
    this.comparisonCopy = this.element("#ai-comparison-copy");
    this.beforeError = this.element("#ai-before-error");
    this.afterError = this.element("#ai-after-error");
    this.beforeBar = this.element("#ai-before-bar");
    this.afterBar = this.element("#ai-after-bar");
    this.onTimeChange = this.element("#ai-on-time-change");
    this.missedCount = this.element("#ai-missed-count");
    this.extraCount = this.element("#ai-extra-count");
    this.playFirst = this.element("#ai-play-first");
    this.playNew = this.element("#ai-play-new");
    this.continueButton = this.element("#ai-continue");
    this.errorNote = this.element("#ai-error-note");
    this.errorText = this.element("#ai-error-message");
    this.retryAnalysis = this.element("#ai-retry-analysis");
    this.mistakePanel = new MistakePanel(this.element("#ai-mistake-panel"), {
      play: (request, bpm) => this.playMistakeDemo(request, bpm),
      stop: () => this.stopMistakeDemo(),
    });
    this.bind();
    this.render();
  }

  enter(): void {
    this.render();
    void this.checkApiStatus();
  }

  leave(): void {
    this.resetSession();
  }

  dispose(): void {
    this.resetSession();
  }

  private bind(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-ai-pattern]").forEach((button) => {
      button.addEventListener("click", () => {
        if (this.isBusy()) return;
        this.resetSession(false);
        this.selectedPatternId = button.dataset.aiPattern as RhythmPatternId;
        this.render();
      });
    });
    this.demoButton.addEventListener("click", () => {
      if (this.phase === "demo") this.cancelFlow("Example stopped. Start your take when your hand feels ready.");
      else void this.playDemo();
    });
    this.startButton.addEventListener("click", () => void this.startBaseline());
    this.element("#ai-calibration-continue").addEventListener("click", () => {
      if (this.phase !== "calibrating" || this.calibrationStep !== "ready") return;
      this.calibrated = true;
      this.tuner.stop();
      void this.prepareAttempt(this.attemptKind, this.attemptBpm, this.attemptRepetitions, this.attemptFocus);
    });
    for (const id of ["#ai-calibration-retry", "#ai-quality-recheck"]) this.element(id).addEventListener("click", () => void this.calibrateMicrophone());
    this.element("#ai-quality-retry").addEventListener("click", () => void this.prepareAttempt(this.attemptKind, this.attemptBpm, this.attemptRepetitions, this.attemptFocus));
    this.element("#ai-quality-replay").addEventListener("click", () => this.playRecording(this.latestAttempt?.recordingUrl ?? null));
    this.element<HTMLInputElement>("#ai-chord-changes").addEventListener("change", () => {
      this.resetSession();
      this.guide.setChord("C", this.chordChanges ? "F" : null);
    });
    this.element("#ai-skip-wait").addEventListener("click", () => {
      if (this.phase === "retry-count-in") void this.playDemo(true, true);
      if (this.phase === "preparing") {
        this.skipPreparation = true;
        this.cancelFlowTimers();
      }
    });
    this.cancelButton.addEventListener("click", () => {
      if (this.phase === "mistake-demo") { this.mistakePanel.stop(); return; }
      if (this.phase === "retry-count-in" || this.phase === "focused-demo" || (this.phase === "preparing" && this.attemptKind === "retry")) {
        this.cancelScheduledWork();
        this.tuner.stop();
        this.phase = "correction";
        this.countdownValue = 0;
        this.liveStatus.textContent = "Automatic retry paused. Start it when your hand is ready.";
        this.render();
      } else {
        this.cancelFlow("Attempt cancelled. Nothing was sent to Astra.");
      }
    });
    this.resetButton.addEventListener("click", () => this.resetSession());
    this.retryNow.addEventListener("click", () => void this.startFocusedRetry());
    this.watchFocus.addEventListener("click", () => void this.playDemo(true, false));
    this.element("#ai-explain-focus").addEventListener("click", () => {
      const selection = this.focusMistake();
      if (selection) this.selectMistake(selection.attempt, selection.eventIndex);
    });
    this.retryAnalysis.addEventListener("click", () => {
      if (this.latestAttempt) void this.requestDecision(this.latestAttempt);
    });
    this.continueButton.addEventListener("click", () => void this.continueAfterComparison());
    this.playFirst.addEventListener("click", () => this.playRecording(this.comparisonBase?.recordingUrl ?? this.baselineAttempt?.recordingUrl ?? null));
    this.playNew.addEventListener("click", () => this.playRecording(this.latestAttempt?.recordingUrl ?? null));
  }

  private async checkApiStatus(): Promise<void> {
    this.connection.dataset.state = "checking";
    this.connection.querySelector("span")!.textContent = "Checking Astra…";
    try {
      const response = await fetch("/api/adaptive-coach/status", { headers: { Accept: "application/json" } });
      const payload = await response.json() as { configured?: boolean };
      this.apiConfigured = response.ok && payload.configured === true;
      this.apiChecked = true;
    } catch {
      this.apiConfigured = false;
      this.apiChecked = true;
    }
    this.render();
  }

  private async playDemo(focused = false, thenRetry = false): Promise<void> {
    if (focused && !this.decision) return;
    this.mistakePanel.reset();
    this.cancelScheduledWork();
    this.tuner.stop();
    this.replayAudio?.pause();
    const token = ++this.runToken;
    const pattern = this.pattern;
    const bpm = focused ? this.decision!.retryBpm : pattern.bpm;
    const repetitions = focused ? this.decision!.repetitions : 2;
    const focus = focused ? { startSlot: this.decision!.focusStartSlot, endSlot: this.decision!.focusEndSlot } : null;
    const events = buildExpectedEvents(pattern, bpm, repetitions, focus);
    const duration = loopSlotCount(focus) * repetitions * 30_000 / bpm;
    this.phase = focused ? "focused-demo" : "demo";
    this.attemptBpm = bpm;
    this.activeSlot = -1;
    this.activeCycle = 0;
    this.liveStatus.textContent = focused
      ? thenRetry ? "Watch the slower correction first. Four clicks will cue your turn next." : "Watch only. No recording starts until you choose Start focused retry."
      : "Watch the fingertip cross GCEA down and AECG up. Hollow arrows are silent swings.";
    this.render();
    const ready = await this.ensureAudio();
    if (token !== this.runToken) return;
    if (!ready) {
      this.phase = focused ? "correction" : "setup";
      this.liveStatus.textContent = "Sound could not start. Enable sound and try again.";
      this.render();
      return;
    }
    this.revealGuide();
    const startAt = this.audio.currentTime + 0.12;
    events.forEach((event) => {
      const midis = chordMidiNotes(this.chordAt(event.slot, event.cycle));
      this.audio.scheduleStrum(midis, event.direction, 0.52, startAt + event.atMs / 1000);
    });
    this.animateGuide(() => (this.audio.presentationTime - startAt) * 1000, duration, bpm, repetitions, focus, token, true, () => {
      if (token !== this.runToken) return;
      this.phase = focused ? "correction" : "setup";
      this.activeSlot = -1;
      this.liveStatus.textContent = focused ? "That is the slower section. Your turn when you are ready." : "Example complete. Start your first take when the rhythm feels familiar.";
      this.render();
      if (thenRetry) void this.startFocusedRetry();
    });
  }

  private focusMistake(): { attempt: RhythmAttempt; eventIndex: number } | null {
    const attempt = this.latestAttempt;
    if (!attempt || !this.decision) return null;
    const hits = attempt.metrics.alignedHits.filter(hit => hit.slot >= this.decision!.focusStartSlot && hit.slot <= this.decision!.focusEndSlot);
    const hit = hits.find(hit => buildMistakeRequest(attempt, hit.eventIndex));
    return hit ? { attempt, eventIndex: hit.eventIndex } : null;
  }

  private selectMistake(attempt: RhythmAttempt, eventIndex: number): void {
    if (!["correction", "retry-count-in", "comparison"].includes(this.phase) || !buildMistakeRequest(attempt, eventIndex)) return;
    this.cancelScheduledWork();
    this.tuner.stop();
    this.replayAudio?.pause();
    this.phase = this.phase === "comparison" ? "comparison" : "correction";
    this.mistakePanel.select(attempt, eventIndex);
    this.render();
  }

  private async playMistakeDemo(request: MistakeRequest, bpm: number): Promise<void> {
    const passage = mistakePassage(request, bpm);
    const sourceCycle = mistakeEvidence(request).hit.cycle;
    this.mistakeReturnPhase = this.phase === "comparison" ? "comparison" : "correction";
    this.cancelScheduledWork();
    this.tuner.stop();
    this.replayAudio?.pause();
    const token = ++this.runToken;
    this.mistakeDemo = { request, bpm, counting: true };
    this.phase = "mistake-demo";
    this.countdownValue = 4;
    this.render();
    const ready = await this.ensureAudio();
    if (token !== this.runToken) return;
    if (!ready) { this.stopMistakeDemo(); throw new Error("Sound unavailable"); }
    this.revealGuide();
    for (let count = 4; count > 0; count--) {
      this.countdownValue = count;
      this.render();
      this.audio.playMetronomeClick(count === 4);
      await this.wait(60000 / bpm);
      if (token !== this.runToken) return;
    }
    this.mistakeDemo.counting = false;
    this.render();
    this.mistakePanel.setPlaybackStatus(`Playing the exact passage at ${bpm} BPM · two repetitions.`);
    const startAt = this.audio.currentTime + .12;
    for (const event of passage.events) {
      this.audio.scheduleStrum(chordMidiNotes(this.chordAt(event.slot, sourceCycle)), event.direction, .52, startAt + event.atMs / 1000);
    }
    this.animateGuide(() => (this.audio.presentationTime - startAt) * 1000, passage.durationMs, bpm, 2, passage.focus, token, true, undefined, sourceCycle);
    await this.wait(passage.durationMs + 150);
    if (token !== this.runToken) return;
    this.stopMistakeDemo();
  }

  private stopMistakeDemo(): void {
    this.replayAudio?.pause();
    if (this.phase !== "mistake-demo") return;
    this.cancelScheduledWork();
    this.mistakeDemo = null;
    this.phase = this.mistakeReturnPhase;
    this.activeSlot = -1;
    this.render();
  }

  private async startBaseline(): Promise<void> {
    if (!this.apiConfigured || this.isBusy()) return;
    this.mistakePanel.reset();
    this.baselineAttempt = null;
    this.comparisonBase = null;
    this.latestAttempt = null;
    this.decision = null;
    this.comparison = null;
    this.retryCount = 0;
    this.revokeRecordings();
    await this.prepareAttempt("baseline", this.pattern.bpm, 2, null);
  }

  private async calibrateMicrophone(): Promise<void> {
    this.cancelScheduledWork();
    this.tuner.stop();
    this.replayAudio?.pause();
    const token = ++this.runToken;
    this.calibrated = false;
    this.quietSamples = [];
    this.calibrationPeak = 0;
    this.calibrationClip = 0;
    this.calibrationStep = "quiet";
    this.phase = "calibrating";
    this.element("#ai-calibration-copy").textContent = "Keep quiet for 1.5 seconds while we check the room. No clicks will play.";
    this.element<HTMLButtonElement>("#ai-calibration-continue").disabled = true;
    this.render();
    await this.tuner.start((_reading, signal) => this.handleSignal(signal), (status, message) => this.handleMicStatus(status, message));
    if (token !== this.runToken || !this.tuner.isListening) return;
    this.element("#ai-calibration").scrollIntoView({ block: "center", behavior: "auto" });
    await this.wait(1500);
    if (token !== this.runToken || this.phase !== "calibrating") return;
    if (this.quietSamples.length < 12) { this.failCalibration("No reliable microphone frames yet. Recheck microphone access."); return; }
    const sorted = [...this.quietSamples].sort((a, b) => a - b);
    this.noiseFloor = sorted[Math.floor(sorted.length * .9)];
    this.quietSamples = [];
    if (this.noiseFloor > .035) { this.failCalibration("The room is too loud for a reliable check. Quiet the background and recheck."); return; }
    this.calibrationStep = "pluck";
    this.element("#ai-calibration-copy").textContent = "Now pluck one string clearly and let it ring. This test pluck is not scored.";
    this.schedule(() => {
      if (token === this.runToken && this.calibrationStep === "pluck") this.failCalibration("We could not hear a clear test pluck. Move closer, check your input and try again.");
    }, 8000);
  }

  private failCalibration(message: string): void {
    this.calibrationStep = "failed";
    this.calibrated = false;
    this.tuner.stop();
    this.element("#ai-calibration-copy").textContent = message;
    this.element<HTMLButtonElement>("#ai-calibration-continue").disabled = true;
  }

  private async prepareAttempt(
    kind: RhythmAttempt["kind"],
    bpm: number,
    repetitions: number,
    focus: FocusRegion | null,
  ): Promise<void> {
    this.mistakePanel.reset();
    this.comparison = null;
    this.cancelScheduledWork();
    this.replayAudio?.pause();
    this.onsetDetector.reset();
    this.attemptKind = kind;
    this.attemptBpm = bpm;
    this.attemptRepetitions = repetitions;
    this.attemptFocus = focus;
    if (!this.calibrated) { await this.calibrateMicrophone(); return; }
    this.onsetDetector.addCalibrationSample(this.noiseFloor);
    const token = ++this.runToken;
    this.phase = "preparing";
    this.skipPreparation = false;
    this.countdownValue = 5;
    this.activeSlot = -1;
    this.liveStatus.textContent = "Get comfortable. Five seconds to prepare, then four clicks cue your turn.";
    this.render();

    const ready = await this.ensureAudio();
    if (token !== this.runToken) return;
    if (!ready) {
      this.phase = kind === "retry" ? "correction" : "setup";
      this.render();
      return;
    }

    this.element("#ai-start-cue").scrollIntoView({ block: "center", behavior: "auto" });
    for (let remaining = 5; remaining > 0 && !this.skipPreparation; remaining--) {
      if (token !== this.runToken) return;
      this.countdownValue = remaining;
      this.render();
      await this.wait(1000);
    }
    if (token !== this.runToken) return;
    this.phase = "count-in";
    this.countdownValue = 4;
    if (!this.tuner.isListening) {
      await this.tuner.start(
        (_reading, signal) => this.handleSignal(signal),
        (status, message) => this.handleMicStatus(status, message),
      );
    }
    if (token !== this.runToken) return;
    if (!this.tuner.isListening) {
      this.phase = "error";
      this.errorMessage = "The microphone could not start. Allow access, then try again.";
      this.render();
      return;
    }

    const beatMs = 60_000 / bpm;
    for (let beat = 0; beat < 4; beat += 1) {
      if (token !== this.runToken) return;
      this.countdownValue = 4 - beat;
      this.audio.playMetronomeClick(beat === 0);
      this.liveStatus.textContent = `Count-in · ${4 - beat}`;
      this.render();
      await this.wait(beatMs);
    }
    if (token !== this.runToken) return;
    this.beginRecording(token);
  }

  private beginRecording(token: number): void {
    this.onsetDetector.finishCalibration();
    this.expectedEvents = buildExpectedEvents(
      this.pattern,
      this.attemptBpm,
      this.attemptRepetitions,
      this.attemptFocus,
    );
    this.detectedAtMs = [];
    const slotMs = 30_000 / this.attemptBpm;
    const loopSlots = loopSlotCount(this.attemptFocus);
    this.attemptDurationMs = loopSlots * slotMs * this.attemptRepetitions;
    this.attemptStartedAt = performance.now();
    this.captureMonitor.start(this.noiseFloor, this.attemptStartedAt);
    const stream = this.tuner.mediaStream;
    if (stream) this.recorder.start(stream);
    this.phase = "recording";
    this.liveStatus.textContent = this.attemptKind === "baseline"
      ? "Your turn · play two bars with the moving pulse."
      : "Focused retry · repeat only the highlighted section.";
    this.render();
    this.revealGuide();
    this.schedule(() => { if (token === this.runToken) this.render(); }, 700);
    this.animateGuide(() => performance.now() - this.attemptStartedAt, this.attemptDurationMs,
      this.attemptBpm, this.attemptRepetitions, this.attemptFocus, token, false);
    if (this.hearBeat.checked) {
      const beatMs = 60_000 / this.attemptBpm;
      for (let at = 0; at < this.attemptDurationMs; at += beatMs) {
        const accent = at === 0;
        this.schedule(() => this.audio.playMetronomeClick(accent), at);
      }
    }
    this.schedule(() => void this.finishAttempt(token), this.attemptDurationMs + 220);
  }

  private handleSignal(signal: SignalFrame): void {
    if (this.phase === "calibrating") {
      this.element<HTMLMeterElement>("#ai-input-level").value = signal.rms;
      if (this.calibrationStep === "quiet") this.quietSamples.push(signal.rms);
      if (this.calibrationStep === "pluck" || this.calibrationStep === "ready") {
        this.calibrationPeak = Math.max(this.calibrationPeak, signal.rms);
        this.calibrationClip = Math.max(this.calibrationClip, signal.clippedFraction ?? 0);
        const quality = calibrationResult(this.noiseFloor, this.calibrationPeak, this.calibrationClip);
        if (quality.status === "usable") {
          this.calibrationStep = "ready";
          this.element("#ai-calibration-copy").textContent = "Test pluck heard clearly. Let it fade, then start when you’re ready.";
          this.element<HTMLButtonElement>("#ai-calibration-continue").disabled = false;
        } else if (quality.status === "clipped") this.failCalibration(quality.message);
      }
      return;
    }
    if (this.phase !== "recording" || signal.at < this.attemptStartedAt - 30) return;
    this.captureMonitor.push(signal);
    if (!this.onsetDetector.push(signal.rms, signal.at)) return;
    const relativeTime = signal.at - this.attemptStartedAt;
    if (relativeTime > this.attemptDurationMs + 160) return;
    this.detectedAtMs.push(relativeTime);
    this.hitCount.textContent = `${this.detectedAtMs.length} heard`;
    this.liveSignal.dataset.state = "heard";
    window.setTimeout(() => {
      if (this.phase === "recording") this.liveSignal.dataset.state = "listening";
    }, 160);
    this.renderHeardMarkers();
  }

  private handleMicStatus(status: TunerStatus, message: string): void {
    this.liveSignal.dataset.state = status === "listening" ? "listening" : status;
    this.liveSignal.lastChild!.textContent = status === "listening" ? "Listening" : status === "requesting" ? "Mic request" : "Mic off";
    if (status === "error") {
      this.errorMessage = message;
      this.phase = "error";
      this.render();
    }
  }

  private async finishAttempt(token: number): Promise<void> {
    if (token !== this.runToken || this.phase !== "recording") return;
    this.cancelAnimation();
    const captureEndedAt = performance.now();
    this.phase = "analysing";
    this.activeSlot = -1;
    this.render();
    const blob = await this.recorder.stop();
    if (token !== this.runToken) return;
    const recordingUrl = blob ? URL.createObjectURL(blob) : null;
    if (recordingUrl) this.recordingUrls.push(recordingUrl);
    const metrics = analyzeRhythmAttempt(this.expectedEvents, this.detectedAtMs, this.attemptBpm);
    const captureQuality = this.captureMonitor.evidence(this.detectedAtMs.length, this.expectedEvents.length, this.calibrated, captureEndedAt);
    this.tuner.stop();
    const attempt: RhythmAttempt = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      patternId: this.pattern.id,
      kind: this.attemptKind,
      bpm: this.attemptBpm,
      repetitions: this.attemptRepetitions,
      focus: this.attemptFocus,
      metrics,
      recordingUrl,
      detectedAtMs: [...this.detectedAtMs],
      captureQuality,
    };
    this.latestAttempt = attempt;
    const quality = assessCaptureQuality(captureQuality);
    this.element("#ai-quality-status").textContent = quality.message;
    if (quality.status !== "usable") {
      this.phase = "quality-check";
      this.element("#ai-quality-message").textContent = quality.message;
      this.render();
      return;
    }
    if (attempt.kind === "retry") this.retryCount++;
    if (attempt.kind === "baseline") {
      this.baselineAttempt = attempt;
      await this.requestDecision(attempt);
      return;
    }
    if (!this.comparisonBase || !this.decision) return;
    this.comparison = compareAttempts(this.comparisonBase, attempt, {
      startSlot: this.decision.focusStartSlot,
      endSlot: this.decision.focusEndSlot,
    });
    this.phase = "comparison";
    this.tuner.stop();
    this.render();
  }

  private async requestDecision(attempt: RhythmAttempt): Promise<void> {
    this.mistakePanel.reset();
    if (assessCaptureQuality(attempt.captureQuality).status !== "usable") {
      this.phase = "quality-check";
      this.element("#ai-quality-message").textContent = assessCaptureQuality(attempt.captureQuality).message;
      this.render();
      return;
    }
    this.cancelScheduledWork(false);
    this.requestController?.abort();
    const requestController = new AbortController();
    this.requestController = requestController;
    this.phase = "analysing";
    this.errorMessage = "";
    this.comparison = null;
    this.comparisonBase = attempt;
    this.render();
    try {
      const response = await fetch("/api/adaptive-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        signal: requestController.signal,
        body: JSON.stringify(summarizeAttemptForCoach(
          this.pattern,
          attempt,
          this.retryCount,
          attempt === this.baselineAttempt ? null : this.baselineAttempt,
        )),
      });
      if (requestController.signal.aborted || this.requestController !== requestController) return;
      const payload = await response.json() as { decision?: unknown; error?: string };
      if (requestController.signal.aborted || this.requestController !== requestController) return;
      if (!response.ok) throw new Error(payload.error ?? "Astra could not analyse this take.");
      const decision = validateCoachingDecision(payload.decision, this.pattern);
      if (!decision || decision.retryBpm > attempt.bpm) {
        throw new Error("Astra returned an unusable coaching plan. Retry analysis.");
      }
      this.decision = decision;
      this.comparisonBase = comparisonTakeForFocus(attempt, this.baselineAttempt ?? attempt, {
        startSlot: decision.focusStartSlot, endSlot: decision.focusEndSlot,
      });
      this.phase = "correction";
      this.render();
      this.startAutomaticRetryCountdown();
    } catch (error) {
      if (requestController.signal.aborted) return;
      this.errorMessage = error instanceof Error ? error.message : "Astra could not analyse this take.";
      this.phase = "error";
      this.tuner.stop();
      this.render();
    } finally {
      if (this.requestController === requestController) this.requestController = null;
    }
  }

  private startAutomaticRetryCountdown(): void {
    this.cancelScheduledWork(false);
    const token = ++this.runToken;
    this.phase = "retry-count-in";
    this.countdownValue = 10;
    this.render();
    const tick = () => {
      if (token !== this.runToken || this.phase !== "retry-count-in") return;
      if (this.countdownValue <= 0) {
        void this.playDemo(true, true);
        return;
      }
      this.render();
      this.countdownValue -= 1;
      this.schedule(tick, 1000);
    };
    tick();
  }

  private async startFocusedRetry(): Promise<void> {
    if (!this.decision || this.retryCount >= 3) return;
    await this.prepareAttempt(
      "retry",
      this.decision.retryBpm,
      this.decision.repetitions,
      { startSlot: this.decision.focusStartSlot, endSlot: this.decision.focusEndSlot },
    );
  }

  private async continueAfterComparison(): Promise<void> {
    if (!this.latestAttempt || !this.comparison) return;
    if (this.comparison.status !== "improved" && this.retryCount < 3) {
      await this.requestDecision(this.latestAttempt);
      return;
    }
    const patternId = this.selectedPatternId;
    this.resetSession(false);
    this.selectedPatternId = patternId;
    this.liveStatus.textContent = "Pattern complete. Hear it again or begin a fresh take.";
    this.render();
  }

  private cancelFlow(message: string): void {
    this.mistakePanel.reset();
    this.cancelScheduledWork();
    this.recorder.discard();
    this.tuner.stop();
    this.phase = "setup";
    this.activeSlot = -1;
    this.activeCycle = 0;
    this.heardLane.replaceChildren();
    this.guide.setCue("even-swing");
    this.liveStatus.textContent = message;
    this.render();
  }

  private resetSession(render = true): void {
    this.mistakePanel.reset();
    this.calibrated = false;
    this.cancelScheduledWork();
    this.recorder.discard();
    this.tuner.stop();
    this.replayAudio?.pause();
    this.replayAudio = null;
    this.revokeRecordings();
    this.phase = "setup";
    this.expectedEvents = [];
    this.detectedAtMs = [];
    this.baselineAttempt = null;
    this.comparisonBase = null;
    this.latestAttempt = null;
    this.decision = null;
    this.comparison = null;
    this.retryCount = 0;
    this.errorMessage = "";
    this.countdownValue = 3;
    this.activeSlot = -1;
    this.activeCycle = 0;
    this.heardLane.replaceChildren();
    this.guide.setCue("even-swing");
    this.liveStatus.textContent = "Choose a pattern, then watch and hear the example.";
    this.guide.setChord("C", this.element<HTMLInputElement>("#ai-chord-changes").checked ? "F" : null);
    if (render) this.render();
  }

  private playRecording(url: string | null): void {
    if (!url) return;
    this.mistakePanel.stop();
    this.replayAudio?.pause();
    this.replayAudio = new Audio(url);
    void this.replayAudio.play().catch(() => {
      this.liveStatus.textContent = "The recording could not play on this browser.";
    });
  }

  private render(): void {
    const pattern = this.pattern;
    const busy = this.isBusy();
    this.root.dataset.phase = this.phase;
    this.element("#ai-calibration").hidden = this.phase !== "calibrating";
    this.element("#ai-quality-problem").hidden = this.phase !== "quality-check";
    this.element<HTMLButtonElement>("#ai-quality-replay").disabled = !this.latestAttempt?.recordingUrl;
    this.root.querySelectorAll<HTMLButtonElement>("[data-ai-pattern]").forEach((button) => {
      const selected = button.dataset.aiPattern === pattern.id;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = busy;
    });
    this.connection.dataset.state = !this.apiChecked ? "checking" : this.apiConfigured ? "ready" : "error";
    this.connection.querySelector("span")!.textContent = !this.apiChecked
      ? "Checking Astra…"
      : this.apiConfigured ? "API key configured" : "API key needed";
    const retryContext = !!this.decision && !["setup", "demo"].includes(this.phase);
    const displayedBpm = this.mistakeDemo?.bpm ?? (retryContext ? this.decision!.retryBpm : pattern.bpm);
    this.tempo.textContent = String(displayedBpm);
    this.element("#ai-tempo-context").textContent = this.mistakeDemo ? `Selected passage · ${displayedBpm} BPM · watch only` : retryContext
      ? `Your retry · ${displayedBpm} BPM · original example ${pattern.bpm} BPM`
      : `Original example · ${pattern.bpm} BPM`;
    this.demoButton.title = `Replay original example at ${pattern.bpm} BPM`;
    this.element<HTMLInputElement>("#ai-chord-changes").disabled = busy;
    this.guide.setDownOnly(pattern.id === "steady-downs");
    const showPlay = this.phase === "recording" && performance.now() < this.attemptStartedAt + 700;
    this.element("#ai-start-cue").hidden = !["preparing", "count-in", "retry-count-in"].includes(this.phase) && !showPlay && !this.mistakeDemo?.counting;
    this.element("#ai-start-count").textContent = showPlay ? "PLAY" : String(Math.max(1, this.countdownValue));
    this.element("#ai-start-label").textContent = showPlay ? "Your turn" : this.phase === "retry-count-in" ? "Read your correction · demonstration in" : this.phase === "preparing" ? "Get ready · count-in starts in" : "With the clicks · start after 1";
    this.element("#ai-skip-wait").hidden = this.phase !== "preparing" && this.phase !== "retry-count-in";
    this.stageTitle.textContent = pattern.title;
    this.stageCopy.textContent = !this.apiConfigured && this.apiChecked
      ? "Add OPENAI_API_KEY to .env.local and restart Vite to unlock adaptive coaching."
      : this.stageDescription();
    this.stageLabel.textContent = this.stageLabelText();
    this.demoButton.disabled = busy && this.phase !== "demo";
    this.demoButton.querySelector("span")!.textContent = this.phase === "demo" ? "Stop example" : "Watch & hear";
    this.startButton.disabled = !this.apiConfigured || busy;
    this.startButton.querySelector("span")!.textContent = this.phase === "analysing" ? "Analysing…" : "Start first take";
    this.cancelButton.hidden = !["calibrating", "preparing", "count-in", "recording", "retry-count-in", "focused-demo", "mistake-demo"].includes(this.phase);
    this.cancelButton.textContent = ["preparing", "retry-count-in"].includes(this.phase) ? "Pause" : "Cancel";
    this.resetButton.disabled = false;
    this.hearBeat.disabled = busy;
    this.readyNote.hidden = this.phase === "analysing" || this.phase === "correction" || this.phase === "retry-count-in" || this.phase === "focused-demo" || this.phase === "comparison" || this.phase === "error";
    this.thinking.hidden = this.phase !== "analysing";
    this.correctionPanel.hidden = this.phase !== "correction" && this.phase !== "retry-count-in" && this.phase !== "focused-demo";
    this.comparisonPanel.hidden = this.phase !== "comparison";
    this.errorNote.hidden = this.phase !== "error";
    this.coachNote.dataset.state = this.phase;
    this.liveSignal.dataset.state = this.phase === "recording" ? "listening" : this.tuner.isListening ? "ready" : "idle";
    this.liveSignal.lastChild!.textContent = this.phase === "recording" ? "Listening" : this.tuner.isListening ? "Mic ready" : "Mic off";
    this.hitCount.textContent = `${this.detectedAtMs.length} heard`;

    if (this.decision) {
      this.guide.setCue(this.decision.visualCue);
      this.correctionText.textContent = this.decision.correction;
      this.evidence.textContent = this.decision.evidence;
      this.retryTempo.textContent = `${this.decision.retryBpm} BPM`;
      this.retryLoop.textContent = slotRangeLabel(this.decision.focusStartSlot, this.decision.focusEndSlot);
      this.retryRepetitions.textContent = `${this.decision.repetitions}×`;
    }
    this.countdown.hidden = this.phase !== "retry-count-in";
    this.countdownText.textContent = String(Math.max(1, this.countdownValue));
    this.guide.setCorrection(this.decision && ["correction", "retry-count-in", "focused-demo"].includes(this.phase)
      ? this.decision.correction : null,
    this.phase === "retry-count-in" ? `Astra · slow demonstration in ${Math.max(1, this.countdownValue)}` : "Astra’s one correction");
    this.retryNow.hidden = this.phase !== "correction";
    this.watchFocus.hidden = this.phase !== "correction";
    this.element<HTMLButtonElement>("#ai-explain-focus").disabled = !this.focusMistake();
    if (this.comparison && this.latestAttempt) this.renderComparison();
    if (this.phase === "error") this.errorText.textContent = this.errorMessage;
    this.retryAnalysis.disabled = !this.latestAttempt;
    this.renderTimeline();
  }

  private renderTimeline(): void {
    const pattern = this.pattern;
    const latestMetrics = ["comparison", "error", "correction", "retry-count-in"].includes(this.phase) ? this.latestAttempt?.metrics : null;
    const focus = this.mistakeDemo ? mistakeEvidence(this.mistakeDemo.request).focus : this.decision && this.phase !== "demo"
      ? { startSlot: this.decision.focusStartSlot, endSlot: this.decision.focusEndSlot }
      : null;
    this.slots.replaceChildren();
    for (let slot = 0; slot < 8; slot += 1) {
      const stroke = pattern.strokes.find((candidate) => candidate.slot === slot);
      const cell = document.createElement("span");
      cell.className = "ai-slot";
      cell.dataset.slot = String(slot);
      if (!stroke) cell.classList.add("is-rest");
      if (slot === this.activeSlot) cell.classList.add("is-current");
      if (focus && slot >= focus.startSlot && slot <= focus.endSlot) cell.classList.add("is-focus");
      const timing = latestMetrics?.slotTiming[slot];
      if (timing?.missed) cell.classList.add("is-missed");
      else if (timing?.deltaMs !== null && timing?.deltaMs !== undefined) {
        cell.classList.add(Math.abs(timing.deltaMs) <= latestMetrics!.toleranceMs ? "is-on-time" : timing.deltaMs < 0 ? "is-early" : "is-late");
      }
      const mark = document.createElement("strong");
      mark.textContent = pattern.id === "steady-downs" && !stroke ? "·" : slot % 2 === 0 ? "↓" : "↑";
      const detail = document.createElement("small");
      detail.textContent = timing?.missed
        ? "missed"
        : timing?.deltaMs !== null && timing?.deltaMs !== undefined
          ? timing.deltaMs === 0 ? "on beat" : `${timing.deltaMs > 0 ? "+" : ""}${timing.deltaMs}ms`
          : stroke ? stroke.direction === "down" ? "down" : "up" : pattern.id === "steady-downs" ? "rest" : "air";
      cell.append(mark, detail);
      this.slots.append(cell);
    }
    this.timingString.classList.toggle("is-running", this.phase === "demo" || this.phase === "focused-demo" || this.phase === "recording");
  }

  private renderComparison(): void {
    const comparison = this.comparison!;
    const latest = this.latestAttempt!;
    if (this.comparisonBase && this.decision) {
      renderTakeTraces(this.element("#ai-comparison-traces"), this.comparisonBase, latest, {
        startSlot: this.decision.focusStartSlot, endSlot: this.decision.focusEndSlot,
      }, (attempt, eventIndex) => this.selectMistake(attempt, eventIndex));
      const label = this.comparisonBase.kind === "baseline" ? "First take" : "Previous take";
      this.beforeError.previousElementSibling!.textContent = label;
      this.playFirst.textContent = `Hear ${label.toLowerCase()}`;
    }
    const statusCopy = comparison.status === "improved"
      ? ["That section settled.", `Timing error improved by ${Math.max(0, comparison.improvementPercent)}%. Take a moment to hear the difference.`]
      : comparison.status === "nearly"
        ? ["The pulse is getting closer.", "You moved in the right direction. One more focused pass should make it feel natural."]
        : ["Keep the loop small.", "The section needs another pass. Astra can make the next correction even more specific."];
    this.comparisonTitle.textContent = statusCopy[0];
    this.comparisonCopy.textContent = statusCopy[1];
    this.beforeError.textContent = `${comparison.beforeErrorMs} ms`;
    this.afterError.textContent = `${comparison.afterErrorMs} ms`;
    const maximum = Math.max(comparison.beforeErrorMs, comparison.afterErrorMs, 1);
    this.beforeBar.style.width = `${Math.max(8, (comparison.beforeErrorMs / maximum) * 100)}%`;
    this.afterBar.style.width = `${Math.max(8, (comparison.afterErrorMs / maximum) * 100)}%`;
    this.afterBar.style.backgroundColor = comparison.status === "improved" ? "var(--success)" : "var(--plucked-coral)";
    this.onTimeChange.textContent = `${comparison.beforeOnTimePercent}% → ${comparison.afterOnTimePercent}%`;
    this.missedCount.textContent = String(latest.metrics.missed);
    this.extraCount.textContent = String(latest.metrics.extra);
    this.playFirst.disabled = !(this.baselineAttempt?.recordingUrl ?? this.comparisonBase?.recordingUrl);
    this.playNew.disabled = !latest.recordingUrl;
    this.continueButton.textContent = comparison.status !== "improved" && this.retryCount < 3
      ? "Ask Astra for the next step"
      : this.retryCount >= 3 ? "Finish pattern" : "Practise full pattern";
  }

  private stageDescription(): string {
    if (this.phase === "mistake-demo") return "The selected passage repeats twice at the displayed tempo. Watch and listen; your microphone stays off.";
    if (this.phase === "calibrating") return "A quiet-room check and one test pluck help separate recording problems from timing problems.";
    if (this.phase === "quality-check") return "This recording is kept for replay, but is not reliable enough for timing feedback.";
    if (this.phase === "preparing") return "Five seconds to settle your hands. Then follow the four-count and start on PLAY.";
    if (this.phase === "focused-demo") return "Astra’s focus, tempo and teaching cue drive this example. Watch first; the four-count comes next.";
    if (this.phase === "count-in") return "Listen to four clear clicks. Your take begins after the final count.";
    if (this.phase === "recording") return this.attemptKind === "baseline"
      ? "Play the pattern twice. The moving rail is silent so it cannot trigger your microphone."
      : "Repeat only the coral section and keep the space between strokes even.";
    if (this.phase === "analysing") return "Your audio stays here while timing measurements travel to Astra.";
    if (this.phase === "comparison") return "Hear both takes and compare the same small section.";
    return "Watch two bars at 70 BPM. Before your first take, check the quiet room and play one test pluck. Recording starts after the count-in.";
  }

  private stageLabelText(): string {
    if (this.phase === "mistake-demo") return "Selected passage · watch only";
    if (this.phase === "demo") return "Listen · two bars";
    if (this.phase === "focused-demo") return "Watch · Astra’s slower correction";
    if (this.phase === "count-in") return `Count-in · ${this.countdownValue}`;
    if (this.phase === "recording") return this.attemptKind === "baseline" ? "Play · first take" : `Play · focused retry ${this.retryCount} of 3`;
    if (this.phase === "analysing") return "Measure · ask Astra";
    if (this.phase === "correction" || this.phase === "retry-count-in") return "Correction · one thing only";
    if (this.phase === "comparison") return "Compare · before and after";
    if (this.phase === "error") return "Take kept · analysis paused";
    return "Ready when you are";
  }

  private animateGuide(elapsed: () => number, durationMs: number, bpm: number, repetitions: number,
    focus: FocusRegion | null, token: number, demonstration: boolean, complete?: () => void, sourceCycle?: number): void {
    this.cancelAnimation();
    const draw = () => {
      if (token !== this.runToken || !["demo", "focused-demo", "mistake-demo", "recording"].includes(this.phase)) return;
      const at = elapsed();
      if (at >= durationMs) {
        this.cancelAnimation();
        complete?.();
        return;
      }
      if (at >= 0) {
        const frame = strummingFrame(this.pattern, bpm, at, focus);
        const chord = this.chordAt(frame.slot, sourceCycle ?? frame.cycle);
        this.guide.setChord(chord, sourceCycle === undefined ? this.nextChord(frame.slot, frame.cycle, focus) : null);
        this.guide.draw(frame, repetitions, demonstration);
        this.playhead.style.setProperty("--ai-play-progress", `${frame.progress * 100}%`);
        if (this.activeSlot !== frame.slot || this.activeCycle !== frame.cycle) {
          this.activeSlot = frame.slot;
          this.activeCycle = frame.cycle;
          this.renderTimeline();
          this.renderHeardMarkers();
        }
      }
      this.animationFrame = requestAnimationFrame(draw);
    };
    draw();
  }

  private renderHeardMarkers(): void {
    this.heardLane.replaceChildren();
    if (this.phase !== "recording") return;
    for (const at of this.detectedAtMs) {
      const marker = heardMarker(at, this.attemptBpm, this.attemptFocus);
      if (marker.cycle !== this.activeCycle) continue;
      const dot = document.createElement("i");
      dot.className = "ai-heard-marker";
      dot.style.left = `${marker.progress * 100}%`;
      dot.setAttribute("aria-label", `Strum heard ${Math.round(at)} milliseconds into take`);
      this.heardLane.append(dot);
    }
  }

  private revealGuide(): void {
    const guide = this.element("#ai-strumming-guide");
    const bounds = guide.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight - 80) {
      guide.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }

  private cancelFlowTimers(): void {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers = [];
    this.waiters.splice(0).forEach((resolve) => resolve());
  }

  private cancelScheduledWork(incrementToken = true): void {
    if (incrementToken) {
      this.runToken += 1;
      this.requestController?.abort();
      this.requestController = null;
    }
    this.cancelFlowTimers();
    this.cancelAnimation();
    this.audio.stopAllVoices();
  }

  private cancelAnimation(): void {
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.playhead.style.setProperty("--ai-play-progress", "0%");
    this.guide.idle();
  }

  private schedule(callback: () => void, delayMs: number): void {
    this.timers.push(window.setTimeout(callback, Math.max(0, delayMs)));
  }

  private wait(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.waiters.push(resolve);
      this.schedule(() => {
        this.waiters = this.waiters.filter((waiting) => waiting !== resolve);
        resolve();
      }, delayMs);
    });
  }

  private revokeRecordings(): void {
    this.recordingUrls.forEach((url) => URL.revokeObjectURL(url));
    this.recordingUrls = [];
  }

  private get pattern(): RhythmPattern {
    return rhythmPattern(this.selectedPatternId);
  }

  private isBusy(): boolean {
    return this.phase === "mistake-demo" || this.phase === "calibrating" || this.phase === "preparing" || this.phase === "demo" || this.phase === "focused-demo" || this.phase === "count-in" || this.phase === "recording" || this.phase === "analysing" || this.phase === "retry-count-in";
  }

  private get chordChanges(): boolean { return this.element<HTMLInputElement>("#ai-chord-changes").checked; }

  private chordAt(slot: number, cycle: number): ChordName {
    return this.chordChanges ? (["C", "F", "G", "C"] as const)[(cycle * 2 + Math.floor(slot / 4)) % 4] : "C";
  }

  private nextChord(slot: number, cycle: number, focus: FocusRegion | null): ChordName | null {
    if (!this.chordChanges) return null;
    const current = this.chordAt(slot, cycle);
    const strokes = this.pattern.strokes.filter(s => s.slot >= (focus?.startSlot ?? 0) && s.slot <= (focus?.endSlot ?? 7));
    for (let nextCycle = cycle; nextCycle <= cycle + 2; nextCycle++) {
      for (const stroke of strokes) {
        if (nextCycle === cycle && stroke.slot <= slot) continue;
        const next = this.chordAt(stroke.slot, nextCycle);
        if (next !== current) return next;
      }
    }
    return null;
  }

  private element<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing adaptive coach element ${selector}`);
    return element;
  }
}

function slotRangeLabel(startSlot: number, endSlot: number): string {
  const labels = ["1", "1 &", "2", "2 &", "3", "3 &", "4", "4 &"];
  return `${labels[startSlot]}–${labels[endSlot]}`;
}

export const ADAPTIVE_COACH_PATTERN_COUNT = RHYTHM_PATTERNS.length;
