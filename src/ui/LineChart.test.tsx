import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LineChart, type ChartSeries } from './LineChart';

const day = (d: number) => Date.UTC(2026, 10, d);
const fmtX = (x: number) => `Nov ${new Date(x).getUTCDate()}`;
const fmtY = (y: number) => `${y} lb`;

const weights: ChartSeries = {
  name: 'Top set',
  tone: 'primary',
  points: [
    { x: day(3), y: 10 },
    { x: day(10), y: 12.5 },
    { x: day(17), y: 15 },
  ],
};

function renderChart(props: Partial<Parameters<typeof LineChart>[0]> = {}) {
  return render(
    <LineChart
      label="Bench press top set"
      yLabel="lb/side"
      series={[weights]}
      formatX={fmtX}
      formatY={fmtY}
      {...props}
    />,
  );
}

describe('LineChart', () => {
  it('says so when there is nothing to plot', () => {
    renderChart({ series: [{ ...weights, points: [] }] });
    expect(screen.getByText('No data yet.')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('plots a single point without a line', () => {
    const { container } = renderChart({ series: [{ ...weights, points: [{ x: day(3), y: 10 }] }] });
    expect(container.querySelectorAll('.chart-point')).toHaveLength(1);
    expect(container.querySelector('.chart-line')).toBeNull();
  });

  it('draws a 2px line through every point, scaled to its container', () => {
    const { container } = renderChart();
    const svg = screen.getByRole('group', { name: 'Bench press top set' });
    expect(svg).toHaveAttribute('width', '100%');
    const line = container.querySelector('.chart-line');
    expect(line?.getAttribute('d')?.match(/[ML]/g)).toHaveLength(3);
    expect(container.querySelectorAll('.chart-point')).toHaveLength(3);
    expect(screen.getByText('lb/side')).toBeInTheDocument();
  });

  it('shows a legend only when there are two or more series', () => {
    const { rerender } = renderChart();
    expect(screen.queryByRole('list', { name: 'Legend' })).not.toBeInTheDocument();
    rerender(
      <LineChart
        label="Body weight"
        yLabel="kg"
        series={[
          weights,
          { name: '7-day average', tone: 'secondary', points: weights.points, showPoints: false },
        ]}
        formatX={fmtX}
        formatY={fmtY}
      />,
    );
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Top set', '7-day average']);
  });

  it('draws labelled reference lines and shaded ranges', () => {
    const { container } = renderChart({
      referenceLines: [{ y: 70, label: 'Goal 70' }],
      shadedRanges: [{ from: day(3), to: day(10), label: 'Ramp-up' }],
    });
    expect(container.querySelector('.chart-reference')).not.toBeNull();
    expect(screen.getByText('Goal 70')).toBeInTheDocument();
    expect(container.querySelector('.chart-shade')).not.toBeNull();
    expect(screen.getByText('Ramp-up')).toBeInTheDocument();
  });

  it('shows the value of a tapped point', () => {
    renderChart();
    expect(screen.getByRole('status')).toHaveTextContent('Tap a point to see its value');
    fireEvent.click(screen.getByRole('button', { name: 'Nov 10: 12.5 lb' }));
    expect(screen.getByRole('status')).toHaveTextContent('Nov 10: 12.5 lb');
  });

  it('gives each point a hit target of at least 44px', () => {
    renderChart();
    const target = screen.getByRole('button', { name: 'Nov 3: 10 lb' });
    expect(Number(target.getAttribute('r')) * 2).toBeGreaterThanOrEqual(44);
  });

  it('includes a data table for screen readers', () => {
    renderChart();
    const table = screen.getByRole('table', { name: 'Bench press top set' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByRole('cell', { name: '12.5 lb' })).toBeInTheDocument();
  });

  it('copes with every point at the same value', () => {
    const flat: ChartSeries = { ...weights, points: weights.points.map((p) => ({ ...p, y: 10 })) };
    const { container } = renderChart({ series: [flat] });
    const d = container.querySelector('.chart-line')?.getAttribute('d') ?? '';
    expect(d).not.toContain('NaN');
  });
});
