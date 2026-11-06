const ID = /^[\w-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

/** The video id from a YouTube link (watch, youtu.be, shorts, embed) or a bare id; else null. */
export function youtubeId(input: string): string | null {
  const text = input.trim();
  if (ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname)) return null;
  const candidate =
    url.hostname === 'youtu.be'
      ? url.pathname.slice(1)
      : (url.searchParams.get('v') ?? url.pathname.split('/')[2] ?? '');
  return ID.test(candidate) ? candidate : null;
}

/** Privacy-enhanced embed that plays inline on iPhone instead of going full screen. */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`;
}

export function youtubeSearchUrl(exerciseName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to do ${exerciseName} proper form`)}`;
}
