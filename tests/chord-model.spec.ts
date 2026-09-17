import { expect, test } from '@playwright/test';
import { classifyChordNotes, type CheckableChord } from '../src/chord-check';

const EXAMPLES: Array<{ chord: CheckableChord; strings: Array<[string, number]> }> = [
  { chord: 'C', strings: [['G4', 1], ['C4', 1], ['E4', 1], ['Cs5', 2 ** (-1 / 12)]] },
  { chord: 'Am', strings: [['A4', 1], ['C4', 1], ['E4', 1], ['A4', 1]] },
  { chord: 'F', strings: [['A4', 1], ['C4', 1], ['Fs4', 2 ** (-1 / 12)], ['A4', 1]] },
  { chord: 'G', strings: [['G4', 1], ['D4', 1], ['G4', 1], ['B4', 1]] },
];

for (const example of EXAMPLES) test(`bundled model can transcribe ${example.chord} from real ukulele samples locally`, async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const result = await page.evaluate(async ({ strings }) => {
    const context = new AudioContext();
    const buffers = await Promise.all(strings.map(async ([name]) => {
      const response = await fetch(`/audio/${name}.flac`);
      if (!response.ok) throw new Error(`Missing sample ${name}`);
      return context.decodeAudioData(await response.arrayBuffer());
    }));
    const sampleRate = 22050;
    const offline = new OfflineAudioContext(1, sampleRate * 3, sampleRate);
    buffers.forEach((buffer, index) => {
      const source = offline.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = strings[index][1];
      const gain = offline.createGain();
      gain.gain.value = 0.2;
      source.connect(gain).connect(offline.destination);
      source.start(index * 0.035);
    });
    const rendered = await offline.startRendering();
    const data = rendered.getChannelData(0);
    const wav = new ArrayBuffer(44 + data.length * 2);
    const view = new DataView(wav);
    const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0, 'RIFF'); view.setUint32(4, wav.byteLength - 8, true); write(8, 'WAVE');
    write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    write(36, 'data'); view.setUint32(40, data.length * 2, true);
    data.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 32767, true));
    const { transcribeChordRecording } = await import('/src/chord-model.ts');
    const notes = await transcribeChordRecording(new Blob([wav], { type: 'audio/wav' }), () => {});
    await context.close();
    return notes;
  }, example);
  expect(result.length).toBeGreaterThan(0);
  expect(classifyChordNotes(example.chord, result).status).toBe('match');
});
