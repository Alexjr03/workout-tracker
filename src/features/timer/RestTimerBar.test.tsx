import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RestTimerBar } from './RestTimerBar';

const alerts = vi.hoisted(() => ({ beep: vi.fn() }));
vi.mock('./alerts', () => ({ beep: alerts.beep }));

const NOW = Date.parse('2026-11-23T18:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(NOW);
  alerts.beep.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderBar(endsAt: string, onChange = vi.fn()) {
  render(<RestTimerBar endsAt={endsAt} onChange={onChange} />);
  return onChange;
}

const clock = () => screen.getByRole('timer');

describe('RestTimerBar', () => {
  it('counts down from the end time', () => {
    renderBar(iso(NOW + 150_000));
    expect(clock()).toHaveTextContent('2:30');
    act(() => vi.advanceTimersByTime(10_000));
    expect(clock()).toHaveTextContent('2:20');
  });

  it('adds and removes 15 seconds', () => {
    const onChange = renderBar(iso(NOW + 60_000));
    fireEvent.click(screen.getByRole('button', { name: '+15 s' }));
    expect(onChange).toHaveBeenLastCalledWith(iso(NOW + 75_000));
    fireEvent.click(screen.getByRole('button', { name: '−15 s' }));
    expect(onChange).toHaveBeenLastCalledWith(iso(NOW + 45_000));
  });

  it('never goes below zero', () => {
    const onChange = renderBar(iso(NOW + 10_000));
    fireEvent.click(screen.getByRole('button', { name: '−15 s' }));
    expect(onChange).toHaveBeenLastCalledWith(iso(NOW));
  });

  it('skips the rest', () => {
    const onChange = renderBar(iso(NOW + 60_000));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('stays correct after the clock jumps (app was in the background)', () => {
    renderBar(iso(NOW + 150_000));
    vi.setSystemTime(NOW + 60_000);
    act(() => vi.advanceTimersByTime(250));
    expect(clock()).toHaveTextContent('1:30');
  });

  it('beeps and flashes when it reaches zero in the foreground', () => {
    renderBar(iso(NOW + 2_000));
    act(() => vi.advanceTimersByTime(3_000));
    expect(alerts.beep).toHaveBeenCalledOnce();
    expect(screen.getByText('Rest done')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Rest timer' })).toHaveClass('rest-timer--flash');
  });

  it('shows "Rest done" without a late beep after returning from the background', () => {
    renderBar(iso(NOW + 2_000));
    vi.setSystemTime(NOW + 60_000);
    act(() => vi.advanceTimersByTime(250));
    expect(alerts.beep).not.toHaveBeenCalled();
    expect(screen.getByText('Rest done')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Rest timer' })).not.toHaveClass('rest-timer--flash');
  });

  it('shows "Rest done" straight away for a timer that already ended', () => {
    renderBar(iso(NOW - 5_000));
    expect(screen.getByText('Rest done')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1_000));
    expect(alerts.beep).not.toHaveBeenCalled();
  });
});
