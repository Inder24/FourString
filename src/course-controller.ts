import type { AudioEngine } from "./audio";
import {
  COURSE_LESSONS,
  COURSE_STAGES,
  COURSE_UNITS,
  courseLesson,
  type CourseActivity,
  type CourseInput,
  type CourseLesson,
  type PerformanceActivity,
  type RhythmActivity,
} from "./course";
import {
  evaluateCourseChordSequence,
  evaluateCourseComposite,
  evaluateCourseEarChoice,
  evaluateCourseNoteSequence,
  evaluateCourseRhythm,
} from "./course-evaluation";
import {
  loadCourseProgress,
  nextRecommendedLessonId,
  recordLessonAttempt,
  resetCourseProgress,
  saveCourseProgress,
  type CourseProgressV1,
  type LessonEvaluation,
} from "./course-progress";
import { chordMidiNotes, LESSON_CHORDS } from "./lesson";
import type { TunerEngine, TunerStatus } from "./tuner";

interface CourseControllerOptions {
  root: HTMLElement;
  audio: AudioEngine;
  tuner: TunerEngine;
  ensureAudio: () => Promise<boolean>;
  instrumentExpanded: () => boolean;
  toggleInstrument: () => void;
}

interface InstrumentNoteDetail {
  midi: number;
  stringIndex: number;
  fret: number;
}

interface InstrumentStrumDetail {
  direction: "down" | "up";
  frets: number[];
  midis: number[];
  at: number;
}

const INPUT_KEY = "four-strings-course-input";

export class CourseController {
  private active = false;
  private lessonId: string | null = null;
  private stageIndex = 0;
  private input: CourseInput = localStorage.getItem(INPUT_KEY) === "real" ? "real" : "screen";
  private progress: CourseProgressV1 = loadCourseProgress(localStorage);
  private instrumentRevealed = false;
  private heardMidi: number[] = [];
  private heardChords: (string | null)[] = [];
  private strumTimes: number[] = [];
  private activityEvaluation: LessonEvaluation | null = null;
  private referenceTimers: number[] = [];
  private micStatus = "Microphone is off.";
  private stableMidi: number | null = null;
  private stableFrames = 0;
  private lastAcceptedPitchAt = 0;

  private readonly noteListener = (event: Event) => this.onInstrumentNote((event as CustomEvent<InstrumentNoteDetail>).detail);
  private readonly strumListener = (event: Event) => this.onInstrumentStrum((event as CustomEvent<InstrumentStrumDetail>).detail);

  constructor(private readonly options: CourseControllerOptions) {
    window.addEventListener("four-strings:note", this.noteListener);
    window.addEventListener("four-strings:strum", this.strumListener);
    this.options.root.addEventListener("click", (event) => this.onClick(event));
    this.options.root.addEventListener("change", () => this.renderActivityActions());
  }

  enter(): void {
    this.active = true;
    this.progress = loadCourseProgress(localStorage);
    this.render();
  }

  leave(): void {
    this.active = false;
    this.stopReference();
    this.stopMicrophone();
    this.resetActivityState();
  }

  dispose(): void {
    this.leave();
    window.removeEventListener("four-strings:note", this.noteListener);
    window.removeEventListener("four-strings:strum", this.strumListener);
  }

  private onClick(event: Event): void {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("button, [data-course-check]") : null;
    if (!target) return;
    const lessonButton = target.closest<HTMLButtonElement>("[data-course-lesson]");
    if (lessonButton?.dataset.courseLesson) {
      this.openLesson(lessonButton.dataset.courseLesson);
      return;
    }
    if (target.id === "course-continue") {
      this.openLesson(nextRecommendedLessonId(this.progress));
      return;
    }
    if (target.id === "course-back-home") {
      this.stopReference();
      this.stopMicrophone();
      this.lessonId = null;
      this.render();
      return;
    }
    if (target.id === "course-reset") {
      if (window.confirm("Reset all Book One progress on this browser?")) {
        resetCourseProgress(localStorage);
        this.progress = loadCourseProgress(localStorage);
        this.render();
      }
      return;
    }
    if (target.id === "course-input-screen" || target.id === "course-input-real") {
      this.input = target.id.endsWith("real") ? "real" : "screen";
      localStorage.setItem(INPUT_KEY, this.input);
      if (this.input === "screen") this.stopMicrophone();
      this.resetActivityState();
      this.render();
      return;
    }
    if (target.id === "course-instrument-toggle") {
      this.options.toggleInstrument();
      this.render();
      return;
    }
    const stageButton = target.closest<HTMLButtonElement>("[data-course-stage]");
    if (stageButton?.dataset.courseStage) {
      this.goToStage(COURSE_STAGES.indexOf(stageButton.dataset.courseStage as typeof COURSE_STAGES[number]));
      return;
    }
    if (target.id === "course-next") {
      this.goToStage(Math.min(COURSE_STAGES.length - 1, this.stageIndex + 1));
      return;
    }
    if (target.id === "course-previous") {
      this.goToStage(Math.max(0, this.stageIndex - 1));
      return;
    }
    if (target.id === "course-hear" || target.id === "course-hear-slower") {
      void this.playReference(target.id.endsWith("slower") ? 0.65 : 1);
      return;
    }
    const answer = target.closest<HTMLButtonElement>("[data-course-answer]");
    if (answer?.dataset.courseAnswer !== undefined) {
      this.answerEarChoice(answer.dataset.courseAnswer);
      return;
    }
    if (target.id === "course-submit") {
      this.submitActivity();
      return;
    }
    if (target.id === "course-retry") {
      this.resetActivityState();
      this.render();
      return;
    }
    if (target.id === "course-mic-toggle") {
      if (this.options.tuner.isListening) this.stopMicrophone();
      else void this.startMicrophone();
      return;
    }
    if (target.id === "course-ask-astra") void this.askAstra();
  }

  private openLesson(id: string): void {
    courseLesson(id);
    this.lessonId = id;
    this.stageIndex = 0;
    this.progress = { ...this.progress, lastLessonId: id };
    saveCourseProgress(localStorage, this.progress);
    this.resetActivityState();
    this.render();
  }

  private goToStage(index: number): void {
    this.stopReference();
    this.stopMicrophone();
    this.stageIndex = index;
    this.resetActivityState();
    this.render();
  }

  private resetActivityState(): void {
    this.instrumentRevealed = false;
    this.heardMidi = [];
    this.heardChords = [];
    this.strumTimes = [];
    this.activityEvaluation = null;
    this.stableMidi = null;
    this.stableFrames = 0;
  }

  private render(): void {
    if (!this.active) return;
    this.options.root.innerHTML = this.lessonId ? this.readerMarkup(courseLesson(this.lessonId)) : this.homeMarkup();
    if (this.lessonId) this.renderActivityActions();
  }

  private homeMarkup(): string {
    const completed = COURSE_LESSONS.filter((lesson) => this.progress.lessons[lesson.id]?.completedAt).length;
    const secure = COURSE_LESSONS.filter((lesson) => this.progress.lessons[lesson.id]?.secureAt).length;
    const next = courseLesson(nextRecommendedLessonId(this.progress));
    return `<div class="course-home">
      <header class="course-hero">
        <div><span class="course-overline">Four Strings method book</span><h2>Book One · Foundations</h2>
        <p>Sargam first. Western names beside it. Learn to see, hear, guess, play, and understand—not only copy shapes.</p></div>
        <div class="course-hero-actions"><div class="course-progress-orb"><strong>${completed}</strong><span>of 24 studied</span></div>
        <button class="course-primary" id="course-continue" type="button">Continue · Lesson ${next.number}</button></div>
      </header>
      <div class="course-summary"><span id="course-progress-summary"><strong>${completed} completed</strong> · <strong>${secure} secure</strong></span>
      <span>24 open lessons · about 4 hours</span><button id="course-reset" class="course-text-button" type="button">Reset progress</button></div>
      <div class="course-units">${COURSE_UNITS.map((unit) => `<section class="course-unit">
        <header><span>Unit ${String(unit.number).padStart(2, "0")}</span><div><h3>${unit.title}</h3><p>${unit.description}</p></div></header>
        <div class="course-lesson-grid">${unit.lessonIds.map((id) => this.lessonCard(courseLesson(id))).join("")}</div>
      </section>`).join("")}</div>
    </div>`;
  }

  private lessonCard(lesson: CourseLesson): string {
    const state = this.progress.lessons[lesson.id];
    const status = state?.secureAt ? "Secure" : state?.completedAt ? "Completed" : "Open";
    return `<button class="course-lesson-card" data-course-lesson="${lesson.id}" data-status="${status.toLowerCase()}" type="button">
      <span class="course-lesson-number">${String(lesson.number).padStart(2, "0")}</span>
      <span class="course-lesson-copy"><strong>${lesson.title}</strong><small>${lesson.objective}</small>
      <span class="course-tags">${lesson.activityLabels.map((label) => `<i>${label}</i>`).join("")}<i>${lesson.durationMinutes} min</i></span></span>
      <span class="course-card-status">${status}${status === "Secure" ? " ✓" : ""}</span>
    </button>`;
  }

  private readerMarkup(lesson: CourseLesson): string {
    const activity = lesson.activities[this.stageIndex];
    const saved = this.progress.lessons[lesson.id];
    return `<article class="course-reader" id="course-reader">
      <header class="course-reader-header">
        <button id="course-back-home" class="course-back" type="button">← All lessons</button>
        <div class="course-reader-title"><span>Lesson ${String(lesson.number).padStart(2, "0")} · ${lesson.durationMinutes} minutes</span><h2 id="course-reader-title">${lesson.title}</h2><p>${lesson.objective}</p></div>
        <div class="course-reader-status">${saved?.secureAt ? "Secure ✓" : saved?.completedAt ? "Completed" : "In progress"}</div>
      </header>
      <section class="course-input-choice" aria-label="Choose how to play">
        <div><span>Practise with</span><p id="course-input-note">${this.input === "real" ? "Your microphone listens locally for notes and attacks; uncertain chords offer a string-by-string check." : "The playable ukulele below gives exact string, fret, chord, and rhythm events."}</p></div>
        <div role="group" aria-label="Course instrument source">
          <button id="course-input-screen" class="${this.input === "screen" ? "is-selected" : ""}" aria-pressed="${this.input === "screen"}" type="button">On-screen ukulele</button>
          <button id="course-input-real" class="${this.input === "real" ? "is-selected" : ""}" aria-pressed="${this.input === "real"}" type="button">My ukulele</button>
          <button id="course-instrument-toggle" class="course-instrument-toggle" type="button">${this.options.instrumentExpanded() ? "Compact strings" : "Open fretboard"}</button>
        </div>
      </section>
      <nav class="course-stage-rail" aria-label="Lesson stages">${lesson.activities.map((candidate, index) => `<button data-course-stage="${candidate.stage}" class="${index === this.stageIndex ? "is-current" : index < this.stageIndex ? "is-past" : ""}" aria-current="${index === this.stageIndex ? "step" : "false"}" type="button"><span>${index + 1}</span>${stageLabel(candidate.stage)}</button>`).join("")}</nav>
      <div class="course-page">
        <aside class="course-margin"><span>${String(lesson.number).padStart(2, "0")}</span><p>${lesson.primaryTerms.length ? lesson.primaryTerms.join(" · ") : lesson.activityLabels.join(" · ")}</p><small>${lesson.westernTerms.length ? `Western · ${lesson.westernTerms.join(" · ")}` : "GCEA · high G"}</small></aside>
        <section class="course-activity" id="course-activity">${this.activityMarkup(lesson, activity)}</section>
      </div>
      <footer class="course-reader-footer"><button id="course-previous" type="button" ${this.stageIndex === 0 ? "disabled" : ""}>Previous</button>
      <span>Page ${this.stageIndex + 1} of 6</span><button class="course-primary" id="course-next" type="button" ${this.stageIndex === 5 ? "disabled" : ""}>${this.stageIndex === 4 ? "See recap" : "Next"}</button></footer>
    </article>`;
  }

  private activityMarkup(lesson: CourseLesson, activity: CourseActivity): string {
    const visual = this.visualMarkup(activity, lesson);
    const controls = activity.stage === "hear"
      ? `<div class="course-hear-actions"><button id="course-hear" class="course-primary" type="button">▶ Hear it</button><button id="course-hear-slower" type="button">Again slower</button></div>`
      : activity.kind === "ear-choice"
        ? `<div class="course-answer-grid">${activity.choices.map((choice) => `<button data-course-answer="${choice}" type="button">${choice}</button>`).join("")}</div>
          <p class="course-ear-warning" id="course-ear-warning" ${this.instrumentRevealed ? "" : "hidden"}>The playable instrument may have revealed the answer. You can continue, but retry before using the instrument for this answer to count toward Secure.</p>`
        : activity.stage === "play" || activity.stage === "check"
          ? this.playControls(activity)
          : activity.stage === "recap"
            ? this.recapMarkup(lesson)
            : "";
    return `<div class="course-activity-heading"><span>${stageLabel(activity.stage)} · ${activity.kind.replace("-", " ")}</span><h3>${activity.title}</h3><p>${activity.instruction}</p></div>${visual}${controls}<div id="course-evaluation" class="course-evaluation" aria-live="polite">${this.evaluationMarkup()}</div>`;
  }

  private visualMarkup(activity: CourseActivity, lesson: CourseLesson): string {
    const reference = activity.kind === "explain" ? activity.referenceNotes ?? [] : [];
    if (activity.kind === "note-sequence") return `<div class="course-note-path">${activity.notes.map((note, index) => `<span class="${index < this.heardMidi.length ? "is-heard" : index === this.heardMidi.length ? "is-next" : ""}"><small>${note.sargam ?? stringNumber(note.stringIndex)}</small><strong>${note.sargam ?? note.western.replace(/\d$/, "")}</strong><i>${note.western}</i><em>${stringNumber(note.stringIndex)},${note.fret}</em></span>`).join("")}</div>`;
    if (activity.kind === "rhythm" || activity.kind === "performance") return this.rhythmVisual(activity);
    if (activity.kind === "chord") return `<div class="course-chord-path">${activity.chords.map((chord, index) => `<span class="${index < this.heardChords.length ? "is-heard" : index === this.heardChords.length ? "is-next" : ""}"><strong>${chord}</strong><small>${LESSON_CHORDS[chord].frets.join(" · ")}</small><i>${chordMidiNotes(chord).map(noteName).join(" · ")}</i></span>`).join("<b>→</b>")}</div>`;
    if (activity.kind === "self-check") return `<div class="course-posture-figure"><div class="course-uke-silhouette" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p>Let the instrument rest against you. The fretting hand guides; it does not carry all the weight.</p></div>`;
    if (activity.kind === "compose") return `<div class="course-compose-lane">${Array.from({ length: activity.noteCount }, (_, index) => `<span class="${index < this.heardMidi.length ? "is-filled" : ""}">${index < this.heardMidi.length ? noteName(this.heardMidi[index]) : index + 1}</span>`).join("")}</div>`;
    const hearActivity = lesson.activities.find((candidate) => candidate.stage === "hear");
    const notes: readonly number[] = reference.length
      ? reference
      : hearActivity?.kind === "explain"
        ? hearActivity.referenceNotes ?? []
        : [];
    return `<div class="course-concept-visual" data-visual="${activity.kind === "explain" ? activity.visual : "waveform"}"><div class="course-staff-lines" aria-hidden="true"></div>${notes.map((midi, index) => `<span style="--course-step:${index};--course-pitch:${Math.max(0, Math.min(12, midi - 60))}"><strong>${sargamName(midi)}</strong><small>${noteName(midi)}</small></span>`).join("") || `<blockquote>${lesson.concept}</blockquote>`}</div>`;
  }

  private rhythmVisual(activity: RhythmActivity | PerformanceActivity): string {
    const sounded = activity.strokes.filter((stroke) => stroke.sounded);
    return `<div class="course-rhythm-lane">${activity.strokes.map((stroke) => `<span class="${stroke.sounded ? "is-sounded" : "is-air"}"><small>${stroke.slot % 2 === 0 ? Math.floor(stroke.slot / 2) + 1 : "&"}</small><strong>${stroke.sounded ? stroke.direction === "down" ? "↓" : "↑" : "○"}</strong><i>${stroke.sounded ? "sound" : "air"}</i></span>`).join("")}</div><p class="course-measure-note">${activity.bpm} BPM · ${sounded.length} sounding ${sounded.length === 1 ? "stroke" : "strokes"} · direction is taught visually; microphone scoring measures timing only.</p>`;
  }

  private playControls(activity: CourseActivity): string {
    if (activity.kind === "self-check") return `<fieldset class="course-checklist"><legend>Complete the physical check</legend>${activity.checks.map((check) => `<label><input data-course-check type="checkbox"> <span>${check}</span></label>`).join("")}</fieldset><button id="course-submit" class="course-primary" type="button">Check this page</button>`;
    const mic = this.input === "real" ? `<div class="course-mic-row"><button id="course-mic-toggle" type="button">${this.options.tuner.isListening ? "Stop listening" : "Start listening"}</button><span>${this.micStatus}</span></div>` : "";
    const status = activity.kind === "note-sequence" || activity.kind === "compose"
      ? `${this.heardMidi.length} notes heard`
      : activity.kind === "chord"
        ? `${this.heardChords.length} chords checked`
        : `${this.strumTimes.length} attacks heard`;
    const chordCaveat = this.input === "real" && activity.kind === "chord"
      ? `<p class="course-honesty-note">Whole-chord recognition needs a short polyphonic recording. If confidence is low, use Check chord and pick each string separately; this page will not guess.</p>`
      : "";
    return `${mic}<div class="course-now-try"><span>Now you try</span><strong>${status}</strong><p>${this.input === "screen" ? "Use the playable ukulele below. Targets update as you play." : "Start listening, then play one clear attempt near this device."}</p></div>${chordCaveat}<button id="course-submit" class="course-primary" type="button">Check my attempt</button>`;
  }

  private recapMarkup(lesson: CourseLesson): string {
    const saved = this.progress.lessons[lesson.id];
    return `<div class="course-recap"><span>${saved?.secureAt ? "Secure ✓" : saved?.completedAt ? "Completed" : "Ready to attempt"}</span><h4>${lesson.objective}</h4><p>${saved?.bestResult?.retryHint ?? "Return to Check when you are ready to make a measured attempt."}</p>${saved?.bestResult && !saved.bestResult.secure ? `<button id="course-ask-astra" type="button">Ask Astra for one focused retry</button><small>Powered by GPT-6 Astra · optional</small>` : ""}</div>`;
  }

  private evaluationMarkup(): string {
    if (!this.activityEvaluation) return "";
    const label = this.activityEvaluation.secure ? "Secure ✓" : this.instrumentRevealed ? "Exploratory" : "Attempt recorded";
    return `<strong>${label}</strong><p>${this.activityEvaluation.retryHint}</p>${this.activityEvaluation.accuracy === null ? "" : `<span>${Math.round(this.activityEvaluation.accuracy * 100)}% of the objective landed</span>`}`;
  }

  private renderActivityActions(): void {
    if (!this.lessonId || !this.active) return;
    const activity = courseLesson(this.lessonId).activities[this.stageIndex];
    const submit = this.options.root.querySelector<HTMLButtonElement>("#course-submit");
    if (submit && activity.kind === "self-check") {
      const checks = [...this.options.root.querySelectorAll<HTMLInputElement>("[data-course-check]")];
      submit.disabled = checks.length === 0 || !checks.every((check) => check.checked);
    }
  }

  private answerEarChoice(choice: string): void {
    if (!this.lessonId) return;
    const activity = courseLesson(this.lessonId).activities[this.stageIndex];
    if (activity.kind !== "ear-choice") return;
    this.activityEvaluation = evaluateCourseEarChoice(activity.correctChoice, choice, this.instrumentRevealed);
    this.render();
  }

  private submitActivity(): void {
    if (!this.lessonId) return;
    const lesson = courseLesson(this.lessonId);
    const activity = lesson.activities[this.stageIndex];
    let evaluation: LessonEvaluation;
    if (activity.kind === "self-check") {
      const checks = [...this.options.root.querySelectorAll<HTMLInputElement>("[data-course-check]")];
      const checked = checks.filter((check) => check.checked).length;
      evaluation = {
        attempted: checked > 0,
        secure: checked === activity.checks.length,
        accuracy: activity.checks.length ? checked / activity.checks.length : null,
        evidence: { checked, expected: activity.checks.length },
        retryHint: checked === activity.checks.length ? "Your setup is ready for relaxed movement." : "Complete each posture check before moving on.",
      };
    } else if (activity.kind === "note-sequence") evaluation = evaluateCourseNoteSequence(activity.notes.map((note) => note.midi), this.heardMidi);
    else if (activity.kind === "chord") evaluation = evaluateCourseChordSequence(activity.chords, this.heardChords);
    else if (activity.kind === "rhythm") evaluation = this.rhythmEvaluation(activity);
    else if (activity.kind === "performance") {
      const rhythm = this.rhythmEvaluation(activity);
      const chords = activity.chords.length ? this.heardChords.filter(Boolean).length >= Math.min(activity.chords.length, 1) : true;
      evaluation = evaluateCourseComposite({ ear: true, chords, rhythm: rhythm.secure, performance: this.strumTimes.length > 0 });
    } else if (activity.kind === "compose") evaluation = evaluateCourseNoteSequence(new Array(activity.noteCount).fill(0), this.heardMidi.map(() => 0));
    else return;
    this.activityEvaluation = evaluation;
    if (activity.id === lesson.secureActivityId) {
      this.progress = recordLessonAttempt(this.progress, lesson.id, evaluation);
      saveCourseProgress(localStorage, this.progress);
    }
    this.render();
  }

  private rhythmEvaluation(activity: RhythmActivity | PerformanceActivity): LessonEvaluation {
    const expected = activity.strokes.filter((stroke) => stroke.sounded).length;
    if (!this.strumTimes.length) return evaluateCourseRhythm({ expectedCount: expected, onTime: 0, missed: expected, extra: 0 });
    const expectedGap = 60_000 / activity.bpm / 2;
    let onTime = 1;
    for (let index = 1; index < Math.min(expected, this.strumTimes.length); index += 1) {
      const gap = this.strumTimes[index] - this.strumTimes[index - 1];
      if (Math.abs(gap - expectedGap) <= Math.max(90, expectedGap * 0.22)) onTime += 1;
    }
    return evaluateCourseRhythm({ expectedCount: expected, onTime, missed: Math.max(0, expected - this.strumTimes.length), extra: Math.max(0, this.strumTimes.length - expected) });
  }

  private async playReference(speed: number): Promise<void> {
    if (!this.lessonId || !(await this.options.ensureAudio())) return;
    const activity = courseLesson(this.lessonId).activities[this.stageIndex];
    const notes = activity.kind === "explain" ? activity.referenceNotes ?? []
      : activity.kind === "ear-choice" ? activity.referenceNotes
        : activity.kind === "note-sequence" ? activity.notes.map((note) => note.midi)
          : activity.kind === "chord" ? activity.chords.flatMap((chord) => chordMidiNotes(chord))
            : [];
    this.stopReference();
    const gap = 520 / speed;
    notes.forEach((midi, index) => this.referenceTimers.push(window.setTimeout(() => {
      this.options.audio.pluckString(index % 4, midi, 0.66);
    }, index * gap)));
  }

  private stopReference(): void {
    this.referenceTimers.forEach(window.clearTimeout);
    this.referenceTimers = [];
  }

  private onInstrumentNote(detail: InstrumentNoteDetail): void {
    if (!this.active || !this.lessonId) return;
    const activity = courseLesson(this.lessonId).activities[this.stageIndex];
    if (activity.kind === "ear-choice" && !this.activityEvaluation) {
      this.instrumentRevealed = true;
      this.render();
      return;
    }
    if (this.input !== "screen" || (activity.stage !== "play" && activity.stage !== "check")) return;
    if (activity.kind === "note-sequence") this.heardMidi = [...this.heardMidi, detail.midi].slice(-activity.notes.length);
    else if (activity.kind === "compose") this.heardMidi = [...this.heardMidi, detail.midi].slice(-activity.noteCount);
    else return;
    this.activityEvaluation = null;
    this.render();
  }

  private onInstrumentStrum(detail: InstrumentStrumDetail): void {
    if (!this.active || !this.lessonId) return;
    const activity = courseLesson(this.lessonId).activities[this.stageIndex];
    if (activity.kind === "ear-choice" && !this.activityEvaluation) {
      this.instrumentRevealed = true;
      this.render();
      return;
    }
    if (this.input !== "screen" || (activity.stage !== "play" && activity.stage !== "check")) return;
    if (activity.kind === "chord" || activity.kind === "performance") {
      const candidates = activity.kind === "chord" ? activity.chords : activity.chords;
      const matched = candidates.find((chord) => LESSON_CHORDS[chord].frets.every((fret, index) => fret === detail.frets[index])) ?? null;
      this.heardChords = [...this.heardChords, matched].slice(-candidates.length);
    }
    if (activity.kind === "rhythm" || activity.kind === "performance") this.strumTimes = [...this.strumTimes, detail.at];
    this.activityEvaluation = null;
    this.render();
  }

  private async startMicrophone(): Promise<void> {
    await this.options.tuner.start((reading, signal) => {
      if (!this.active || this.input !== "real" || !this.lessonId) return;
      const activity = courseLesson(this.lessonId).activities[this.stageIndex];
      if ((activity.kind === "rhythm" || activity.kind === "performance") && signal.rms > 0.03) {
        const last = this.strumTimes.at(-1) ?? 0;
        if (signal.at - last > 180) this.strumTimes.push(signal.at);
      }
      if (!reading || (activity.kind !== "note-sequence" && activity.kind !== "compose")) return;
      const midi = Math.round(69 + 12 * Math.log2(reading.frequency / 440));
      if (midi === this.stableMidi) this.stableFrames += 1;
      else { this.stableMidi = midi; this.stableFrames = 1; }
      if (this.stableFrames >= 3 && signal.at - this.lastAcceptedPitchAt > 320) {
        this.heardMidi.push(midi);
        this.lastAcceptedPitchAt = signal.at;
        this.stableFrames = 0;
        this.render();
      }
    }, (status: TunerStatus, message: string) => {
      this.micStatus = message;
      if (status === "error" || status === "listening") this.render();
    });
    this.render();
  }

  private stopMicrophone(): void {
    if (this.options.tuner.isListening) this.options.tuner.stop();
    this.micStatus = "Microphone is off.";
  }

  private async askAstra(): Promise<void> {
    if (!this.lessonId) return;
    const lesson = courseLesson(this.lessonId);
    const saved = this.progress.lessons[lesson.id]?.bestResult;
    if (!saved) return;
    const button = this.options.root.querySelector<HTMLButtonElement>("#course-ask-astra");
    if (button) { button.disabled = true; button.textContent = "Asking Astra…"; }
    try {
      const activity = lesson.activities.find((candidate) => candidate.id === lesson.secureActivityId)!;
      const response = await fetch("/api/lesson-coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId: lesson.id, activityId: activity.id, activityKind: activity.kind, attempted: saved.attempted, secure: saved.secure, accuracy: saved.accuracy, evidence: saved.evidence }) });
      const payload = await response.json() as { decision?: { correction: string; evidence: string }; error?: string };
      const recap = this.options.root.querySelector<HTMLElement>(".course-recap");
      if (recap) recap.insertAdjacentHTML("beforeend", `<div class="course-astra-card"><span>Powered by GPT-6 Astra</span><strong>${payload.decision?.correction ?? payload.error ?? "Coaching is unavailable."}</strong>${payload.decision ? `<p>${payload.decision.evidence}</p>` : ""}</div>`);
    } catch {
      if (button) { button.disabled = false; button.textContent = "Retry Astra coaching"; }
    }
  }
}

function stageLabel(stage: string): string {
  return ({ see: "See", hear: "Hear", guess: "Guess", play: "Play", check: "Check", recap: "Recap" } as Record<string, string>)[stage] ?? stage;
}

function stringNumber(index: number): number { return 4 - index; }

function noteName(midi: number): string {
  const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function sargamName(midi: number): string {
  return ({ 0: "Sa", 2: "Re", 4: "Ga", 5: "Ma", 7: "Pa", 9: "Dha", 11: "Ni" } as Record<number, string>)[((midi % 12) + 12) % 12] ?? "·";
}
