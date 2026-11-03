import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { RoutineError, setScheduleDay } from '../../../db/repos/routine';
import { db } from '../../../db/schema';
import { WEEKDAYS, type Weekday } from '../../../domain/dates';

// Week starts on Monday, like the routine.
const ORDER: Weekday[] = [...WEEKDAYS.slice(1), WEEKDAYS[0]];
const label = (day: Weekday) => day[0]?.toUpperCase() + day.slice(1);

export function ScheduleEditor() {
  const routine = useLiveQuery(() => db.routine.get('routine'));
  const [error, setError] = useState<string | null>(null);
  if (!routine) return null;

  async function change(day: Weekday, sessionId: string) {
    try {
      await setScheduleDay(db, day, sessionId);
      setError(null);
    } catch (e) {
      if (!(e instanceof RoutineError)) throw e;
      setError(e.message);
    }
  }

  return (
    <div className="stack">
      <Link to="/settings" className="back-link">
        ‹ Settings
      </Link>
      <h1>Weekly schedule</h1>
      <p className="muted">Applies from the next session you start. Past sessions don't change.</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {ORDER.map((day) => (
        <div key={day} className="field">
          <label htmlFor={`day-${day}`}>{label(day)}</label>
          <select
            id={`day-${day}`}
            value={routine.schedule[day]}
            onChange={(e) => void change(day, e.target.value)}
          >
            <option value="rest">Rest</option>
            {Object.entries(routine.sessions).map(([id, template]) => (
              <option key={id} value={id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
