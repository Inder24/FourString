import { BasicPitch, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';
import type { TranscribedNote } from './chord-check';

let model: BasicPitch | null = null;

export async function transcribeChordRecording(blob: Blob, onProgress: (progress: number) => void): Promise<TranscribedNote[]> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const mono = new OfflineAudioContext(1, Math.ceil(decoded.duration * 22050), 22050);
    const source = mono.createBufferSource();
    source.buffer = decoded;
    source.connect(mono.destination);
    source.start();
    const resampled = await mono.startRendering();
    model ??= new BasicPitch(`${import.meta.env.BASE_URL}models/basic-pitch/model.json`);
    const frames: number[][] = [];
    const onsets: number[][] = [];
    await model.evaluateModel(resampled,
      (frameBatch, onsetBatch) => {
        frames.push(...frameBatch);
        onsets.push(...onsetBatch);
      },
      onProgress,
    );
    return noteFramesToTime(outputToNotesPoly(frames, onsets, 0.25, 0.25, 5))
      .map(({ pitchMidi, amplitude, durationSeconds, startTimeSeconds }) => ({
        pitchMidi, amplitude, durationSeconds, startTimeSeconds,
      }));
  } finally {
    await context.close();
  }
}
