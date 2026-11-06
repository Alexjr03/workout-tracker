import type { ExerciseDef } from '../../db/types';
import { youtubeEmbedUrl, youtubeSearchUrl } from '../../domain/youtube';
import seedVideos from '../../seed/videos.json';
import { Sheet } from '../../ui/Sheet';

const SEED_VIDEOS: Record<string, string> = seedVideos;

/** A link the owner saved for this exercise, else the built-in demo video, else none. */
export function videoIdFor(exercise: ExerciseDef): string | null {
  return exercise.videoId ?? SEED_VIDEOS[exercise.id] ?? null;
}

/**
 * How-to video for an exercise, embedded from YouTube (no copy is stored). Closing unmounts
 * the player, which stops playback.
 */
export function VideoSheet({ exercise, onClose }: { exercise: ExerciseDef; onClose: () => void }) {
  const id = videoIdFor(exercise);
  return (
    <Sheet label={`How to: ${exercise.name}`} onClose={onClose}>
      <div className="video-head">
        <h2>{exercise.name}</h2>
        <button type="button" onClick={onClose}>
          ✕ Close
        </button>
      </div>
      {!navigator.onLine ? (
        <p className="muted">Videos need internet. Try again when you have signal.</p>
      ) : id ? (
        <div className="video-frame">
          <iframe
            title={`${exercise.name} how-to video`}
            src={youtubeEmbedUrl(id)}
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <a
          className="button-like"
          href={youtubeSearchUrl(exercise.name)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Search YouTube for {exercise.name}
        </a>
      )}
    </Sheet>
  );
}
