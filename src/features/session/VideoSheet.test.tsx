import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseDef } from '../../db/types';
import { VideoSheet, videoIdFor } from './VideoSheet';

const bench: ExerciseDef = {
  id: 'bench-press',
  name: 'Bench press',
  type: 'compound',
  loadBasis: 'per-side',
  increment: 2.5,
  isCustom: false,
  muscle: 'chest',
  unit: 'lb',
};
const calf: ExerciseDef = { ...bench, id: 'calf-raise', name: 'Calf raise' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('videoIdFor', () => {
  it('prefers a saved link, then the built-in video, else none', () => {
    expect(videoIdFor({ ...bench, videoId: 'aaaaaaaaaaa' })).toBe('aaaaaaaaaaa');
    expect(videoIdFor(bench)).toBe('hWbUlkb5Ms4');
    expect(videoIdFor(calf)).toBeNull();
  });
});

describe('VideoSheet', () => {
  it('plays the video inline in a sheet and closes with one tap', async () => {
    const onClose = vi.fn();
    render(<VideoSheet exercise={bench} onClose={onClose} />);
    const frame = screen.getByTitle('Bench press how-to video');
    expect(frame).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/hWbUlkb5Ms4?playsinline=1&rel=0',
    );
    await userEvent.click(screen.getByRole('button', { name: '✕ Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('offers a YouTube search when there is no video', () => {
    render(<VideoSheet exercise={calf} onClose={() => {}} />);
    expect(screen.queryByTitle('Calf raise how-to video')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Search YouTube for Calf raise' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/results?search_query=how%20to%20do%20Calf%20raise%20proper%20form',
    );
  });

  it('says it needs internet when offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    render(<VideoSheet exercise={bench} onClose={() => {}} />);
    expect(
      screen.getByText('Videos need internet. Try again when you have signal.'),
    ).toBeInTheDocument();
    expect(screen.queryByTitle('Bench press how-to video')).not.toBeInTheDocument();
  });
});
