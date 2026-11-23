import { useState } from 'react';
import { Gamepad2, Heart, Info, Play } from 'lucide-react';
import type { AppSettings, EnrichedZone } from '../types/zone';
import { resolveCoverUrl } from '../utils/runtime';

interface ZoneCardProps {
  zone: EnrichedZone;
  hasProxy: boolean;
  isFavorite: boolean;
  plays?: number;
  cardSize: AppSettings['cardSize'];
  animations: boolean;
  onPlay: (zone: EnrichedZone) => void;
  onToggleFavorite: (zoneId: number) => void;
  onShowInfo: (zone: EnrichedZone) => void;
}

export default function ZoneCard({
  zone,
  hasProxy,
  isFavorite,
  plays,
  cardSize,
  animations,
  onPlay,
  onToggleFavorite,
  onShowInfo,
}: ZoneCardProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const coverSrc = resolveCoverUrl(zone.cover, hasProxy);
  const formattedPlays =
    typeof plays === 'number' && plays > 0
      ? plays >= 1000
        ? `${(plays / 1000).toFixed(1)}k`
        : `${plays}`
      : null;

  const paddingClass =
    cardSize === 'compact' ? 'p-2.5' : cardSize === 'large' ? 'p-4' : 'p-3';
  const titleClass =
    cardSize === 'compact' ? 'text-xs' : cardSize === 'large' ? 'text-base' : 'text-sm';

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-white/10 dark:bg-[#12121b] ${
        animations
          ? 'transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-lg hover:shadow-violet-950/15 dark:hover:border-violet-400/40 dark:hover:bg-[#171724]'
          : 'hover:border-violet-400/50'
      }`}
    >
      {/* Top Action Controls (Separate sibling buttons, zero nested clickables) */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-[#0c0c14]">
        <button
          type="button"
          onClick={() => onPlay(zone)}
          aria-label={`Play ${zone.name}`}
          className="block h-full w-full text-left focus-visible:outline-2 focus-visible:outline-violet-500 cursor-pointer"
        >
          {!imgLoaded && !imgError && (
            <div className="absolute inset-0 animate-pulse bg-slate-200/70 dark:bg-white/[0.04]" />
          )}

          {!imgError && coverSrc ? (
            <img
              src={coverSrc}
              alt={`${zone.name} cover`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                setImgError(true);
                setImgLoaded(true);
              }}
              className={`h-full w-full object-cover ${
                animations ? 'transition-transform duration-300 group-hover:scale-105' : ''
              } ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-950/70 via-slate-900 to-slate-950 p-4 text-center">
              <Gamepad2 className="h-9 w-9 text-violet-300/70" />
              <span className="line-clamp-2 text-xs font-medium text-slate-300">
                {zone.name}
              </span>
            </div>
          )}

          {/* Subtle hover Launch prompt */}
          <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/75 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
              <Play className="h-3 w-3 fill-current" />
              <span>Play</span>
            </span>
          </div>
        </button>

        {/* Favorite Button (sibling to play trigger) */}
        <button
          type="button"
          onClick={() => onToggleFavorite(zone.id)}
          aria-label={isFavorite ? `Remove ${zone.name} from favorites` : `Save ${zone.name} to favorites`}
          aria-pressed={isFavorite}
          className={`absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-md transition-colors cursor-pointer ${
            isFavorite
              ? 'border-pink-400/50 bg-pink-600/85 text-white'
              : 'border-white/20 bg-black/50 text-white/85 hover:bg-black/75 hover:text-white'
          }`}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Card Body & Metadata (Zero-pill clean text hierarchy) */}
      <div className={`flex flex-1 flex-col justify-between gap-2 ${paddingClass}`}>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-1.5">
            <button
              type="button"
              onClick={() => onPlay(zone)}
              className={`line-clamp-1 text-left font-bold leading-snug text-slate-900 hover:text-violet-600 dark:text-slate-100 dark:hover:text-violet-300 cursor-pointer ${titleClass}`}
              title={zone.name}
            >
              {zone.name}
            </button>
            <button
              type="button"
              onClick={() => onShowInfo(zone)}
              aria-label={`Details for ${zone.name}`}
              title="Game details & controls"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            <span>{zone.primaryCategoryLabel}</span>
            {zone.author && <span> · {zone.author}</span>}
            {formattedPlays && (
              <span className="font-mono-tabular"> · {formattedPlays} plays</span>
            )}
          </p>
        </div>
      </div>
    </article>
  );
}
