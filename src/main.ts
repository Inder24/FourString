import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces/wght.css";
import "./style.css";

import { AudioEngine } from "./audio";
import {
  appendFingerpickStep,
  FRET_COUNT,
  getCrossedStringIndices,
  getFretGridTemplate,
  getFretPosition,
  MAX_PATTERN_STEPS,
  UKULELE_STRINGS,
  velocityFromGesture,
  type FretPosition,
  type PlayMode,
  type StrumDirection,
} from "./music";
import { InstrumentState } from "./state";

const state = new InstrumentState();
const audio = new AudioEngine();
const fretButtons = new Map<string, HTMLButtonElement>();
const activeFretPointers = new Map<number, string>();
const strumPointers = new Map<
  number,
  {
    stringIndex: number;
    y: number;
    time: number;
    pressure: number;
    hasStrummed: boolean;
    sounded: Set<number>;
  }
>();
const PATTERN_STEP_MS = 380;
let patternSteps: FretPosition[] = [];
let patternArmed = false;
let patternPlaying = false;
let currentPatternIndex = -1;
let patternTimers: number[] = [];

const fretboard = byId<HTMLDivElement>("fretboard");
const fretLabels = byId<HTMLDivElement>("fret-labels");
const neckStrings = byId<HTMLDivElement>("neck-strings");
const bodyStrings = byId<HTMLDivElement>("body-strings");
const bodyStringNames = byId<HTMLDivElement>("body-string-names");
const positionMarkers = byId<HTMLDivElement>("position-markers");
const strumSurface = byId<HTMLElement>("strum-surface");
const instrumentFrame = byId<HTMLDivElement>("instrument-frame");
const audioGate = byId<HTMLDivElement>("audio-gate");
const enableButton = byId<HTMLButtonElement>("enable-button");
const gateTitle = byId<HTMLElement>("gate-title");
const gateMessage = byId<HTMLElement>("gate-message");
const audioStatus = byId<HTMLElement>("audio-status");
const audioStatusText = byId<HTMLElement>("audio-status-text");
const modeGuidance = byId<HTMLElement>("mode-guidance");
const lastNote = byId<HTMLElement>("last-note");
const readoutLabel = byId<HTMLElement>("readout-label");
const noteOrb = byId<HTMLElement>("note-orb");
const ripple = byId<HTMLElement>("ripple");
const modeStrum = byId<HTMLButtonElement>("mode-strum");
const modeExplore = byId<HTMLButtonElement>("mode-explore");
const clearButton = byId<HTMLButtonElement>("clear-button");
const muteButton = byId<HTMLButtonElement>("mute-button");
const volumeRange = byId<HTMLInputElement>("volume-range");
const inputHint = byId<HTMLElement>("input-hint");
const patternBuilder = byId<HTMLElement>("pattern-builder");
const patternArm = byId<HTMLButtonElement>("pattern-arm");
const patternTrack = byId<HTMLOListElement>("pattern-steps");
const patternEmpty = byId<HTMLElement>("pattern-empty");
const patternCount = byId<HTMLElement>("pattern-count");
const patternPlay = byId<HTMLButtonElement>("pattern-play");
const patternPlayText = byId<HTMLElement>("pattern-play-text");
const patternUndo = byId<HTMLButtonElement>("pattern-undo");
const patternClear = byId<HTMLButtonElement>("pattern-clear");
const patternStatus = byId<HTMLElement>("pattern-status");

const fretGridTemplate = getFretGridTemplate();
fretLabels.style.gridTemplateColumns = fretGridTemplate;

buildInstrument();
bindControls();
renderInstrumentState();
updateInputHint();

function buildInstrument(): void {
  const openLabel = document.createElement("span");
  openLabel.className = "fret-label is-open-label";
  openLabel.textContent = "OPEN";
  fretLabels.append(openLabel);

  for (let fret = 1; fret <= FRET_COUNT; fret += 1) {
    const label = document.createElement("span");
    label.className = "fret-label";
    label.textContent = String(fret).padStart(2, "0");
    fretLabels.append(label);
  }

  const cellGrid = document.createElement("div");
  cellGrid.className = "fret-cells";
  cellGrid.style.gridTemplateColumns = fretGridTemplate;

  UKULELE_STRINGS.forEach((string, stringIndex) => {
    const neckString = document.createElement("span");
    neckString.className = "instrument-string neck-string";
    neckString.dataset.string = String(stringIndex);
    neckString.style.setProperty("--string-row", String(stringIndex));
    neckStrings.append(neckString);

    const bodyString = document.createElement("span");
    bodyString.className = "instrument-string body-string";
    bodyString.dataset.string = String(stringIndex);
    bodyString.style.setProperty("--string-row", String(stringIndex));
    bodyStrings.append(bodyString);

    const bodyName = document.createElement("span");
    bodyName.className = "body-string-name";
    bodyName.style.setProperty("--string-row", String(stringIndex));
    bodyName.innerHTML = `<small>${physicalStringNumber(stringIndex)}</small><strong>${string.id}</strong>`;
    bodyStringNames.append(bodyName);

    for (let fret = 0; fret <= FRET_COUNT; fret += 1) {
      const position = getFretPosition(stringIndex, fret);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fret-cell";
      button.dataset.string = String(stringIndex);
      button.dataset.fret = String(fret);
      button.dataset.key = cellKey(stringIndex, fret);
      button.setAttribute("aria-pressed", "false");
      const accessibleLabel = `${string.id} string number ${physicalStringNumber(stringIndex)}, ${fret === 0 ? "open" : `fret ${fret}`}, ${position.noteName}`;
      button.dataset.baseLabel = accessibleLabel;
      button.setAttribute("aria-label", accessibleLabel);
      button.style.gridRow = String(stringIndex + 1);
      button.style.gridColumn = String(fret + 1);

      const label = document.createElement("span");
      label.className = "finger-label";
      label.textContent = position.noteName.replace(/\d+$/, "");
      button.append(label);

      if (fret === 0) {
        const stringName = document.createElement("span");
        stringName.className = "string-identity";
        stringName.innerHTML = `<small>${physicalStringNumber(stringIndex)}</small><strong>${string.id}</strong>`;
        button.prepend(stringName);
      }

      const sequenceBadge = document.createElement("span");
      sequenceBadge.className = "sequence-badge";
      sequenceBadge.setAttribute("aria-hidden", "true");
      button.append(sequenceBadge);

      fretButtons.set(cellKey(stringIndex, fret), button);
      cellGrid.append(button);
    }
  });

  fretboard.append(cellGrid);
  positionMarkers.style.gridTemplateColumns = fretGridTemplate;
  [3, 5, 7, 10].forEach((fret) => appendMarker(fret, 3));
  appendMarker(12, 2);
  appendMarker(12, 4);
}

function appendMarker(fret: number, row: number): void {
  const marker = document.createElement("span");
  marker.className = "position-marker";
  marker.style.gridColumn = String(fret + 1);
  marker.style.gridRow = String(row);
  positionMarkers.append(marker);
}

function bindControls(): void {
  enableButton.addEventListener("click", initializeAudio);
  modeStrum.addEventListener("click", () => setMode("strum"));
  modeExplore.addEventListener("click", () => setMode("explore"));

  patternArm.addEventListener("click", () => {
    stopPatternPlayback();
    patternArmed = !patternArmed;
    patternStatus.textContent = patternArmed
      ? "Add notes is on. Tap frets to build your pattern."
      : "Add notes is off. Fret taps will only preview sound.";
    renderPattern();
  });

  patternPlay.addEventListener("click", () => {
    if (patternPlaying) stopPatternPlayback("Pattern stopped.");
    else startPatternPlayback();
  });

  patternUndo.addEventListener("click", () => {
    stopPatternPlayback();
    const removed = patternSteps.pop();
    patternStatus.textContent = removed
      ? `Removed ${removed.noteName} from the end of the pattern.`
      : "The pattern is already empty.";
    renderPattern();
  });

  patternClear.addEventListener("click", () => {
    stopPatternPlayback();
    patternSteps = [];
    patternStatus.textContent = "Fingerpicking pattern cleared.";
    renderPattern();
  });

  clearButton.addEventListener("click", () => {
    state.clearAll();
    renderInstrumentState();
    readoutLabel.textContent = "Ready";
    lastNote.textContent = "Shape cleared — open strings ready";
    noteOrb.textContent = "G";
  });

  volumeRange.addEventListener("input", () => {
    const volume = Number(volumeRange.value) / 100;
    state.setVolume(volume);
    audio.setVolume(volume);
    volumeRange.style.setProperty("--range-progress", `${volume * 100}%`);
  });
  volumeRange.style.setProperty("--range-progress", `${state.volume * 100}%`);

  muteButton.addEventListener("click", () => {
    state.setMuted(!state.muted);
    audio.setMuted(state.muted);
    muteButton.setAttribute("aria-pressed", String(state.muted));
    muteButton.setAttribute("aria-label", state.muted ? "Unmute sound" : "Mute sound");
    muteButton.classList.toggle("is-muted", state.muted);
    setAudioStatus(state.muted ? "muted" : "ready", state.muted ? "Muted" : "Sound ready");
  });

  fretboard.addEventListener("pointerdown", handleFretPointerDown);
  fretboard.addEventListener("pointermove", handleFretPointerMove);
  fretboard.addEventListener("pointerup", handleFretPointerEnd);
  fretboard.addEventListener("pointercancel", handleFretPointerEnd);
  fretboard.addEventListener("lostpointercapture", handleFretPointerEnd);
  fretboard.addEventListener("contextmenu", (event) => event.preventDefault());

  strumSurface.addEventListener("pointerdown", handleStrumPointerDown);
  strumSurface.addEventListener("pointermove", handleStrumPointerMove);
  strumSurface.addEventListener("pointerup", handleStrumPointerUp);
  strumSurface.addEventListener("pointercancel", handleStrumPointerCancel);
  strumSurface.addEventListener("lostpointercapture", handleStrumPointerCancel);
  strumSurface.addEventListener("contextmenu", (event) => event.preventDefault());

  document.addEventListener("keydown", handleKeyboard);
  window.addEventListener("blur", clearHeldPointers);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") clearHeldPointers();
  });
  window.addEventListener("beforeunload", () => audio.dispose());
}

async function initializeAudio(): Promise<void> {
  enableButton.disabled = true;
  enableButton.classList.add("is-loading");
  enableButton.querySelector("span")!.textContent = "Loading instrument…";
  gateTitle.textContent = "Tuning the strings…";
  gateMessage.textContent = "Loading thirteen lossless notes into memory.";
  setAudioStatus("loading", "Loading samples");

  try {
    await audio.initialize();
    audio.setVolume(state.volume);
    instrumentFrame.dataset.audioReady = "true";
    audioGate.setAttribute("aria-hidden", "true");
    setAudioStatus("ready", "Sound ready");
    window.setTimeout(() => audioGate.classList.add("is-hidden"), 280);
    readoutLabel.textContent = "Ready";
    lastNote.textContent = "Open strings ready — give them a strum";
    noteOrb.textContent = "G";
    strumSurface.focus({ preventScroll: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The samples could not be loaded.";
    enableButton.disabled = false;
    enableButton.classList.remove("is-loading");
    enableButton.querySelector("span")!.textContent = "Try again";
    gateTitle.textContent = "The strings did not load.";
    gateMessage.textContent = `${message} Check the local server and retry.`;
    setAudioStatus("error", "Audio error");
  }
}

function setMode(mode: PlayMode): void {
  stopPatternPlayback();
  state.setMode(mode);
  activeFretPointers.clear();
  modeStrum.classList.toggle("is-selected", mode === "strum");
  modeExplore.classList.toggle("is-selected", mode === "explore");
  modeStrum.setAttribute("aria-pressed", String(mode === "strum"));
  modeExplore.setAttribute("aria-pressed", String(mode === "explore"));
  modeGuidance.textContent =
    mode === "strum"
      ? "Tap the body for all four together, or sweep to strum."
      : "Tap any fret to hear it—or build a fingerpicking pattern.";
  instrumentFrame.dataset.mode = mode;
  patternBuilder.hidden = mode !== "explore";
  if (mode !== "explore") patternArmed = false;
  updateInputHint();
  renderPattern();
  renderInstrumentState();
}

function handleFretPointerDown(event: PointerEvent): void {
  if (!audio.isReady) return;
  const cell = getFretCell(event.target);
  if (!cell) return;
  event.preventDefault();
  const position = cellPosition(cell);
  state.focusedCell = position;
  cell.focus({ preventScroll: true });

  if (event.pointerType === "mouse") {
    if (state.mode === "strum") {
      state.toggleLatchedFret(position.stringIndex, position.fret);
    } else {
      playPosition(position.stringIndex, position.fret, 0.7);
    }
  } else {
    state.holdFret(event.pointerId, position.stringIndex, position.fret);
    activeFretPointers.set(event.pointerId, cell.dataset.key!);
    tryCapturePointer(fretboard, event.pointerId);
    if (state.mode === "explore") {
      playPosition(position.stringIndex, position.fret, velocityFromGesture(0, 0, event.pressure));
    }
  }
  renderInstrumentState();
}

function handleFretPointerMove(event: PointerEvent): void {
  if (event.pointerType === "mouse" || !activeFretPointers.has(event.pointerId)) return;
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const cell = getFretCell(hit);
  if (!cell || cell.dataset.key === activeFretPointers.get(event.pointerId)) return;

  const position = cellPosition(cell);
  activeFretPointers.set(event.pointerId, cell.dataset.key!);
  state.holdFret(event.pointerId, position.stringIndex, position.fret);
  if (state.mode === "explore") {
    playPosition(position.stringIndex, position.fret, velocityFromGesture(0, 0, event.pressure));
  }
  renderInstrumentState();
}

function handleFretPointerEnd(event: PointerEvent): void {
  if (!activeFretPointers.has(event.pointerId) && !state.heldFrets.has(event.pointerId)) return;
  activeFretPointers.delete(event.pointerId);
  state.releasePointer(event.pointerId);
  renderInstrumentState();
}

function handleStrumPointerDown(event: PointerEvent): void {
  if (!audio.isReady) return;
  event.preventDefault();
  tryCapturePointer(strumSurface, event.pointerId);
  const stringIndex = stringIndexFromClientY(event.clientY);
  strumPointers.set(event.pointerId, {
    stringIndex,
    y: event.clientY,
    time: event.timeStamp,
    pressure: event.pressure,
    hasStrummed: false,
    sounded: new Set<number>(),
  });
}

function handleStrumPointerMove(event: PointerEvent): void {
  const trace = strumPointers.get(event.pointerId);
  if (!trace) return;
  event.preventDefault();
  const nextIndex = stringIndexFromClientY(event.clientY);
  if (nextIndex === trace.stringIndex) return;

  const velocity = velocityFromGesture(
    Math.abs(event.clientY - trace.y),
    Math.max(1, event.timeStamp - trace.time),
    event.pressure,
  );
  const direction: StrumDirection = nextIndex > trace.stringIndex ? "down" : "up";
  const crossed = getCrossedStringIndices(trace.stringIndex, nextIndex);
  const playedIndices = trace.hasStrummed ? crossed : [trace.stringIndex, ...crossed];
  playSweepStrings(playedIndices, velocity);
  playedIndices.forEach((stringIndex) => trace.sounded.add(stringIndex));
  trace.hasStrummed = true;
  trace.stringIndex = nextIndex;
  trace.y = event.clientY;
  trace.time = event.timeStamp;
  showShapeReadout("Last strum", direction === "down" ? "↓" : "↑", [...trace.sounded]);
}

function handleStrumPointerUp(event: PointerEvent): void {
  const trace = strumPointers.get(event.pointerId);
  strumPointers.delete(event.pointerId);
  if (!trace || trace.hasStrummed) return;
  const pressure = Math.max(trace.pressure, event.pressure);
  playChordTogether(pressure > 0 ? velocityFromGesture(0, 0, pressure) : 0.72);
}

function handleStrumPointerCancel(event: PointerEvent): void {
  strumPointers.delete(event.pointerId);
}

function handleKeyboard(event: KeyboardEvent): void {
  if (!audio.isReady || isFormControl(event.target)) return;

  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
    const next = state.moveFocus(
      event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0,
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0,
    );
    focusFretCell(next.stringIndex, next.fret);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const { stringIndex, fret } = state.focusedCell;
    if (state.mode === "strum") state.toggleLatchedFret(stringIndex, fret);
    else playPosition(stringIndex, fret, 0.7);
    renderInstrumentState();
    return;
  }

  if (/^[1-4]$/.test(event.key)) {
    event.preventDefault();
    playString(UKULELE_STRINGS.length - Number(event.key), 0.72);
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (event.shiftKey) strumAll("up");
    else playChordTogether();
    return;
  }

  if (event.key === "Escape") {
    state.clearAll();
    renderInstrumentState();
    readoutLabel.textContent = "Ready";
    lastNote.textContent = "Shape cleared — open strings ready";
  }
}

function playPosition(stringIndex: number, fret: number, velocity: number, record = true): void {
  const position = getFretPosition(stringIndex, fret);
  audio.pluckString(stringIndex, position.midi, velocity);
  if (record) recordPatternStep(position);
  const cell = fretButtons.get(cellKey(stringIndex, fret));
  if (cell) {
    cell.classList.remove("is-previewing");
    void cell.offsetWidth;
    cell.classList.add("is-previewing");
    window.setTimeout(() => cell.classList.remove("is-previewing"), 260);
  }
  showPluck(stringIndex, position.noteName, fret);
}

function playString(stringIndex: number, velocity: number): void {
  const fret = state.getEffectiveFret(stringIndex);
  const position = getFretPosition(stringIndex, fret);
  audio.pluckString(stringIndex, position.midi, velocity);
  showPluck(stringIndex, position.noteName, fret);
}

function strumAll(direction: StrumDirection): void {
  const indices = direction === "down" ? [0, 1, 2, 3] : [3, 2, 1, 0];
  const positions = getCurrentShape();
  audio.strum(positions.map((position) => position.midi), direction, 0.74);
  indices.forEach((stringIndex, order) => {
    window.setTimeout(() => showStringFeedback(stringIndex), order * 24);
  });
  showShapeReadout("Last strum", direction === "down" ? "↓" : "↑", indices);
}

function playChordTogether(velocity = 0.72): void {
  const positions = getCurrentShape();
  audio.playTogether(positions.map((position) => position.midi), velocity);
  positions.forEach((position) => showStringFeedback(position.stringIndex));
  showShapeReadout("Last chord", "4", positions.map((position) => position.stringIndex));
}

function playSweepStrings(indices: readonly number[], velocity: number): void {
  indices.forEach((stringIndex, order) => {
    const fret = state.getEffectiveFret(stringIndex);
    const position = getFretPosition(stringIndex, fret);
    audio.pluckString(stringIndex, position.midi, velocity, order * 0.012);
    window.setTimeout(() => showStringFeedback(stringIndex), order * 12);
  });
}

function getCurrentShape(): FretPosition[] {
  return UKULELE_STRINGS.map((_, stringIndex) =>
    getFretPosition(stringIndex, state.getEffectiveFret(stringIndex)),
  );
}

function showPluck(stringIndex: number, noteName: string, fret: number): void {
  const pitch = noteName.replace(/\d+$/, "");
  readoutLabel.textContent = "Last pluck";
  noteOrb.textContent = pitch;
  lastNote.textContent = `${noteName} · ${UKULELE_STRINGS[stringIndex].id} string · ${fret === 0 ? "open" : `fret ${fret}`}`;

  showStringFeedback(stringIndex);
  showRipple();
}

function showShapeReadout(label: string, orb: string, indices: readonly number[]): void {
  const canonicalIndices = [...new Set(indices)].sort((a, b) => a - b);
  const positions = canonicalIndices.map((stringIndex) =>
    getFretPosition(stringIndex, state.getEffectiveFret(stringIndex)),
  );
  readoutLabel.textContent = label;
  noteOrb.textContent = orb;
  lastNote.textContent =
    canonicalIndices.length === UKULELE_STRINGS.length
      ? `Frets ${positions.map((position) => position.fret).join("–")} · ${positions.map((position) => position.noteName).join(" · ")}`
      : `${positions.map((position) => `${physicalStringNumber(position.stringIndex)}·${position.stringId}`).join(" · ")} · ${positions.map((position) => position.noteName).join(" · ")}`;
  showRipple();
}

function showStringFeedback(stringIndex: number): void {
  document.querySelectorAll<HTMLElement>(`.instrument-string[data-string="${stringIndex}"]`).forEach((string) => {
    string.classList.remove("is-ringing");
    void string.offsetWidth;
    string.classList.add("is-ringing");
  });
}

function showRipple(): void {
  ripple.classList.remove("is-active");
  void ripple.offsetWidth;
  ripple.classList.add("is-active");
}

function renderInstrumentState(): void {
  const patternCounts = getPatternCounts();
  for (const [key, button] of fretButtons) {
    const position = cellPosition(button);
    const latched = position.fret > 0 && state.latchedFrets[position.stringIndex] === position.fret;
    const held = [...state.heldFrets.values()].some(
      (value) => value.stringIndex === position.stringIndex && value.fret === position.fret,
    );
    const effective = state.getEffectiveFret(position.stringIndex) === position.fret;
    button.classList.toggle("is-latched", latched);
    button.classList.toggle("is-held", held);
    button.classList.toggle("is-effective", effective);
    const selectedCount = patternCounts.get(key) ?? 0;
    button.classList.toggle("is-sequenced", selectedCount > 0);
    button.classList.toggle(
      "is-pattern-current",
      currentPatternIndex >= 0 && cellKey(patternSteps[currentPatternIndex].stringIndex, patternSteps[currentPatternIndex].fret) === key,
    );
    button.setAttribute("aria-pressed", String(latched || held));
    button.setAttribute(
      "aria-label",
      `${button.dataset.baseLabel}${selectedCount > 0 ? `, selected ${selectedCount} ${selectedCount === 1 ? "time" : "times"} in pattern` : ""}`,
    );
    const badge = button.querySelector<HTMLElement>(".sequence-badge");
    if (badge) badge.textContent = selectedCount > 1 ? `×${selectedCount}` : selectedCount === 1 ? "1" : "";
    button.dataset.key = key;
  }
}

function recordPatternStep(position: FretPosition): void {
  if (!patternArmed || state.mode !== "explore" || patternPlaying) return;
  const nextSteps = appendFingerpickStep(patternSteps, position);
  if (nextSteps.length === patternSteps.length) {
    patternStatus.textContent = "Pattern full. Play it, undo a note, or clear it to continue.";
    return;
  }
  patternSteps = nextSteps;
  patternStatus.textContent = `Step ${patternSteps.length}: ${position.noteName} on string ${physicalStringNumber(position.stringIndex)} ${position.stringId}.`;
  renderPattern();
}

function renderPattern(): void {
  patternArm.classList.toggle("is-armed", patternArmed);
  patternArm.setAttribute("aria-pressed", String(patternArmed));
  patternArm.disabled = patternPlaying;
  patternBuilder.dataset.full = String(patternSteps.length >= MAX_PATTERN_STEPS);
  patternBuilder.dataset.playing = String(patternPlaying);
  patternCount.textContent = `${patternSteps.length} / ${MAX_PATTERN_STEPS}`;
  patternEmpty.hidden = patternSteps.length > 0;
  patternPlay.disabled = patternSteps.length === 0;
  patternPlayText.textContent = patternPlaying ? "Stop" : "Play";
  patternPlay.setAttribute("aria-label", patternPlaying ? "Stop fingerpicking pattern" : "Play fingerpicking pattern");
  patternUndo.disabled = patternSteps.length === 0 || patternPlaying;
  patternClear.disabled = patternSteps.length === 0 || patternPlaying;

  patternTrack.replaceChildren(
    ...patternSteps.map((step, index) => {
      const item = document.createElement("li");
      item.className = "pattern-step";
      item.classList.toggle("is-current", index === currentPatternIndex);
      item.dataset.index = String(index);
      item.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><strong>${physicalStringNumber(step.stringIndex)}·${step.stringId}</strong><small>${step.fret === 0 ? "open" : `fret ${step.fret}`} · ${step.noteName}</small>`;
      return item;
    }),
  );
  renderInstrumentState();
}

function startPatternPlayback(): void {
  if (patternSteps.length === 0 || !audio.isReady) return;
  stopPatternPlayback();
  patternPlaying = true;
  patternArmed = false;
  currentPatternIndex = -1;
  patternStatus.textContent = `Playing ${patternSteps.length} note${patternSteps.length === 1 ? "" : "s"}.`;
  renderPattern();

  patternSteps.forEach((step, index) => {
    patternTimers.push(
      window.setTimeout(() => {
        currentPatternIndex = index;
        playPosition(step.stringIndex, step.fret, 0.72, false);
        renderPattern();
      }, index * PATTERN_STEP_MS),
    );
  });

  patternTimers.push(
    window.setTimeout(() => {
      patternPlaying = false;
      currentPatternIndex = -1;
      patternTimers = [];
      patternStatus.textContent = "Pattern finished.";
      renderPattern();
    }, patternSteps.length * PATTERN_STEP_MS),
  );
}

function stopPatternPlayback(message?: string): void {
  patternTimers.forEach((timer) => window.clearTimeout(timer));
  patternTimers = [];
  const wasPlaying = patternPlaying;
  patternPlaying = false;
  currentPatternIndex = -1;
  if (message && wasPlaying) patternStatus.textContent = message;
  if (wasPlaying) renderPattern();
}

function getPatternCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  patternSteps.forEach((step) => {
    const key = cellKey(step.stringIndex, step.fret);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function clearHeldPointers(): void {
  activeFretPointers.clear();
  strumPointers.clear();
  state.clearHeldFrets();
  renderInstrumentState();
}

function focusFretCell(stringIndex: number, fret: number): void {
  const button = fretButtons.get(cellKey(stringIndex, fret));
  button?.focus({ preventScroll: true });
  button?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

function stringIndexFromClientY(clientY: number): number {
  const rect = strumSurface.getBoundingClientRect();
  const ratio = Math.min(0.999, Math.max(0, (clientY - rect.top) / rect.height));
  return Math.floor(ratio * UKULELE_STRINGS.length);
}

function setAudioStatus(status: "idle" | "loading" | "ready" | "muted" | "error", text: string): void {
  audioStatus.dataset.status = status;
  audioStatusText.textContent = text;
}

function updateInputHint(): void {
  const hasTouch = navigator.maxTouchPoints > 0;
  if (state.mode === "explore") {
    inputHint.innerHTML = `<span class="input-icon" aria-hidden="true">${hasTouch ? handIcon() : pointerIcon()}</span><span><strong>Explore:</strong> tap frets to hear them; Add notes builds the pattern</span>`;
    return;
  }
  inputHint.innerHTML = hasTouch
    ? `<span class="input-icon" aria-hidden="true">${handIcon()}</span><span><strong>Body:</strong> tap for all four together; sweep to strum</span>`
    : `<span class="input-icon" aria-hidden="true">${pointerIcon()}</span><span><strong>Body:</strong> click for all four together; drag to strum</span>`;
}

function handIcon(): string {
  return '<svg viewBox="0 0 24 24"><path d="M8.5 4.5v9.25M12 3.5v10.25M15.5 5v8.75M7 13.75c-1.5 0-2.5 1-2.5 2.25s1 2.25 2.5 2.25h8.5c2.2 0 4-1.8 4-4v-2.5"/></svg>';
}

function pointerIcon(): string {
  return '<svg viewBox="0 0 24 24"><path d="m7 4 10 9-5 .5L9.5 18 7 4Z"/></svg>';
}

function getFretCell(target: EventTarget | null): HTMLButtonElement | null {
  return target instanceof Element ? target.closest<HTMLButtonElement>(".fret-cell") : null;
}

function cellPosition(cell: HTMLButtonElement): { stringIndex: number; fret: number } {
  return { stringIndex: Number(cell.dataset.string), fret: Number(cell.dataset.fret) };
}

function cellKey(stringIndex: number, fret: number): string {
  return `${stringIndex}:${fret}`;
}

function physicalStringNumber(stringIndex: number): number {
  return UKULELE_STRINGS.length - stringIndex;
}

function isFormControl(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, summary, .control-ribbon button, .pattern-builder button, .audio-gate"));
}

function tryCapturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Synthetic test events are not registered as active browser pointers.
  }
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}
