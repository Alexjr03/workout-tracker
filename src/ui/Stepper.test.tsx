import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Stepper } from './Stepper';

function Controlled({
  initial,
  onChange,
}: {
  initial: number | null;
  onChange?: (v: number | null) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Stepper
      label="Weight"
      unit="lb/side"
      step={2.5}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

const input = () => screen.getByRole('textbox', { name: 'Weight' });

describe('Stepper', () => {
  it('steps up and down by the step size', async () => {
    render(<Controlled initial={10} />);
    await userEvent.click(screen.getByRole('button', { name: 'Increase Weight' }));
    expect(input()).toHaveValue('12.5');
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Weight' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Weight' }));
    expect(input()).toHaveValue('7.5');
    expect(screen.getByText('lb/side')).toBeInTheDocument();
  });

  it('never goes below the minimum', async () => {
    render(<Controlled initial={2.5} />);
    const down = screen.getByRole('button', { name: 'Decrease Weight' });
    await userEvent.click(down);
    expect(input()).toHaveValue('0');
    expect(down).toBeDisabled();
  });

  it('starts empty when there is no value and + sets one step', async () => {
    render(<Controlled initial={null} />);
    expect(input()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Decrease Weight' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Increase Weight' }));
    expect(input()).toHaveValue('2.5');
  });

  it('accepts a typed value with a decimal keypad', async () => {
    const onChange = vi.fn();
    render(<Controlled initial={10} onChange={onChange} />);
    expect(input()).toHaveAttribute('inputmode', 'decimal');
    await userEvent.clear(input());
    expect(onChange).toHaveBeenLastCalledWith(null);
    await userEvent.type(input(), '17,5');
    expect(onChange).toHaveBeenLastCalledWith(17.5);
  });

  it('ignores text that is not a number and restores the value on blur', async () => {
    const onChange = vi.fn();
    render(<Controlled initial={10} onChange={onChange} />);
    await userEvent.clear(input());
    onChange.mockClear();
    await userEvent.type(input(), 'abc');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(input()).toHaveValue('');
  });

  it('shows outside value changes when not being edited', () => {
    const { rerender } = render(<Stepper label="Reps" step={1} value={8} onChange={() => {}} />);
    rerender(<Stepper label="Reps" step={1} value={9} onChange={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Reps' })).toHaveValue('9');
  });
});
