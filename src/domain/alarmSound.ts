const RATE = 8000;
// Three loud tones (beep, beep, higher beep) with short gaps.
const TONES = [
  { hz: 1000, seconds: 0.25 },
  { hz: 0, seconds: 0.12 },
  { hz: 1000, seconds: 0.25 },
  { hz: 0, seconds: 0.12 },
  { hz: 1500, seconds: 0.4 },
];
export const ALARM_SECONDS = TONES.reduce((s, t) => s + t.seconds, 0);

/**
 * 8 kHz 8-bit mono WAV: `silenceSeconds` of silence, then the alarm tones at full volume.
 * Played as a media clip so iOS treats it as media (not a UI sound) and it can run while the
 * screen is locked.
 */
export function buildAlarmWav(silenceSeconds: number): Uint8Array<ArrayBuffer> {
  const samples: number[] = new Array(Math.round(Math.max(0, silenceSeconds) * RATE)).fill(128);
  for (const t of TONES) {
    const n = Math.round(t.seconds * RATE);
    for (let i = 0; i < n; i++) {
      samples.push(t.hz ? 128 + Math.round(127 * Math.sin((2 * Math.PI * t.hz * i) / RATE)) : 128);
    }
  }

  const wav = new Uint8Array(44 + samples.length);
  const view = new DataView(wav.buffer);
  const ascii = (at: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, samples.length, true);
  wav.set(samples, 44);
  return wav;
}
