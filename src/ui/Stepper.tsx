import { useState } from 'react';

interface StepperProps {
  label: string;
  value: number | null;
  step: number;
  unit?: string;
  min?: number;
  onChange: (value: number | null) => void;
  /** Report typed values when the field is left, not on every keystroke (for saved settings). */
  commitOnBlur?: boolean;
  /** Keep the label for screen readers only, to save height (the unit says what it is). */
  hideLabel?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const format = (n: number | null) => (n === null ? '' : String(n));

function parse(text: string): number | null | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Big −/+ buttons around a number field; tapping the field opens the decimal keypad. */
export function Stepper({
  label,
  value,
  step,
  unit,
  min = 0,
  onChange,
  commitOnBlur = false,
  hideLabel = false,
}: StepperProps) {
  // Text being typed; null when not editing, so outside changes always show.
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="stepper" role="group" aria-label={label}>
      <span className={hideLabel ? 'visually-hidden' : 'stepper-label'}>{label}</span>
      <div className="stepper-row">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value === null || value <= min}
          onClick={() => value !== null && onChange(Math.max(min, round2(value - step)))}
        >
          −
        </button>
        <input
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={editing ?? format(value)}
          onFocus={(e) => {
            setEditing(format(value));
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setEditing(e.target.value);
            if (commitOnBlur) return;
            const parsed = parse(e.target.value);
            if (parsed !== undefined) onChange(parsed);
          }}
          onBlur={() => {
            if (commitOnBlur && editing !== null) {
              const parsed = parse(editing);
              if (parsed !== undefined && parsed !== value) onChange(parsed);
            }
            setEditing(null);
          }}
        />
        {/* Always rendered so the + button keeps its grid column when there is no unit. */}
        <span className="stepper-unit">{unit}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(round2((value ?? min) + step))}
        >
          +
        </button>
      </div>
    </div>
  );
}
