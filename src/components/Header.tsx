import { useState } from 'react';
import { EyeOff, Search, Settings, Shuffle } from 'lucide-react';
import type { SortOption } from '../types/zone';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
  selectedTag: string;
  onTagChange: (tag: string) => void;
  availableTags: string[];
  onRandomZone: () => void;
  onOpenSettings: () => void;
  onTriggerPanic: () => void;
  onResetFilters: () => void;
}

const TAG_NAMES: Record<string, string> = {
  port: 'Ports',
  emulator: 'Emulator',
  flash: 'Flash',
  fnf: 'Friday Night Funkin',
  incbox: 'Incredibox / Sprunki',
  gba: 'GBA',
  fps: 'FPS',
  nes: 'NES',
  dos: 'DOS',
  psx: 'PlayStation',
  nds: 'Nintendo DS',
  n64: 'N64',
  tools: 'Tools',
  spanish: 'Spanish',
};

export default function Header({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  selectedTag,
  onTagChange,
  availableTags,
  onRandomZone,
  onOpenSettings,
  onTriggerPanic,
  onResetFilters,
}: HeaderProps) {
  const [logoError, setLogoError] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-purple-500/25 bg-gradient-to-r from-[#581c87]/95 via-[#7e22ce]/95 to-[#9333ea]/95 text-white shadow-lg backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-6 md:flex-nowrap md:gap-6">
        {/* Zone 1: Single-element Brand */}
        <button
          type="button"
          onClick={onResetFilters}
          className="flex shrink-0 items-center rounded-lg px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
          title="Reset filters & return to top"
        >
          {!logoError ? (
            <img
              src="/assets/daknux/logo.png"
              alt="DAKNUX"
              width={152}
              height={32}
              onError={() => setLogoError(true)}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <span className="font-display text-2xl tracking-wider text-white whitespace-nowrap">
              DAKNUX
            </span>
          )}
        </button>

        {/* Zone 2: Search, Sort, Tag Filter */}
        <div className="order-3 flex w-full items-center gap-2 md:order-2 md:max-w-2xl md:flex-1">
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search 630+ zones..."
              aria-label="Search games and zones"
              className="h-10 w-full rounded-lg border border-white/20 bg-white/12 pl-9 pr-3 text-sm text-white placeholder-white/70 backdrop-blur-sm transition-colors focus:border-white/60 focus:bg-white/20 focus:outline-none"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            aria-label="Sort zones"
            className="h-10 max-w-[125px] shrink-0 rounded-lg border border-white/20 bg-[#4c1d95]/90 px-2.5 text-xs sm:text-sm font-medium text-white focus:border-white/60 focus:outline-none cursor-pointer"
          >
            <option value="name">Name</option>
            <option value="id">ID (Date)</option>
            <option value="popular">Popular</option>
            <option value="trendingDay">Trending (Day)</option>
            <option value="trendingWeek">Trending (Week)</option>
            <option value="trendingMonth">Trending (Month)</option>
          </select>

          <select
            value={selectedTag}
            onChange={(e) => onTagChange(e.target.value)}
            aria-label="Filter by tag"
            className="h-10 max-w-[125px] shrink-0 rounded-lg border border-white/20 bg-[#4c1d95]/90 px-2.5 text-xs sm:text-sm font-medium text-white focus:border-white/60 focus:outline-none cursor-pointer"
          >
            <option value="none">All Tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {TAG_NAMES[tag] || tag.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Zone 3: Primary Action Controls */}
        <div className="order-2 flex shrink-0 items-center gap-2 md:order-3">
          <button
            type="button"
            onClick={onRandomZone}
            title="Play a random zone"
            aria-label="Random game"
            className="flex h-10 items-center gap-1.5 rounded-lg border border-white/20 bg-white/12 px-3 text-sm font-medium text-white transition-colors hover:bg-white/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Shuffle className="h-4 w-4" />
            <span className="hidden sm:inline">Random</span>
          </button>

          <button
            type="button"
            onClick={onTriggerPanic}
            title="Instant Study Shield (Panic Key)"
            aria-label="Activate Study Shield"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/12 text-white transition-colors hover:bg-white/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white shrink-0 cursor-pointer"
          >
            <EyeOff className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title="Stealth, Cloak & Settings"
            aria-label="Open Settings"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/12 text-white transition-colors hover:bg-white/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white shrink-0 cursor-pointer"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
