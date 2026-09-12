import { GUIDE_STRING_Y, VISUAL_CUES, type StrummingFrame, type VisualCue } from "./strumming-motion";
import "./strumming-guide.css";
import { LESSON_CHORDS, type ChordName } from "./lesson";

/** A local, constrained teaching illustration—not generated video or hand tracking. */
export class StrummingGuide {
  private downOnly = true;
  private currentChord = "";
  private readonly hand: SVGGElement;
  private readonly lines: SVGLineElement[];
  private readonly action: HTMLElement;
  private readonly count: HTMLElement;
  private readonly cue: HTMLElement;
  private readonly correction: HTMLElement;
  private readonly correctionLabel: HTMLElement;
  private readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <div class="ai-guide-correction" hidden><span class="ai-powered-by ai-powered-by--on-dark">Powered by GPT-6 Astra</span><span data-guide-correction-label>Astra’s one correction</span><strong data-guide-correction></strong></div>
      <div class="ai-guide-heading"><span data-guide-chord>C major · 0 0 0 3</span><span data-guide-next></span><span data-guide-cycle>Watch the wrist</span></div>
      <svg class="ai-guide-uke" viewBox="0 0 620 256" role="img" aria-label="C major ukulele: open G, C and E strings; A string fret 3. Down crosses G C E A; up crosses A E C G. Illustrated player's view.">
        <defs><linearGradient id="ai-koa-grain" x2="1" y2="0.35"><stop stop-color="#b87b46"/><stop offset=".48" stop-color="#e1af72"/><stop offset="1" stop-color="#af713d"/></linearGradient></defs>
        <path class="ai-guide-body" d="M361 74C329 52 344 17 384 16C415 14 426 45 450 41C477 35 488 9 523 16C597 29 611 212 535 236C490 250 478 216 450 213C421 211 419 240 385 239C344 238 329 205 361 180C391 156 391 98 361 74Z"/>
        <path d="M373 62Q392 121 372 192M555 49Q528 127 555 213M568 61Q544 127 568 201" fill="none" stroke="#6c452b" opacity=".14"/>
        <circle cx="451" cy="128" r="49" fill="#d4af79" stroke="#75482d" stroke-width="3"/><circle cx="451" cy="128" r="42" fill="#271b19"/><circle cx="451" cy="128" r="38" fill="none" stroke="#a27a51" stroke-width="1"/>
        <rect x="78" y="82" width="302" height="92" rx="5" fill="#2c201e" stroke="#b49a79" stroke-width="2"/>
        <rect x="80" y="83" width="7" height="90" rx="2" fill="#efe0be"/>
        <g stroke="#b5a89b" stroke-width="3"><path d="M166 84V172M241 84V172M312 84V172M375 84V172"/></g>
        <g fill="#dcc5a1" font-size="12" text-anchor="middle"><text x="126" y="68">1</text><text x="205" y="68">2</text><text x="278" y="68">3</text><text x="345" y="68">4</text></g>
        <rect x="542" y="88" width="15" height="80" rx="4" fill="#453029"/><rect x="543" y="94" width="4" height="68" rx="1" fill="#efe0be"/>
        ${GUIDE_STRING_Y.map((y, index) => `<text x="48" y="${y + 5}" class="ai-guide-string-name">${["G", "C", "E", "A"][index]}</text><line data-guide-string="${index}" x1="84" y1="${y}" x2="550" y2="${y}" class="ai-guide-string"/>${index < 3 ? `<circle cx="68" cy="${y}" r="4" fill="none" stroke="#efe0be"/>` : ""}`).join("")}
        <g data-guide-shape></g>
        <g data-guide-hand class="ai-guide-hand" transform="translate(451 78)">
          <path d="M0 0C-4-1-6-6-4-11L2-31C-3-29-8-26-12-31C-15-35-12-40-7-43L9-51C15-56 24-56 32-50L47-68L71-51L48-24C43-12 31-6 22-9L13-19L7-3C6 1 2 2 0 0Z" fill="#efd6b5" stroke="#604335" stroke-width="2" stroke-linejoin="round"/>
          <path d="M7-40Q16-43 22-34L29-23M17-47Q27-47 32-39L38-29M4-25L12-31" fill="none" stroke="#af896a" stroke-width="1.5"/>
          <path d="m43-66 19-23 28 22-17 22Z" fill="#78877a" stroke="#cad0b1" stroke-width="2"/>
          <circle r="4" fill="#ee8d76"/>
        </g>
        <text data-guide-frets x="84" y="212" fill="#c6b5a4" font-size="11">Fret 3 · ring finger on A</text>
      </svg>
      <div class="ai-guide-caption"><strong data-guide-action>↓ Play strings</strong><span data-guide-key>Down-strums only · return without touching strings</span></div>
      <p class="ai-guide-cue" data-guide-cue>${VISUAL_CUES["even-swing"]}</p>
      <span class="ai-guide-scope">Illustrated player’s view · timing is scored; chord shapes and direction are a self-check.</span>`;
    this.hand = root.querySelector("[data-guide-hand]")!;
    this.lines = [...root.querySelectorAll<SVGLineElement>("[data-guide-string]")];
    this.action = root.querySelector("[data-guide-action]")!;
    this.count = root.querySelector("[data-guide-cycle]")!;
    this.cue = root.querySelector("[data-guide-cue]")!;
    this.correction = root.querySelector("[data-guide-correction]")!;
    this.correctionLabel = root.querySelector("[data-guide-correction-label]")!;
    this.setChord("C", null);
  }

  setChord(chord: ChordName, next: ChordName | null): void {
    this.root.querySelector("[data-guide-next]")!.textContent = next ? `Next · ${next}` : "";
    if (this.currentChord === chord) return;
    this.currentChord = chord;
    const frets = LESSON_CHORDS[chord].frets;
    this.root.querySelector("[data-guide-chord]")!.textContent = `${chord} · ${frets.join(" ")}`;
    this.root.querySelector("[data-guide-frets]")!.textContent = `G C E A · frets ${frets.join("–")} (0 = open)`;
    this.root.querySelector("svg")!.setAttribute("aria-label", `${chord} ukulele chord. G C E A frets ${frets.join(", ")}.`);
    // Replace the original decorative open-string markers with the active shape.
    this.root.querySelectorAll('circle[cx="68"]').forEach(node => node.remove());
    this.root.querySelector("[data-guide-shape]")!.innerHTML = frets.map((fret, i) => fret === 0
      ? `<circle cx="68" cy="${GUIDE_STRING_Y[i]}" r="4" fill="none" stroke="#efe0be"/>`
      : `<circle cx="${[0,126,205,278][fret]}" cy="${GUIDE_STRING_Y[i]}" r="13" fill="#f3a28d"/><text x="${[0,126,205,278][fret]}" y="${GUIDE_STRING_Y[i]+4}" text-anchor="middle" fill="#382522" font-size="11" font-weight="800">${fret}</text>`).join("");
  }

  setDownOnly(value: boolean): void {
    this.downOnly = value;
    this.root.querySelector("[data-guide-key]")!.textContent = value
      ? "Down-strums only · return without touching strings" : "Solid = play strings · hollow = silent return";
    if (this.root.dataset.moving !== "true") this.action.textContent = value ? "↓ Play strings" : "↓ Down · ↑ Up";
  }

  setCue(cue: VisualCue): void { this.cue.textContent = VISUAL_CUES[cue]; }

  setCorrection(text: string | null, label: string): void {
    this.correction.parentElement!.hidden = !text;
    this.correction.textContent = text ?? "";
    this.correctionLabel.textContent = label;
  }

  draw(frame: StrummingFrame, repetitions: number, demonstration: boolean): void {
    this.root.dataset.moving = "true";
    this.root.dataset.silent = String(frame.silent || frame.returning);
    this.root.dataset.slot = String(frame.slot);
    this.root.dataset.direction = frame.direction;
    const isAir = frame.silent || frame.returning;
    if (!this.reducedMotion.matches) {
      this.hand.setAttribute("transform", `translate(${isAir ? 476 : 451} ${frame.handY.toFixed(1)})`);
    } else {
      this.hand.setAttribute("transform", "translate(451 78)");
    }
    this.lines.forEach((line, index) => line.classList.toggle("is-plucked", demonstration && frame.contactString === index));
    this.action.textContent = this.downOnly && isAir ? "Return silently · miss the strings" : frame.returning ? "Silent return" : `${frame.direction === "down" ? "↓" : "↑"} ${frame.silent ? "Return silently" : "Play strings"}`;
    this.count.textContent = `${demonstration ? "Watch" : "Your turn"} · loop ${Math.min(repetitions, frame.cycle + 1)} / ${repetitions}`;
  }

  idle(): void {
    this.root.dataset.moving = "false";
    this.root.dataset.silent = "false";
    this.hand.setAttribute("transform", "translate(451 78)");
    this.lines.forEach((line) => line.classList.remove("is-plucked"));
    this.action.textContent = this.downOnly ? "↓ Play strings" : "↓ Down · ↑ Up";
    this.count.textContent = "Watch the wrist";
  }
}
