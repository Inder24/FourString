import { AttemptRecorder } from './attempt-recorder';
import { CHECKABLE_CHORDS, classifyChordNotes, type CheckableChord } from './chord-check';
import { LESSON_CHORDS, chordMidiNotes } from './lesson';
import { midiToNoteName, UKULELE_STRINGS } from './music';
import { centsBetween, type PitchReading, TunerEngine } from './tuner';

const DISPLAY_NAMES: Record<CheckableChord, string> = { C: 'C major', Am: 'A minor', F: 'F major', G: 'G major', G7: 'G dominant seventh' };

export class ChordCheckPanel {
  private selected: CheckableChord = 'C';
  private generation = 0;
  private busy = false;
  private singleStringIndex = -1;
  private stableFrames = 0;
  private lastSeenAt = 0;
  private readonly recorder = new AttemptRecorder();

  constructor(private readonly root: HTMLElement, private readonly tuner: TunerEngine) {
    for (const chord of CHECKABLE_CHORDS) {
      this.element<HTMLButtonElement>(`[data-check-chord="${chord}"]`).addEventListener('click', () => {
        if (this.busy) return;
        this.selected = chord;
        this.renderSelection();
        this.clearResult();
      });
    }
    this.element<HTMLButtonElement>('#chord-check-start').addEventListener('click', () => void this.check());
    this.element<HTMLButtonElement>('#chord-check-single').addEventListener('click', () => void this.checkStrings());
    this.element<HTMLButtonElement>('#chord-check-cancel').addEventListener('click', () => this.leave());
    this.renderSelection();
  }

  leave(): void {
    this.generation++;
    this.busy = false;
    this.singleStringIndex = -1;
    this.recorder.discard();
    this.tuner.stop();
    this.element<HTMLButtonElement>('#chord-check-start').disabled = false;
    this.element('#chord-check-cancel').hidden = true;
    this.setStatus('Ready when you are. Choose a chord and strum once.');
    this.element('#chord-check-countdown').textContent = '';
  }

  private element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const found = this.root.querySelector<T>(selector);
    if (!found) throw new Error(`Missing chord-check control ${selector}`);
    return found;
  }

  private setStatus(message: string): void { this.element('#chord-check-status').textContent = message; }

  private clearResult(): void {
    this.element('#chord-check-result').hidden = true;
    this.element('#chord-check-single').hidden = true;
    this.setStatus('Ready when you are. Choose a chord and strum once.');
  }

  private renderSelection(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-check-chord]').forEach((button) => {
      const selected = button.dataset.checkChord === this.selected;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    this.element('#chord-check-target').textContent = DISPLAY_NAMES[this.selected];
    this.element('#chord-check-frets').textContent = `G C E A · ${LESSON_CHORDS[this.selected].frets.join(' · ')}`;
    const diagram = this.element('#chord-check-diagram');
    diagram.replaceChildren(...UKULELE_STRINGS.map((string, index) => {
      const fret = LESSON_CHORDS[this.selected].frets[index];
      const row = document.createElement('div');
      row.className = 'chord-check-string';
      row.innerHTML = `<span>${string.id}</span><i aria-hidden="true"></i><strong>${fret || '○'}</strong><small>${midiToNoteName(string.openMidi + fret)}</small>`;
      return row;
    }));
  }

  private async check(): Promise<void> {
    if (this.busy) return;
    this.clearResult();
    if (!this.recorder.isSupported) {
      this.setStatus('This browser cannot capture a short take. Try a current Chrome, Firefox, or Safari.');
      this.element('#chord-check-single').hidden = false;
      return;
    }
    this.busy = true;
    this.element('#chord-check-cancel').hidden = false;
    const run = ++this.generation;
    const startButton = this.element<HTMLButtonElement>('#chord-check-start');
    startButton.disabled = true;
    this.setStatus('Requesting microphone access…');
    let microphoneError = '';
    await this.tuner.start(() => {}, (status, message) => {
      if (status === 'error') microphoneError = message;
    });
    if (run !== this.generation) return;
    if (!this.tuner.mediaStream) {
      this.setStatus(microphoneError || 'Microphone unavailable. Check browser permission and try again.');
      this.finish(run);
      return;
    }
    try {
      for (const count of [3, 2, 1]) {
        if (run !== this.generation) return;
        this.element('#chord-check-countdown').textContent = String(count);
        this.setStatus(`Get ${DISPLAY_NAMES[this.selected]} ready. Strum after 1.`);
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (run !== this.generation) return;
      this.element('#chord-check-countdown').textContent = 'Play';
      this.setStatus('Strum once, then let the chord ring.');
      if (!this.recorder.start(this.tuner.mediaStream!)) throw new Error('Recording could not start on this browser.');
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      if (run !== this.generation) return;
      const blob = await this.recorder.stop();
      this.tuner.stop();
      if (!blob?.size) throw new Error('No audio was captured. Try again closer to the microphone.');
      this.element('#chord-check-countdown').textContent = '♪';
      this.setStatus('Checking the notes on this device…');
      const { transcribeChordRecording } = await import('./chord-model');
      const notes = await transcribeChordRecording(blob, (progress) => {
        if (run === this.generation) this.setStatus(`Checking notes on this device… ${Math.round(progress * 100)}%`);
      });
      if (run !== this.generation) return;
      this.showResult(classifyChordNotes(this.selected, notes));
    } catch (error) {
      if (run !== this.generation) return;
      this.setStatus(error instanceof Error ? `${error.message} You can retry or pick strings individually.` : 'The model could not check this take. Try again.');
      this.element('#chord-check-single').hidden = false;
    } finally {
      this.finish(run);
    }
  }

  private finish(run: number): void {
    if (run !== this.generation) return;
    this.tuner.stop();
    this.busy = false;
    this.element<HTMLButtonElement>('#chord-check-start').disabled = false;
    this.element('#chord-check-cancel').hidden = true;
    this.element('#chord-check-countdown').textContent = '';
  }

  private showResult(result: ReturnType<typeof classifyChordNotes>): void {
    const panel = this.element('#chord-check-result');
    panel.hidden = false;
    panel.dataset.outcome = result.status;
    const title = result.status === 'match' ? `${DISPLAY_NAMES[this.selected]} sounds likely ✓`
      : result.status === 'different' ? `That sounds closer to ${DISPLAY_NAMES[result.likelyChord!]}`
        : 'Not enough to call this chord yet';
    this.element('#chord-check-result-title').textContent = title;
    this.element('#chord-check-heard').textContent = result.heardNotes.length ? result.heardNotes.join(' · ') : 'No sustained notes found';
    this.element('#chord-check-expected').textContent = result.expectedNotes.join(' · ');
    this.element('#chord-check-result-hint').textContent = result.status === 'match'
      ? 'Those notes fit. This checks sound, not the fingers or frets you used.'
      : result.status === 'different'
        ? `The expected ${this.selected} notes were ${result.expectedNotes.join(', ')}. Check your shape and strum again.`
        : `Only ${result.matchCount} of ${result.expectedNotes.length} expected note names came through clearly. Try a slow, even strum or check each string.`;
    this.element('#chord-check-single').hidden = result.status === 'match';
    this.setStatus('Check complete. You can try another strum or verify each string.');
  }

  private async checkStrings(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.element('#chord-check-cancel').hidden = false;
    const run = ++this.generation;
    this.singleStringIndex = 0;
    this.stableFrames = 0;
    this.lastSeenAt = 0;
    this.element<HTMLButtonElement>('#chord-check-start').disabled = true;
    this.element('#chord-check-single').hidden = true;
    this.element('#chord-check-result').hidden = true;
    this.setStatus(`Pick string 4 · G at fret ${LESSON_CHORDS[this.selected].frets[0]}, once. Let it ring.`);
    let microphoneError = '';
    await this.tuner.start((reading, signal) => this.onSingleString(reading, signal.at), (status, message) => {
      if (status === 'error') microphoneError = message;
    });
    if (run !== this.generation) return;
    if (!this.tuner.mediaStream) {
      this.setStatus(microphoneError || 'Microphone unavailable. Try again.');
      this.busy = false;
      this.element('#chord-check-cancel').hidden = true;
      this.singleStringIndex = -1;
      this.element<HTMLButtonElement>('#chord-check-start').disabled = false;
      this.element('#chord-check-single').hidden = false;
    }
  }

  private onSingleString(reading: PitchReading | null, at: number): void {
    const index = this.singleStringIndex;
    if (index < 0) return;
    if (!reading) {
      if (at - this.lastSeenAt > 500) this.stableFrames = 0;
      return;
    }
    const expectedMidi = chordMidiNotes(this.selected)[index];
    const expectedHz = 440 * 2 ** ((expectedMidi - 69) / 12);
    const cents = Math.abs(centsBetween(reading.frequency, expectedHz));
    if (cents <= 45 && reading.confidence >= 0.65) {
      this.stableFrames++;
      this.lastSeenAt = at;
    } else {
      this.stableFrames = 0;
      this.setStatus(`String ${4 - index} should sound ${midiToNoteName(expectedMidi)}. Heard about ${Math.round(reading.frequency)} Hz; adjust and pluck once.`);
    }
    if (this.stableFrames < 4) return;
    this.stableFrames = 0;
    this.singleStringIndex++;
    if (this.singleStringIndex >= 4) {
      this.singleStringIndex = -1;
      this.tuner.stop();
      this.busy = false;
      this.element('#chord-check-cancel').hidden = true;
      this.element<HTMLButtonElement>('#chord-check-start').disabled = false;
      this.setStatus('All four string pitches matched ✓ This still cannot verify finger placement.');
      this.element('#chord-check-result').hidden = false;
      this.element('#chord-check-result-title').textContent = 'Each string sounded right ✓';
      this.element('#chord-check-heard').textContent = chordMidiNotes(this.selected).map(midiToNoteName).join(' · ');
      this.element('#chord-check-expected').textContent = chordMidiNotes(this.selected).map(midiToNoteName).join(' · ');
      this.element('#chord-check-result-hint').textContent = 'Single-string pitches matched the chosen shape. Now strum them together.';
      return;
    }
    const next = this.singleStringIndex;
    this.setStatus(`${UKULELE_STRINGS[index].id} accepted ✓ — now pick string ${4 - next} · ${UKULELE_STRINGS[next].id} at fret ${LESSON_CHORDS[this.selected].frets[next]}.`);
  }
}
