import { adjustEndsAt, formatClock } from '../../domain/timer';
import { beep } from './alerts';
import { useRestTimer } from './useRestTimer';

interface RestTimerBarProps {
  endsAt: string;
  /** New end time after ±15 s, or null to skip. */
  onChange: (endsAt: string | null) => void;
}

/** Rest countdown with −15 s / +15 s / Skip. Re-key on `endsAt`. */
export function RestTimerBar({ endsAt, onChange }: RestTimerBarProps) {
  const { remaining, flash } = useRestTimer(endsAt, beep);
  const done = remaining === 0;

  return (
    <div
      role="group"
      aria-label="Rest timer"
      className={flash ? 'rest-timer rest-timer--flash' : 'rest-timer'}
    >
      <span role="timer" className="rest-timer-clock">
        {done ? 'Rest done' : formatClock(remaining)}
      </span>
      <button type="button" onClick={() => onChange(adjustEndsAt(endsAt, -15, Date.now()))}>
        −15 s
      </button>
      <button type="button" onClick={() => onChange(adjustEndsAt(endsAt, 15, Date.now()))}>
        +15 s
      </button>
      <button type="button" onClick={() => onChange(null)}>
        Skip
      </button>
    </div>
  );
}
