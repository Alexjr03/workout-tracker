import { useEffect, useState } from 'react';
import { remainingSeconds } from '../../domain/timer';

const TICK_MS = 250;
// A tick arriving much later than scheduled means the app was in the background.
const BACKGROUND_GAP_MS = 1500;

/**
 * Seconds left until `endsAt`, recomputed from the clock. Calls `onLiveFinish` once if the
 * timer reaches zero while the app is visible; a timer that ran out in the background ends
 * silently. Callers re-key on `endsAt`.
 */
export function useRestTimer(endsAt: string, onLiveFinish: () => void) {
  const [state, setState] = useState(() => ({ now: Date.now(), flash: false }));

  useEffect(() => {
    let last = Date.now();
    let finished = remainingSeconds(endsAt, last) === 0;
    if (finished) return;

    const id = setInterval(() => {
      const now = Date.now();
      const gap = now - last;
      last = now;
      let flash = false;
      if (remainingSeconds(endsAt, now) === 0) {
        finished = true;
        clearInterval(id);
        if (gap < BACKGROUND_GAP_MS && document.visibilityState === 'visible') {
          flash = true;
          onLiveFinish();
        }
      }
      setState((s) => ({ now, flash: s.flash || flash }));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [endsAt, onLiveFinish]);

  return { remaining: remainingSeconds(endsAt, state.now), flash: state.flash };
}
