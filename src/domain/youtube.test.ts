import { describe, expect, it } from 'vitest';
import { youtubeEmbedUrl, youtubeId, youtubeSearchUrl } from './youtube';

describe('youtubeId', () => {
  it('reads the id from the usual YouTube link shapes', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=hWbUlkb5Ms4')).toBe('hWbUlkb5Ms4');
    expect(youtubeId('https://youtube.com/watch?feature=share&v=hWbUlkb5Ms4&t=30')).toBe(
      'hWbUlkb5Ms4',
    );
    expect(youtubeId('https://m.youtube.com/watch?v=hWbUlkb5Ms4')).toBe('hWbUlkb5Ms4');
    expect(youtubeId('https://youtu.be/hWbUlkb5Ms4?si=abc')).toBe('hWbUlkb5Ms4');
    expect(youtubeId('https://www.youtube.com/shorts/hWbUlkb5Ms4')).toBe('hWbUlkb5Ms4');
    expect(youtubeId('https://www.youtube.com/embed/hWbUlkb5Ms4')).toBe('hWbUlkb5Ms4');
    expect(youtubeId('  hWbUlkb5Ms4 ')).toBe('hWbUlkb5Ms4');
  });

  it('rejects anything else', () => {
    expect(youtubeId('https://vimeo.com/123')).toBeNull();
    expect(youtubeId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(youtubeId('https://evil.example/watch?v=hWbUlkb5Ms4')).toBeNull();
    expect(youtubeId('not a link')).toBeNull();
    expect(youtubeId('https://www.youtube.com/')).toBeNull();
    expect(youtubeId('')).toBeNull();
  });
});

describe('youtube urls', () => {
  it('embeds through the privacy-enhanced domain, inline', () => {
    expect(youtubeEmbedUrl('hWbUlkb5Ms4')).toBe(
      'https://www.youtube-nocookie.com/embed/hWbUlkb5Ms4?playsinline=1&rel=0',
    );
  });

  it('builds a search link', () => {
    expect(youtubeSearchUrl('Calf raise')).toBe(
      'https://www.youtube.com/results?search_query=how%20to%20do%20Calf%20raise%20proper%20form',
    );
  });
});
