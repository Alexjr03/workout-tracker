import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beep, primeAudio, useWakeLock } from './alerts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('beep / primeAudio', () => {
  it('does nothing when Web Audio is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => {
      primeAudio();
      beep();
    }).not.toThrow();
  });

  it('plays a tone through a context unlocked by a tap', () => {
    const start = vi.fn();
    const osc = {
      frequency: { value: 0 },
      connect: vi.fn(),
      start,
      stop: vi.fn(),
    };
    const gain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
    const resume = vi.fn(() => Promise.resolve());
    class FakeAudioContext {
      currentTime = 0;
      destination = {};
      resume = resume;
      createOscillator = () => osc;
      createGain = () => gain;
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);

    primeAudio();
    primeAudio();
    expect(resume).toHaveBeenCalledTimes(2);
    beep();
    expect(osc.frequency.value).toBe(880);
    expect(start).toHaveBeenCalledOnce();
  });
});

describe('useWakeLock', () => {
  it('requests a screen wake lock and releases it on unmount', async () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ release }));
    vi.stubGlobal('navigator', { wakeLock: { request } });

    const { unmount } = renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    unmount();
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
  });

  it('asks again when the app comes back to the foreground', async () => {
    const request = vi.fn(() => Promise.resolve({ release: () => Promise.resolve() }));
    vi.stubGlobal('navigator', { wakeLock: { request } });
    renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it('fails silently when the API is missing or refuses', async () => {
    vi.stubGlobal('navigator', {});
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();

    const request = vi.fn(() => Promise.reject(new Error('NotAllowedError')));
    vi.stubGlobal('navigator', { wakeLock: { request } });
    renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
  });

  it('does nothing when disabled', () => {
    const request = vi.fn();
    vi.stubGlobal('navigator', { wakeLock: { request } });
    renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();
  });
});
