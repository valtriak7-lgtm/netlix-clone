// File purpose: Application logic for this Netflix Clone module.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function getYouTubeId(url) {
  if (!url) {
    return '';
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('youtu.be')) {
      return parsed.pathname.replace('/', '');
    }
    if (host.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/embed/')[1]?.split('/')[0] || '';
      }
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v') || '';
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/shorts/')[1]?.split('/')[0] || '';
      }
    }
  } catch {
    return '';
  }
  return '';
}

function buildPlayableUrl(url, autoplay) {
  if (!url) {
    return '';
  }

  const youtubeId = getYouTubeId(url);
  if (youtubeId) {
    return `https://www.youtube.com/embed/${youtubeId}?autoplay=${autoplay ? 1 : 0}&rel=0&modestbranding=1`;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}autoplay=${autoplay ? 1 : 0}`;
}

function DetailsModal({ item, inList, onToggleList, onClose, onResolveTrailer, autoPlay = false }) {
  const trailerRef = useRef(null);
  const [resolvedTrailerUrl, setResolvedTrailerUrl] = useState('');
  const [resolvingTrailer, setResolvingTrailer] = useState(false);
  const [trailerError, setTrailerError] = useState('');
  const [shouldAutoplay, setShouldAutoplay] = useState(Boolean(autoPlay));

  useEffect(() => {
    if (!item) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  const trailerUrl = useMemo(
    () => item?.trailerUrl || resolvedTrailerUrl || '',
    [item?.trailerUrl, resolvedTrailerUrl]
  );

  useEffect(() => {
    setResolvedTrailerUrl('');
    setResolvingTrailer(false);
    setTrailerError('');
    setShouldAutoplay(Boolean(autoPlay));
  }, [item?.id, autoPlay]);

  const openTrailer = useCallback(async () => {
    setShouldAutoplay(true);

    if (trailerUrl) {
      trailerRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (!onResolveTrailer) {
      setTrailerError('Trailer not available for this title.');
      return;
    }

    setTrailerError('');
    setResolvingTrailer(true);
    try {
      const url = await onResolveTrailer(item);
      if (!url) {
        setTrailerError('Trailer not available for this title.');
        return;
      }
      setResolvedTrailerUrl(url);
      setTimeout(() => {
        trailerRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } catch {
      setTrailerError('Could not load trailer right now.');
    } finally {
      setResolvingTrailer(false);
    }
  }, [item, onResolveTrailer, trailerUrl]);

  useEffect(() => {
    if (!item || !autoPlay) {
      return;
    }
    void openTrailer();
  }, [autoPlay, item, openTrailer]);

  const trailerEmbedUrl = useMemo(
    () => buildPlayableUrl(trailerUrl, shouldAutoplay),
    [trailerUrl, shouldAutoplay]
  );

  if (!item) {
    return null;
  }

  return (
    <div className="movie-modal-overlay modal-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-6 sm:items-center sm:py-10">
      <div className="movie-modal-panel modal-panel glass-panel relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-neutral-900 text-white shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/60 px-3 py-2 text-sm font-semibold hover:bg-black/80"
          aria-label="Close details"
        >
          Close
        </button>
        <div className="relative h-52 w-full sm:h-64 md:h-72">
          <img
            src={item.backdrop || item.image}
            alt={item.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/60 to-transparent" />
        </div>
        <div className="space-y-4 px-6 pb-8 pt-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold sm:text-3xl">{item.title}</h2>
            {item.featured && (
              <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                Featured
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-300 sm:text-base">{item.description}</p>
          <div className="flex flex-wrap gap-3 text-sm text-neutral-300">
            <span>{item.year}</span>
            <span>{item.rating}</span>
            <span>{item.duration}</span>
            <span className="rounded bg-neutral-800 px-2 py-1 text-xs uppercase tracking-widest">
              {item.type}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openTrailer}
              className="rounded bg-white px-6 py-2 font-semibold text-black hover:bg-neutral-200"
            >
              {resolvingTrailer ? 'Loading...' : 'Play'}
            </button>
            <button
              type="button"
              onClick={openTrailer}
              className="rounded border border-white/70 px-6 py-2 font-semibold hover:border-white"
            >
              {resolvingTrailer ? 'Loading Trailer...' : 'Play Trailer'}
            </button>
            <button
              type="button"
              onClick={() => onToggleList(item)}
              className="rounded border border-white/60 px-6 py-2 font-semibold hover:border-white"
            >
              {inList ? 'Remove from List' : '+ My List'}
            </button>
          </div>
          {trailerError && (
            <p className="text-sm text-yellow-300">{trailerError}</p>
          )}
          {trailerUrl && (
            <div
              ref={trailerRef}
              className="movie-player-shell overflow-hidden rounded-md border border-neutral-800"
            >
              <iframe
                title={`${item.title} trailer`}
                src={trailerEmbedUrl}
                className="movie-player-frame aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DetailsModal;
