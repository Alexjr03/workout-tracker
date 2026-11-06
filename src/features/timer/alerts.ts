import { useEffect } from 'react';
import { buildAlarmWav } from '../../domain/alarmSound';

// The alarm plays through one <audio> element: iOS treats it as media, so it is louder than a UI
// sound and can keep playing with the screen locked. iOS only lets an element play without a tap
// once it has played inside one, so the Complete set tap primes it with a muted play.
let player: HTMLAudioElement | null = null;
let alarmUrl: string | null = null;
let lockedUrl: string | null = null;

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/** Asks iOS (Safari 17+) to lower other apps' audio, like music, while the alarm plays. */
function duckOtherAudio() {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session) session.type = 'transient';
}

const wavUrl = (silenceSeconds: number) =>
  URL.createObjectURL(new Blob([buildAlarmWav(silenceSeconds)], { type: 'audio/wav' }));

function play(src: string, muted = false) {
  if (!player) return;
  player.muted = muted;
  player.src = src;
  player.currentTime = 0;
  return Promise.resolve(player.play()).catch(() => undefined);
}

export function primeAudio(): void {
  if (typeof Audio === 'undefined') return;
  player ??= new Audio();
  alarmUrl ??= wavUrl(0);
  if (lockedUrl) return; // a locked-phone alarm is already playing on this element
  const p = player;
  void play(alarmUrl, true)?.then(() => {
    if (lockedUrl) return; // a locked alarm started meanwhile; leave it playing
    p.pause();
    p.muted = false;
  });
}

/** End-of-rest alarm while the app is open. Silent if audio was never primed. */
export function beep(): void {
  if (!player || !alarmUrl || lockedUrl) return;
  duckOtherAudio();
  void play(alarmUrl);
}

/**
 * Experimental: starts a clip that is silent until `endsAt` and then sounds the alarm, so it
 * can go off with the phone locked (iOS freezes the app's timers, but media keeps playing).
 */
export function scheduleLockedAlarm(endsAt: string): void {
  if (!player) return;
  cancelLockedAlarm();
  const silence = (Date.parse(endsAt) - Date.now()) / 1000;
  lockedUrl = wavUrl(silence);
  duckOtherAudio();
  const url = lockedUrl;
  player.onended = () => {
    if (lockedUrl === url) cancelLockedAlarm();
  };
  void play(url);
}

export function cancelLockedAlarm(): void {
  if (!player || !lockedUrl) return;
  player.pause();
  URL.revokeObjectURL(lockedUrl);
  lockedUrl = null;
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
