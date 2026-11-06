import { describe, expect, it } from 'vitest';
import { ALARM_SECONDS, buildAlarmWav } from './alarmSound';

const RATE = 8000;
const text = (bytes: Uint8Array, from: number, len: number) =>
  String.fromCharCode(...bytes.slice(from, from + len));
const u32 = (bytes: Uint8Array, at: number) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint32(at, true);

describe('buildAlarmWav', () => {
  it('is a valid 8 kHz 8-bit mono WAV', () => {
    const wav = buildAlarmWav(0);
    expect(text(wav, 0, 4)).toBe('RIFF');
    expect(text(wav, 8, 4)).toBe('WAVE');
    expect(text(wav, 36, 4)).toBe('data');
    expect(u32(wav, 24)).toBe(RATE);
    expect(u32(wav, 40)).toBe(Math.round(ALARM_SECONDS * RATE));
    expect(wav.length).toBe(44 + Math.round(ALARM_SECONDS * RATE));
  });

  it('puts silence first and the loud tones at the end', () => {
    const wav = buildAlarmWav(2);
    const samples = wav.slice(44);
    expect(samples.length).toBe(Math.round((2 + ALARM_SECONDS) * RATE));
    expect(samples.slice(0, 2 * RATE).every((s) => s === 128)).toBe(true);
    const tone = samples.slice(2 * RATE, 2 * RATE + 200);
    expect(Math.max(...tone)).toBeGreaterThan(240);
    expect(Math.min(...tone)).toBeLessThan(16);
  });

  it('treats negative silence as none', () => {
    expect(buildAlarmWav(-5).length).toBe(buildAlarmWav(0).length);
  });
});
