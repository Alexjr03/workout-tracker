import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './alerts';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A fake <audio> element that records what it was asked to play. */
class FakeAudio {
  static last: FakeAudio | null = null;
  src = '';
  muted = false;
  currentTime = 0;
  played: { src: string; muted: boolean }[] = [];
  pause = vi.fn();
  constructor() {
    FakeAudio.last = this;
  }
  play() {
    this.played.push({ src: this.src, muted: this.muted });
    return Promise.resolve();
  }
}

describe('alarm sound', () => {
  let alerts: typeof import('./alerts');
  let urls: number;

  beforeEach(async () => {
    vi.resetModules();
    FakeAudio.last = null;
    urls = 0;
    vi.stubGlobal('Audio', FakeAudio);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++urls}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    alerts = await import('./alerts');
  });

  it('does nothing when audio is unavailable or was never primed', () => {
    vi.stubGlobal('Audio', undefined);
    expect(() => {
      alerts.primeAudio();
      alerts.beep();
      alerts.scheduleLockedAlarm(new Date(Date.now() + 60_000).toISOString());
      alerts.cancelLockedAlarm();
    }).not.toThrow();
  });

  it('unlocks the player inside the tap with a muted play, then beeps out loud', async () => {
    const session = { type: 'auto' };
    vi.stubGlobal('navigator', { audioSession: session });
    alerts.primeAudio();
    const player = FakeAudio.last;
    expect(player?.played).toEqual([{ src: 'blob:1', muted: true }]);
    await vi.waitFor(() => expect(player?.muted).toBe(false));
    expect(player?.pause).toHaveBeenCalled();

    alerts.beep();
    expect(player?.played.at(-1)).toEqual({ src: 'blob:1', muted: false });
    // Lowers other audio (music) while the alarm plays.
    expect(session.type).toBe('transient');
  });

  it('plays a locked-phone alarm clip that ends when the rest does, and cancels it', () => {
    alerts.primeAudio();
    const player = FakeAudio.last;
    alerts.scheduleLockedAlarm(new Date(Date.now() + 90_000).toISOString());
    expect(player?.played.at(-1)?.src).toBe('blob:2');
    expect(player?.played.at(-1)?.muted).toBe(false);

    // While that clip is playing, the in-app beep doesn't play a second alarm.
    const count = player?.played.length;
    alerts.beep();
    expect(player?.played.length).toBe(count);

    alerts.cancelLockedAlarm();
    expect(player?.pause).toHaveBeenCalled();
    alerts.beep();
    expect(player?.played.at(-1)?.src).toBe('blob:1');
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
