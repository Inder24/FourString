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
  evaluateCourseRhythmTiming,
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
import { OnsetDetector } from "./coach";
import { RealMelodyConfirmation } from "./song-input";
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
  private selectedPart = "";
  private selectedAnswer = "";
  private rhythmPhase: "idle" | "count-in" | "recording" | "complete" = "idle";
  private countInBeat = 0;
  private activeRhythmSlot = -1;
  private readonly onsetDetector = new OnsetDetector(0.018, 150);
  private readonly melodyConfirmation = new RealMelodyConfirmation(3, 180);

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
    const part = target.closest<HTMLButtonElement>("[data-course-part]");
    if (part?.dataset.coursePart) {
      this.selectInstrumentPart(part.dataset.coursePart);
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
    if (target.id === "course-start-take") {
      void this.startRhythmAttempt();
      return;
    }
    if (target.id === "course-stop-take") {
      this.stopReference();
      this.stopMicrophone();
      this.rhythmPhase = this.strumTimes.length ? "complete" : "idle";
      this.renderCurrentStage();
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
    this.renderCurrentStage(true);
  }

  private resetActivityState(): void {
    this.instrumentRevealed = false;
    this.heardMidi = [];
    this.heardChords = [];
    this.strumTimes = [];
    this.activityEvaluation = null;
    this.stableMidi = null;
    this.stableFrames = 0;
    this.selectedPart = "";
    this.selectedAnswer = "";
    this.rhythmPhase = "idle";
    this.countInBeat = 0;
    this.activeRhythmSlot = -1;
    this.onsetDetector.reset();
    this.melodyConfirmation.reset();
  }

  private render(): void {
    if (!this.active) return;
    this.options.root.innerHTML = this.lessonId ? this.readerMarkup(courseLesson(this.lessonId)) : this.homeMarkup();
    if (this.lessonId) this.renderActivityActions();
  }

  private renderCurrentStage(moveFocus = false): void {
    if (!this.active || !this.lessonId) return;
    const lesson = courseLesson(this.lessonId);
    const reader = this.options.root.querySelector<HTMLElement>("#course-reader");
    const activityRoot = this.options.root.querySelector<HTMLElement>("#course-activity");
    if (!reader || !activityRoot) {
      this.render();
      return;
    }
    activityRoot.innerHTML = this.activityMarkup(lesson, lesson.activities[this.stageIndex]);
    const stageButtons = [...reader.querySelectorAll<HTMLButtonElement>("[data-course-stage]")];
    stageButtons.forEach((button, index) => {
      button.classList.toggle("is-current", index === this.stageIndex);
      button.classList.toggle("is-past", index < this.stageIndex);
      button.setAttribute("aria-current", index === this.stageIndex ? "step" : "false");
    });
    const previous = reader.querySelector<HTMLButtonElement>("#course-previous");
    const next = reader.querySelector<HTMLButtonElement>("#course-next");
    const page = reader.querySelector<HTMLElement>(".course-reader-footer span");
    if (previous) previous.disabled = this.stageIndex === 0;
    if (next) {
      next.disabled = this.stageIndex === COURSE_STAGES.length - 1;
      next.textContent = this.stageIndex === 4 ? "See summary" : "Next";
    }
    if (page) page.textContent = `Step ${this.stageIndex + 1} of ${COURSE_STAGES.length}`;
    const inputNote = reader.querySelector<HTMLElement>("#course-input-note");
    if (inputNote) inputNote.textContent = this.inputDescription(lesson.activities[this.stageIndex]);
    this.renderActivityActions();
    if (moveFocus) activityRoot.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
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
        <div><span>Practise with</span><p id="course-input-note">${this.inputDescription(activity)}</p></div>
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
      <span>Step ${this.stageIndex + 1} of 6</span><button class="course-primary" id="course-next" type="button" ${this.stageIndex === 5 ? "disabled" : ""}>${this.stageIndex === 4 ? "See summary" : "Next"}</button></footer>
    </article>`;
  }

  private inputDescription(activity: CourseActivity): string {
    if (activity.kind === "self-check") return "No microphone is needed here—use the checklist to confirm a relaxed hold.";
    if (activity.kind === "ear-choice") return "Listen and answer first. The playable instrument remains available after your choice.";
    if (this.input === "real") return activity.kind === "chord" || activity.kind === "performance"
      ? "For reliable chord feedback, the lesson checks each string locally before accepting the shape."
      : "Your microphone listens locally for notes and attacks. Audio never leaves this device.";
    return "The on-screen ukulele gives exact string, fret, chord, and rhythm events.";
  }

  private activityMarkup(lesson: CourseLesson, activity: CourseActivity): string {
    const visual = this.visualMarkup(activity, lesson);
    const controls = activity.stage === "hear"
      ? `<div class="course-hear-actions"><button id="course-hear" class="course-primary" type="button">▶ Hear it</button><button id="course-hear-slower" type="button">Again slower</button></div>`
      : activity.kind === "ear-choice"
        ? `<div class="course-guess-toolbar">${lesson.id === "your-ukulele" ? "" : `<button id="course-hear" type="button">▶ Hear example again</button>`}<span>${lesson.id === "your-ukulele" ? "Use the map above, then choose the matching part." : "One listen, then trust your ear."}</span></div><div class="course-answer-grid">${activity.choices.map((choice) => `<button data-course-answer="${choice}" data-state="${this.selectedAnswer === choice ? this.activityEvaluation?.accuracy === 1 ? "correct" : "incorrect" : "idle"}" aria-pressed="${this.selectedAnswer === choice}" type="button">${choice}</button>`).join("")}</div>
          <p class="course-ear-warning" id="course-ear-warning" ${this.instrumentRevealed ? "" : "hidden"}>The playable instrument may have revealed the answer. You can continue, but retry before using the instrument for this answer to count toward Secure.</p>`
        : activity.stage === "play" || activity.stage === "check"
          ? this.playControls(activity)
          : activity.stage === "recap"
            ? this.recapMarkup(lesson)
            : "";
    return `<div class="course-activity-heading"><span>${stageLabel(activity.stage)} · ${activity.kind.replace("-", " ")}</span><h3 tabindex="-1">${activity.title}</h3><p>${activity.instruction}</p></div>${visual}${controls}<div id="course-evaluation" class="course-evaluation" aria-live="polite">${this.evaluationMarkup(activity)}</div>`;
  }

  private visualMarkup(activity: CourseActivity, lesson: CourseLesson): string {
    const reference = activity.kind === "explain" ? activity.referenceNotes ?? [] : [];
    if (activity.kind === "note-sequence") return `<div class="course-note-path">${activity.notes.map((note, index) => `<span class="${index < this.heardMidi.length ? "is-heard" : index === this.heardMidi.length ? "is-next" : ""}"><small>${note.sargam ?? stringNumber(note.stringIndex)}</small><strong>${note.sargam ?? note.western.replace(/\d$/, "")}</strong><i>${note.western}</i><em>${stringNumber(note.stringIndex)},${note.fret}</em></span>`).join("")}</div>`;
    if (activity.kind === "rhythm" || activity.kind === "performance") return this.rhythmVisual(activity);
    if (activity.kind === "chord") return `<div class="course-chord-path">${activity.chords.map((chord, index) => `<span class="${index < this.heardChords.length ? "is-heard" : index === this.heardChords.length ? "is-next" : ""}"><strong>${chord}</strong><small>${LESSON_CHORDS[chord].frets.join(" · ")}</small><i>${chordMidiNotes(chord).map(noteName).join(" · ")}</i></span>`).join("<b>→</b>")}</div>`;
    if (activity.kind === "self-check") return `<div class="course-posture-figure"><img src="/course/ukulele-parts-v1.png" alt="Ukulele resting horizontally, with the neck slightly raised" width="620" height="310"><div><strong>Comfort before speed</strong><p>Let the body rest against you. The fretting hand guides the neck; it does not carry all the weight.</p><small>No camera or microphone is used for this posture check.</small></div></div>`;
    if (activity.kind === "compose") return `<div class="course-compose-lane">${Array.from({ length: activity.noteCount }, (_, index) => `<span class="${index < this.heardMidi.length ? "is-filled" : ""}">${index < this.heardMidi.length ? noteName(this.heardMidi[index]) : index + 1}</span>`).join("")}</div>`;
    if (activity.kind === "ear-choice") {
      return lesson.id === "your-ukulele"
        ? this.instrumentMapMarkup(false)
        : `<div class="course-listening-card" aria-label="Listening challenge"><span aria-hidden="true">♪</span><div><strong>Listen from memory</strong><p>Replay the example only if you need it, then choose the closest answer below.</p></div><div class="course-wave-bars" aria-hidden="true">${Array.from({ length: 13 }, (_, index) => `<i style="--bar:${(index * 7) % 9 + 2}"></i>`).join("")}</div></div>`;
    }
    if (activity.kind === "explain" && activity.visual === "ukulele") return this.instrumentMapMarkup(true);
    if (activity.kind === "explain" && activity.visual === "beat-grid") return `<div class="course-beat-concept"><div><strong>1</strong><span>beat</span></div><i></i><div><strong>2</strong><span>beat</span></div><i></i><div><strong>3</strong><span>beat</span></div><i></i><div><strong>4</strong><span>beat</span></div></div>`;
    if (activity.kind === "explain" && activity.visual === "chord-stack") return `<div class="course-stack-visual"><span><small>Pa</small><strong>G</strong></span><span><small>Ga</small><strong>E</strong></span><span><small>Sa</small><strong>C</strong></span><p>Separate notes become one colour when they ring together.</p></div>`;
    if (activity.kind === "explain" && activity.visual === "progression") {
      const play = lesson.activities.find((candidate) => candidate.stage === "play");
      const chords = play && (play.kind === "chord" || play.kind === "performance") ? play.chords : [];
      return `<div class="course-progression-visual">${chords.map((chord, index) => `<span><small>${index + 1}</small><strong>${chord}</strong></span>`).join("<b>→</b>") || `<blockquote>${lesson.concept}</blockquote>`}</div>`;
    }
    if (activity.kind === "explain" && activity.visual === "waveform") return `<div class="course-wave-visual" aria-label="Sound changing over time">${Array.from({ length: 28 }, (_, index) => `<i style="--wave:${Math.round(18 + Math.abs(Math.sin(index * 1.7)) * 65)}%"></i>`).join("")}</div>`;
    const hearActivity = lesson.activities.find((candidate) => candidate.stage === "hear");
    const notes: readonly number[] = reference.length
      ? reference
      : hearActivity?.kind === "explain"
        ? hearActivity.referenceNotes ?? []
        : [];
    return `<div class="course-concept-visual" data-visual="${activity.kind === "explain" ? activity.visual : "waveform"}"><div class="course-staff-lines" aria-hidden="true"></div>${notes.map((midi, index) => `<span style="--course-step:${index};--course-pitch:${Math.max(0, Math.min(12, midi - 60))}"><strong>${sargamName(midi)}</strong><small>${noteName(midi)}</small></span>`).join("") || `<blockquote>${lesson.concept}</blockquote>`}</div>`;
  }

  private instrumentMapMarkup(interactive: boolean): string {
    const parts = [
      ["headstock", "Headstock", "Holds the tuning pegs."],
      ["neck", "Neck", "Supports the fretboard and fretting hand."],
      ["strings", "Strings", "Four vibrating voices: G, C, E, A."],
      ["sound-hole", "Sound hole", "Lets the vibrating body project sound."],
      ["bridge", "Bridge", "Anchors the strings to the body."],
      ["body", "Body", "Amplifies the strings naturally."],
    ] as const;
    const selected = parts.find(([id]) => id === this.selectedPart);
    return `<div class="course-ukulele-map ${interactive ? "is-interactive" : "is-question"}"><img src="/course/ukulele-parts-v1.png" alt="Ukulele showing the headstock, neck, four strings, sound hole, bridge, and body" width="1200" height="600">${interactive ? parts.map(([id, label]) => `<button data-course-part="${id}" class="part-${id} ${this.selectedPart === id ? "is-selected" : ""}" aria-pressed="${this.selectedPart === id}" type="button"><span>${label}</span></button>`).join("") : ""}</div>${interactive ? `<div id="course-part-detail" class="course-part-detail" aria-live="polite"><strong>${selected?.[1] ?? "Tap a part to explore"}</strong><span>${selected?.[2] ?? "Learn what each part does before you hold the instrument."}</span></div>` : ""}`;
  }

  private rhythmVisual(activity: RhythmActivity | PerformanceActivity): string {
    const sounded = activity.strokes.filter((stroke) => stroke.sounded);
    return `<div class="course-tempo-header"><span><strong>${activity.bpm}</strong> BPM</span><p>${Math.round(60_000 / activity.bpm)} ms between quarter-note pulses</p></div><div class="course-rhythm-lane">${activity.strokes.map((stroke) => `<span data-slot="${stroke.slot}" class="${stroke.sounded ? "is-sounded" : "is-air"} ${stroke.slot === this.activeRhythmSlot ? "is-active" : ""}"><small>${stroke.slot % 2 === 0 ? Math.floor(stroke.slot / 2) + 1 : "&"}</small><strong>${stroke.sounded ? stroke.direction === "down" ? "↓" : "↑" : "○"}</strong><i>${stroke.sounded ? "strum" : "air"}</i></span>`).join("")}</div><p class="course-measure-note">${sounded.length} sounding ${sounded.length === 1 ? "stroke" : "strokes"} · the arrow teaches hand travel; microphone scoring measures timing only.</p>`;
  }

  private playControls(activity: CourseActivity): string {
    if (activity.kind === "self-check") return `<p class="course-mode-note"><strong>No microphone needed.</strong> This is an honest comfort check, not a scored recording.</p><fieldset class="course-checklist"><legend>Complete the physical check</legend>${activity.checks.map((check) => `<label><input data-course-check type="checkbox"> <span>${check}</span></label>`).join("")}</fieldset><button id="course-submit" class="course-primary" type="button">Save this check</button>`;
    if (activity.kind === "rhythm" || activity.kind === "performance") return this.rhythmControls(activity);
    const mic = this.input === "real" ? `<div class="course-mic-row"><button id="course-mic-toggle" type="button">${this.options.tuner.isListening ? "Stop listening" : "Start listening"}</button><span>${this.micStatus}</span></div>` : "";
    const status = activity.kind === "note-sequence" || activity.kind === "compose"
      ? `${this.heardMidi.length} notes heard`
      : activity.kind === "chord"
        ? this.input === "real"
          ? `Chord ${Math.min(activity.chords.length, this.heardChords.length + 1)} of ${activity.chords.length} · ${this.heardMidi.length} of 4 strings matched`
          : `${this.heardChords.length} chords checked`
        : `${this.strumTimes.length} attacks heard`;
    const chordCaveat = this.input === "real" && activity.kind === "chord"
      ? `<p class="course-honesty-note"><strong>Reliable chord check:</strong> pick strings 4 → 3 → 2 → 1. Each accepted pitch advances automatically; then strum the shape for yourself.</p>`
      : "";
    return `${mic}<div class="course-now-try"><span>Your progress</span><strong>${status}</strong><p id="course-attempt-guidance">${this.attemptGuidance(activity)}</p></div>${chordCaveat}<button id="course-submit" class="course-primary" type="button">Check my attempt</button>`;
  }

  private rhythmControls(activity: RhythmActivity | PerformanceActivity): string {
    const expected = activity.strokes.filter((stroke) => stroke.sounded).length;
    const button = this.rhythmPhase === "idle"
      ? `<button id="course-start-take" class="course-primary" type="button">Start 4-beat count-in</button>`
      : this.rhythmPhase === "complete"
        ? `<button id="course-start-take" type="button">Try another take</button>`
        : `<button id="course-stop-take" type="button">Stop take</button>`;
    const count = Math.max(1, 5 - Math.max(1, this.countInBeat));
    const phase = this.rhythmPhase === "count-in" ? `Starting in ${count}…`
      : this.rhythmPhase === "recording" ? `Your turn · ${this.strumTimes.length} of ${expected} attacks heard`
        : this.rhythmPhase === "complete" ? `Take ready · ${this.strumTimes.length} attacks heard`
          : "Ready when you are";
    return `<div class="course-attempt-panel" data-phase="${this.rhythmPhase}"><div class="course-attempt-status"><span>${phase}</span><strong>${this.rhythmPhase === "count-in" ? count : this.rhythmPhase === "recording" ? "PLAY" : `${this.strumTimes.length}/${expected}`}</strong></div><p id="course-attempt-guidance">Strum once on each bright pulse. Listen to four clicks first; your turn begins after count 1.</p><div class="course-take-actions">${button}<button id="course-hear" type="button">Hear the pattern</button></div><small>${this.input === "real" ? "The microphone starts with the count-in. Recording pulses stay visual so speaker clicks are not mistaken for your strums." : "Use the on-screen ukulele after the count-in."}</small></div><button id="course-submit" class="course-primary" type="button">Check my attempt</button>`;
  }

  private attemptGuidance(activity: CourseActivity): string {
    if (activity.kind === "note-sequence") return this.input === "screen" ? "Play the highlighted string and fret; the next note will move forward automatically." : "Play one clear note and let it ring until the next target appears.";
    if (activity.kind === "chord") {
      if (this.input === "screen") return "Load the shown shape and strum all four strings together.";
      const chord = activity.chords[Math.min(this.heardChords.length, activity.chords.length - 1)];
      const targetIndex = Math.min(this.heardMidi.length, 3);
      return `Hold ${chord}, then pick string ${4 - targetIndex} by itself. Target: ${noteName(chordMidiNotes(chord)[targetIndex])}.`;
    }
    if (activity.kind === "compose") return "Choose one note at a time until all phrase spaces are filled.";
    return "Follow the highlighted target.";
  }

  private recapMarkup(lesson: CourseLesson): string {
    const saved = this.progress.lessons[lesson.id];
    return `<div class="course-recap"><span>${saved?.secureAt ? "Secure ✓" : saved?.completedAt ? "Completed" : "Ready to attempt"}</span><h4>${lesson.objective}</h4><p>${saved?.bestResult?.retryHint ?? "Return to Check when you are ready to make a measured attempt."}</p>${saved?.bestResult && !saved.bestResult.secure ? `<button id="course-ask-astra" type="button">Ask Astra for one focused retry</button><small>Powered by GPT-6 Astra · optional</small>` : ""}</div>`;
  }

  private evaluationMarkup(activity: CourseActivity): string {
    if (!this.activityEvaluation) return "";
    const label = activity.kind === "ear-choice"
      ? this.activityEvaluation.accuracy === 1
        ? this.instrumentRevealed ? "Correct · Exploratory" : "Correct ✓"
        : "Not yet"
      : this.activityEvaluation.secure ? "Secure ✓" : this.instrumentRevealed ? "Exploratory" : "Attempt recorded";
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
    if (submit && (activity.kind === "rhythm" || activity.kind === "performance")) submit.disabled = this.rhythmPhase !== "complete";
  }

  private answerEarChoice(choice: string): void {
    if (!this.lessonId) return;
    const activity = courseLesson(this.lessonId).activities[this.stageIndex];
    if (activity.kind !== "ear-choice") return;
    this.activityEvaluation = evaluateCourseEarChoice(activity.correctChoice, choice, this.instrumentRevealed);
    this.selectedAnswer = choice;
    this.renderCurrentStage();
  }

  private selectInstrumentPart(partId: string): void {
    this.selectedPart = partId;
    const parts = [...this.options.root.querySelectorAll<HTMLButtonElement>("[data-course-part]")];
    parts.forEach((part) => {
      const selected = part.dataset.coursePart === partId;
      part.classList.toggle("is-selected", selected);
      part.setAttribute("aria-pressed", String(selected));
    });
    const detail = this.options.root.querySelector<HTMLElement>("#course-part-detail");
    const copy: Readonly<Record<string, [string, string]>> = {
      headstock: ["Headstock", "Holds the tuning pegs."],
      neck: ["Neck", "Supports the fretboard and fretting hand."],
      strings: ["Strings", "Four vibrating voices: G, C, E, A."],
      "sound-hole": ["Sound hole", "Lets the vibrating body project sound."],
      bridge: ["Bridge", "Anchors the strings to the body."],
      body: ["Body", "Amplifies the strings naturally."],
    };
    const selected = copy[partId];
    if (detail && selected) detail.innerHTML = `<strong>${selected[0]}</strong><span>${selected[1]}</span>`;
  }

  private async startRhythmAttempt(): Promise<void> {
    if (!this.lessonId) return;
    const activity = courseLesson(this.lessonId).activities[this.stageIndex];
    if (activity.kind !== "rhythm" && activity.kind !== "performance") return;
    if (!(await this.options.ensureAudio())) return;
    this.stopReference();
    this.strumTimes = [];
    this.activityEvaluation = null;
    this.rhythmPhase = "count-in";
    this.countInBeat = 0;
    this.activeRhythmSlot = -1;
    this.onsetDetector.reset();
    if (this.input === "real" && !this.options.tuner.isListening) {
      await this.startMicrophone();
      if (!this.options.tuner.isListening) {
        this.rhythmPhase = "idle";
        this.renderCurrentStage();
        return;
      }
    }
    const beatMs = 60_000 / activity.bpm;
    for (let beat = 1; beat <= 4; beat += 1) {
      this.referenceTimers.push(window.setTimeout(() => {
        this.countInBeat = beat;
        this.options.audio.playMetronomeClick(beat === 1);
        this.renderCurrentStage();
      }, (beat - 1) * beatMs));
    }
    this.referenceTimers.push(window.setTimeout(() => {
      this.rhythmPhase = "recording";
      this.activeRhythmSlot = -1;
      this.renderCurrentStage();
      const slotMs = beatMs / 2;
      for (const stroke of activity.strokes) {
        this.referenceTimers.push(window.setTimeout(() => {
          if (this.rhythmPhase !== "recording") return;
          this.activeRhythmSlot = stroke.slot;
          this.renderCurrentStage();
        }, stroke.slot * slotMs));
      }
      const finalSlot = Math.max(...activity.strokes.map((stroke) => stroke.slot), 0);
      this.referenceTimers.push(window.setTimeout(() => {
        this.activeRhythmSlot = -1;
        this.rhythmPhase = "complete";
        this.stopMicrophone();
        this.renderCurrentStage();
      }, (finalSlot + 4) * slotMs));
    }, 4 * beatMs));
    this.renderCurrentStage();
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
    return evaluateCourseRhythmTiming(activity.strokes, activity.bpm, this.strumTimes);
  }

  private async playReference(speed: number): Promise<void> {
    if (!this.lessonId || !(await this.options.ensureAudio())) return;
    const lesson = courseLesson(this.lessonId);
    const activity = lesson.activities[this.stageIndex];
    const play = lesson.activities.find((candidate) => candidate.stage === "play");
    const demonstration = (activity.stage === "hear" || activity.stage === "guess") && play ? play : activity;
    this.stopReference();
    if (demonstration.kind === "rhythm" || demonstration.kind === "performance") {
      const slotMs = 60_000 / demonstration.bpm / 2 / speed;
      const demonstrationChords = demonstration.kind === "performance" ? demonstration.chords : null;
      demonstration.strokes.forEach((stroke) => {
        if (!stroke.sounded) return;
        this.referenceTimers.push(window.setTimeout(() => {
          const chordIndex = demonstrationChords
            ? Math.min(demonstrationChords.length - 1, Math.floor(stroke.slot / 2) % demonstrationChords.length)
            : -1;
          const midis = demonstrationChords && chordIndex >= 0 ? chordMidiNotes(demonstrationChords[chordIndex]) : chordMidiNotes("C");
          this.options.audio.strum(midis, stroke.direction, 0.6);
          this.options.audio.playMetronomeClick(stroke.slot === 0);
        }, stroke.slot * slotMs));
      });
      return;
    }
    if (demonstration.kind === "chord") {
      const gap = 950 / speed;
      demonstration.chords.forEach((chord, index) => this.referenceTimers.push(window.setTimeout(() => {
        this.options.audio.strum(chordMidiNotes(chord), "down", 0.62);
      }, index * gap)));
      return;
    }
    const fallbackNotes = activity.kind === "explain" ? activity.referenceNotes ?? []
      : activity.kind === "ear-choice" ? activity.referenceNotes : [];
    const notes: readonly number[] = demonstration.kind === "explain" ? demonstration.referenceNotes ?? []
      : demonstration.kind === "ear-choice" ? demonstration.referenceNotes
        : demonstration.kind === "note-sequence" ? demonstration.notes.map((note) => note.midi)
          : fallbackNotes;
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
      this.renderCurrentStage();
      return;
    }
    if (this.input !== "screen" || (activity.stage !== "play" && activity.stage !== "check")) return;
    if (activity.kind === "note-sequence") this.heardMidi = [...this.heardMidi, detail.midi].slice(-activity.notes.length);
    else if (activity.kind === "compose") this.heardMidi = [...this.heardMidi, detail.midi].slice(-activity.noteCount);
    else return;
    this.activityEvaluation = null;
    this.renderCurrentStage();
  }

  private onInstrumentStrum(detail: InstrumentStrumDetail): void {
    if (!this.active || !this.lessonId) return;
    const activity = courseLesson(this.lessonId).activities[this.stageIndex];
    if (activity.kind === "ear-choice" && !this.activityEvaluation) {
      this.instrumentRevealed = true;
      this.renderCurrentStage();
      return;
    }
    if (this.input !== "screen" || (activity.stage !== "play" && activity.stage !== "check")) return;
    if ((activity.kind === "rhythm" || activity.kind === "performance") && this.rhythmPhase !== "recording") return;
    if (activity.kind === "chord" || activity.kind === "performance") {
      const candidates = activity.kind === "chord" ? activity.chords : activity.chords;
      const matched = candidates.find((chord) => LESSON_CHORDS[chord].frets.every((fret, index) => fret === detail.frets[index])) ?? null;
      this.heardChords = [...this.heardChords, matched].slice(-candidates.length);
    }
    if (activity.kind === "rhythm" || activity.kind === "performance") this.strumTimes = [...this.strumTimes, detail.at];
    this.activityEvaluation = null;
    this.renderCurrentStage();
  }

  private async startMicrophone(): Promise<void> {
    await this.options.tuner.start((reading, signal) => {
      if (!this.active || this.input !== "real" || !this.lessonId) return;
      const activity = courseLesson(this.lessonId).activities[this.stageIndex];
      if ((activity.kind === "rhythm" || activity.kind === "performance") && this.rhythmPhase === "recording") {
        if (this.onsetDetector.push(signal.rms, signal.at)) {
          this.strumTimes.push(signal.at);
          this.renderCurrentStage();
        }
      }
      if (!reading || (activity.kind !== "note-sequence" && activity.kind !== "compose" && activity.kind !== "chord")) return;
      if (activity.kind === "chord" && this.heardChords.length >= activity.chords.length) return;
      if (activity.kind === "note-sequence" && this.heardMidi.length >= activity.notes.length) return;
      const midi = Math.round(69 + 12 * Math.log2(reading.frequency / 440));
      if (activity.kind === "note-sequence" || activity.kind === "chord") {
        const targetMidi = activity.kind === "note-sequence"
          ? activity.notes[Math.min(this.heardMidi.length, activity.notes.length - 1)].midi
          : chordMidiNotes(activity.chords[Math.min(this.heardChords.length, activity.chords.length - 1)])[Math.min(this.heardMidi.length, 3)];
        const confirmation = this.melodyConfirmation.update(reading.frequency, 440 * 2 ** ((targetMidi - 69) / 12), signal.rms, signal.at);
        if (confirmation.accepted) {
          const targetIndex = this.heardMidi.length;
          this.heardMidi.push(targetMidi);
          if (activity.kind === "chord" && this.heardMidi.length === 4) {
            const chord = activity.chords[Math.min(this.heardChords.length, activity.chords.length - 1)];
            this.heardChords.push(chord);
            this.heardMidi = [];
            this.micStatus = this.heardChords.length < activity.chords.length
              ? `${chord} accepted ✓ — next, form ${activity.chords[this.heardChords.length]}.`
              : `${chord} accepted ✓ — chord sequence complete.`;
          } else if (activity.kind === "chord") {
            const chord = activity.chords[Math.min(this.heardChords.length, activity.chords.length - 1)];
            const nextMidi = chordMidiNotes(chord)[this.heardMidi.length];
            this.micStatus = `String ${4 - targetIndex} accepted ✓ — next, play string ${4 - this.heardMidi.length} ${noteName(nextMidi)}.`;
          } else {
            this.micStatus = `${noteName(targetMidi)} accepted ✓ — ${this.heardMidi.length < activity.notes.length ? `next, play ${activity.notes[this.heardMidi.length].western}` : "note path complete."}`;
          }
          const nextTarget = activity.kind === "note-sequence"
            ? activity.notes[Math.min(this.heardMidi.length, activity.notes.length - 1)]?.midi
            : this.heardChords.length < activity.chords.length
              ? chordMidiNotes(activity.chords[this.heardChords.length])[this.heardMidi.length]
              : undefined;
          if (nextTarget !== undefined) this.melodyConfirmation.nextExpected(440 * 2 ** ((nextTarget - 69) / 12));
          this.renderCurrentStage();
        } else if (confirmation.cents !== undefined && Math.abs(confirmation.cents) > 35) {
          this.micStatus = `Heard ${noteName(midi)}. Aim for ${noteName(targetMidi)} and let it ring clearly.`;
        }
        return;
      }
      if (midi === this.stableMidi) this.stableFrames += 1;
      else { this.stableMidi = midi; this.stableFrames = 1; }
      if (this.stableFrames >= 3 && signal.at - this.lastAcceptedPitchAt > 320) {
        this.heardMidi.push(midi);
        this.lastAcceptedPitchAt = signal.at;
        this.stableFrames = 0;
        this.renderCurrentStage();
      }
    }, (status: TunerStatus, message: string) => {
      this.micStatus = message;
      if (status === "error" || status === "listening") this.renderCurrentStage();
    });
    this.renderCurrentStage();
  }

  private stopMicrophone(): void {
    if (this.options.tuner.isListening) this.options.tuner.stop();
    this.micStatus = "Microphone is off.";
    this.onsetDetector.reset();
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
      if (recap) {
        const card = document.createElement("div");
        card.className = "course-astra-card";
        const badge = document.createElement("span");
        badge.textContent = "Powered by GPT-6 Astra";
        const correction = document.createElement("strong");
        correction.textContent = payload.decision?.correction ?? payload.error ?? "Coaching is unavailable.";
        card.append(badge, correction);
        if (payload.decision) {
          const evidence = document.createElement("p");
          evidence.textContent = payload.decision.evidence;
          card.append(evidence);
        }
        recap.append(card);
      }
    } catch {
      if (button) { button.disabled = false; button.textContent = "Retry Astra coaching"; }
    }
  }
}

function stageLabel(stage: string): string {
  return ({ see: "Learn", hear: "Listen", guess: "Find", play: "Try", check: "Check", recap: "Finish" } as Record<string, string>)[stage] ?? stage;
}

function stringNumber(index: number): number { return 4 - index; }

function noteName(midi: number): string {
  const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function sargamName(midi: number): string {
  return ({ 0: "Sa", 2: "Re", 4: "Ga", 5: "Ma", 7: "Pa", 9: "Dha", 11: "Ni" } as Record<number, string>)[((midi % 12) + 12) % 12] ?? "·";
}
