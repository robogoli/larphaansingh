import { useState } from 'react';
import { Gamepad2, Heart, Play } from 'lucide-react';
import type { Zone } from '../types/zone';

interface ZoneCardProps {
  zone: Zone;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
  onOpen: (zone: Zone) => void;
}

const TAG_LABELS: Record<string, string> = {
  port: 'Port',
  emulator: 'Emulator',
  flash: 'Flash',
  fnf: 'FNF',
  incbox: 'Incredibox',
  gba: 'GBA',
  tools: 'Tool',
  fps: 'FPS',
  nes: 'NES',
  dos: 'DOS',
  psx: 'PSX',
  nds: 'NDS',
  n64: 'N64',
  spanish: 'ES',
};

export default function ZoneCard({
  zone,
  isFavorite,
  onToggleFavorite,
  onOpen,
}: ZoneCardProps) {
  const [imgError, setImgError] = useState(false);

  const coverSrc = `/api/cover?src=${encodeURIComponent(zone.cover)}`;
  const primaryTag = zone.special?.[0] ? TAG_LABELS[zone.special[0]] || zone.special[0].toUpperCase() : null;
  const authorText = zone.author ? zone.author.split(',')[0].trim() : 'Arcade';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(zone)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(zone);
        }
      }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-[#2e2050] bg-white dark:bg-[#150d26] text-left shadow-sm transition-transform duration-150 ease-out hover:-translate-y-1 hover:border-purple-500/70 dark:hover:border-purple-400/70 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 cursor-pointer"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-[#1e1235]">
        {!imgError ? (
          <img
            src={coverSrc}
            alt={zone.name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-purple-900/40 via-[#1a0f2e] to-pink-900/30 p-4 text-center">
            <Gamepad2 className="h-9 w-9 text-purple-300/80" />
            <span className="line-clamp-2 text-xs font-medium text-purple-100/80">{zone.name}</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-0 transition-opacity duration-150 group-hover:opacity-100" />

        <div className="pointer-events-none absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-lg bg-purple-600/95 px-2.5 py-1 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Play</span>
        </div>

        <button
          type="button"
          aria-label={isFavorite ? `Remove ${zone.name} from favorites` : `Favorite ${zone.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(zone.id);
          }}
          className={`absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
            isFavorite
              ? 'border-pink-400/60 bg-pink-500/85 text-white'
              : 'border-white/20 bg-black/45 text-white/80 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-black/70 hover:text-white'
          }`}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
          {zone.name}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-purple-300/70 truncate">
          <span className="truncate">{authorText}</span>
          {primaryTag && (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">{primaryTag}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
