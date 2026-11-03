import { useEffect } from 'react';

// iOS only plays Web Audio from a context created or resumed inside a user gesture, so the
// Complete set tap primes it and the timer reuses it later.
let context: AudioContext | null = null;

export function primeAudio(): void {
  if (typeof AudioContext === 'undefined') return;
  context ??= new AudioContext();
  void context.resume();
}

/** Short tone for the end of a rest. Silent if audio was never primed. */
export function beep(): void {
  if (!context) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.4, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start();
  osc.stop(context.currentTime + 0.4);
}

/** Keeps the screen on while enabled, where the Screen Wake Lock API exists. */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !navigator.wakeLock) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const request = () => {
      navigator.wakeLock.request('screen').then(
        (s) => {
          if (disposed) void s.release();
          else sentinel = s;
        },
        () => undefined, // Refused (e.g. low battery): the app works without it.
      );
    };
    // iOS drops the lock when the app is hidden; take it again on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [enabled]);
}
