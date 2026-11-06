import { useId, useState } from 'react';

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartSeries {
  name: string;
  /** Palette slot: primary amber, secondary blue (validated on the black surface). */
  tone: 'primary' | 'secondary';
  points: ChartPoint[];
  /** Markers on each point; off for a smoothed line such as an average. */
  showPoints?: boolean;
}

interface LineChartProps {
  label: string;
  yLabel: string;
  series: ChartSeries[];
  formatX: (x: number) => string;
  formatY: (y: number) => string;
  referenceLines?: { y: number; label: string }[];
  shadedRanges?: { from: number; to: number; label?: string }[];
}

// Drawn in a fixed coordinate space and scaled to the container width.
const W = 340;
const H = 200;
const PAD = { left: 44, right: 12, top: 14, bottom: 26 };
const HIT_RADIUS = 22; // 44px tap target at phone width

function domain(values: number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) return [lo - 1, hi + 1];
  const pad = (hi - lo) * 0.1;
  return [lo - pad, hi + pad];
}

/** Responsive SVG line chart: one y-axis, tappable points, optional reference lines and bands. */
export function LineChart({
  label,
  yLabel,
  series,
  formatX,
  formatY,
  referenceLines = [],
  shadedRanges = [],
}: LineChartProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const toneId = useId();
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <p className="muted">No data yet.</p>;

  const [x0, x1] = domain(all.map((p) => p.x));
  const [y0, y1] = domain([...all.map((p) => p.y), ...referenceLines.map((r) => r.y)]);
  const sx = (x: number) => PAD.left + ((x - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  const sy = (y: number) => H - PAD.bottom - ((y - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom);
  // Ticks at the data's own lowest, middle and highest values, not the padded edges.
  const ys = [...all.map((p) => p.y), ...referenceLines.map((r) => r.y)];
  const [lo, hi] = [Math.min(...ys), Math.max(...ys)];
  const ticks = [...new Set([lo, (lo + hi) / 2, hi].map((t) => Math.round(t * 10) / 10))];
  const xs = all.map((p) => p.x);
  const describe = (p: ChartPoint) => `${formatX(p.x)}: ${formatY(p.y)}`;

  return (
    <figure className="chart">
      {series.length > 1 && (
        <ul className="chart-legend" aria-label="Legend">
          {series.map((s) => (
            <li key={s.name}>
              <span className={`chart-swatch chart-${s.tone}`} aria-hidden="true" />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <p className="chart-unit">{yLabel}</p>
      <svg
        role="group"
        aria-label={label}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="chart-svg"
      >
        {/* Screentone under a lone line, like manga shading. */}
        <defs>
          <pattern id={toneId} width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.1" className="chart-tone-dot" />
          </pattern>
        </defs>
        {shadedRanges.map((r) => (
          <g key={`${r.from}-${r.to}`}>
            <rect
              className="chart-shade"
              x={sx(r.from)}
              y={PAD.top}
              width={Math.max(2, sx(r.to) - sx(r.from))}
              height={H - PAD.top - PAD.bottom}
            />
            {r.label && (
              <text className="chart-shade-label" x={sx(r.from) + 4} y={H - PAD.bottom - 4}>
                {r.label}
              </text>
            )}
          </g>
        ))}

        {ticks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} />
            <text className="chart-axis" x={PAD.left - 6} y={sy(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <text className="chart-axis" x={PAD.left} y={H - 6}>
          {formatX(Math.min(...xs))}
        </text>
        {Math.max(...xs) !== Math.min(...xs) && (
          <text className="chart-axis" x={W - PAD.right} y={H - 6} textAnchor="end">
            {formatX(Math.max(...xs))}
          </text>
        )}

        {referenceLines.map((r) => (
          <g key={r.label}>
            <line
              className="chart-reference"
              x1={PAD.left}
              x2={W - PAD.right}
              y1={sy(r.y)}
              y2={sy(r.y)}
            />
            <text
              className="chart-reference-label"
              x={W - PAD.right}
              y={sy(r.y) - 4}
              textAnchor="end"
            >
              {r.label}
            </text>
          </g>
        ))}

        {series.map((s) => (
          <g key={s.name} className={`chart-${s.tone}`}>
            {series.length === 1 && s.points.length > 1 && (
              <path
                className="chart-area"
                fill={`url(#${toneId})`}
                d={`${s.points
                  .map(
                    (p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`,
                  )
                  .join(' ')} L${sx(s.points.at(-1)?.x ?? x1).toFixed(1)},${H - PAD.bottom} L${sx(
                  s.points[0]?.x ?? x0,
                ).toFixed(1)},${H - PAD.bottom} Z`}
              />
            )}
            {s.points.length > 1 && (
              <path
                className="chart-line"
                d={s.points
                  .map(
                    (p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`,
                  )
                  .join(' ')}
              />
            )}
            {s.showPoints !== false &&
              s.points.map((p) => (
                <circle
                  key={p.x}
                  className="chart-point"
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={selected === describe(p) ? 6 : 4}
                />
              ))}
          </g>
        ))}

        {series
          .filter((s) => s.showPoints !== false)
          .flatMap((s) => s.points)
          .map((p) => (
            <circle
              key={`hit-${p.x}-${p.y}`}
              className="chart-hit"
              role="button"
              tabIndex={0}
              aria-label={describe(p)}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={HIT_RADIUS}
              onClick={() => setSelected(describe(p))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelected(describe(p));
              }}
            />
          ))}
      </svg>
      <p role="status" className="chart-readout">
        {selected ?? 'Tap a point to see its value'}
      </p>

      <table className="visually-hidden" aria-label={label}>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...new Set(xs)]
            .sort((a, b) => a - b)
            .map((x) => (
              <tr key={x}>
                <th scope="row">{formatX(x)}</th>
                {series.map((s) => {
                  const p = s.points.find((q) => q.x === x);
                  return <td key={s.name}>{p ? formatY(p.y) : ''}</td>;
                })}
              </tr>
            ))}
        </tbody>
      </table>
    </figure>
  );
}
