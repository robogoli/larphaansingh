import { useEffect, useRef, useState } from 'react';
import {
  Clock,
  Compass,
  Grid2x2,
  Heart,
  History,
  Home,
  LayoutGrid,
  Menu,
  Search,
  Settings,
  ShieldAlert,
  Shuffle,
  Trophy,
  X,
} from 'lucide-react';
import type { EnrichedZone, NavPage, SearchHistoryItem } from '../types/zone';
import { assetPath } from '../utils/runtime';

interface HeaderProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  search: string;
  onSearchChange: (val: string) => void;
  onSearchSubmit: (query: string) => void;
  searchHistory: SearchHistoryItem[];
  onClearSearchHistory: () => void;
  suggestions: EnrichedZone[];
  onSelectSuggestion: (zone: EnrichedZone) => void;
  favoritesCount: number;
  totalCatalogCount: number;
  onRandomPlay: () => void;
  onOpenSettings: () => void;
  onPanic: () => void;
}

const NAV_ITEMS: Array<{ id: NavPage; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'library', label: 'Library', icon: LayoutGrid },
  { id: 'categories', label: 'Categories', icon: Grid2x2 },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'history', label: 'History', icon: History },
  { id: 'stats', label: 'Stats', icon: Trophy },
];

export default function Header({
  activePage,
  onNavigate,
  search,
  onSearchChange,
  onSearchSubmit,
  searchHistory,
  onClearSearchHistory,
  suggestions,
  onSelectSuggestion,
  favoritesCount,
  totalCatalogCount,
  onRandomPlay,
  onOpenSettings,
  onPanic,
}: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const showPopover =
    searchFocused &&
    ((search.trim().length > 0 && suggestions.length > 0) ||
      (search.trim().length === 0 && searchHistory.length > 0));

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = search.trim();
    if (trimmed) {
      onSearchSubmit(trimmed);
    }
    onNavigate('library');
    setSearchFocused(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b0b12]/88">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Left: Brand Identity */}
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="group flex items-center gap-2.5 rounded-xl px-1 py-1 text-left focus-visible:outline-2 focus-visible:outline-violet-500 cursor-pointer"
          >
            <img
              src={assetPath('assets/daknux/logo.png')}
              alt="DAKNUX"
              className="h-8 w-8 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/15"
            />
            <div>
              <span className="font-display block text-2xl leading-none tracking-wider text-slate-900 dark:text-white">
                DAKNUX
              </span>
              <span className="hidden text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:block font-mono-tabular">
                {totalCatalogCount} Games
              </span>
            </div>
          </button>
        </div>

        {/* Center: Primary Single-Row Navigation (Desktop) */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-0.5 rounded-xl border border-slate-200/80 bg-slate-100/75 p-1 dark:border-white/10 dark:bg-white/[0.04]"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
                {item.id === 'favorites' && favoritesCount > 0 && (
                  <span
                    className={`ml-0.5 text-[11px] font-mono-tabular ${
                      active ? 'text-violet-100' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    ({favoritesCount})
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Search + Actions */}
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2 lg:flex-initial">
          <div ref={searchWrapperRef} className="relative w-full max-w-[230px] sm:max-w-[260px]">
            <form onSubmit={handleFormSubmit} role="search">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setSearchFocused(true);
                }}
                placeholder="Search games, tags..."
                aria-label="Search games, categories, or authors"
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-8 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-violet-400 dark:focus:bg-[#141422]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search query"
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </form>

            {showPopover && (
              <div className="absolute right-0 top-11 z-50 w-72 sm:w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/15 dark:bg-[#13131f]">
                {search.trim().length > 0 ? (
                  <div>
                    <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
                      Matching Titles
                    </div>
                    <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
                      {suggestions.map((z) => (
                        <li key={z.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSuggestion(z);
                              setSearchFocused(false);
                            }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-white/[0.06] cursor-pointer"
                          >
                            <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                              {z.name}
                            </span>
                            <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                              {z.primaryCategoryLabel}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-white/10">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Recent Searches
                      </span>
                      <button
                        type="button"
                        onClick={onClearSearchHistory}
                        className="text-[11px] font-medium text-violet-600 hover:underline dark:text-violet-400 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-white/5">
                      {searchHistory.slice(0, 6).map((item) => (
                        <li key={item.query}>
                          <button
                            type="button"
                            onClick={() => {
                              onSearchChange(item.query);
                              onNavigate('library');
                              setSearchFocused(false);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.06] cursor-pointer"
                          >
                            <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">{item.query}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onRandomPlay}
            title="Launch a random game"
            aria-label="Random game"
            className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-violet-600 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-violet-300 cursor-pointer"
          >
            <Shuffle className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title="Preferences & Data"
            aria-label="Open settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-violet-600 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-violet-300 cursor-pointer"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onPanic}
            title="Quick Panic Shield"
            aria-label="Activate Panic Shield"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400 cursor-pointer"
          >
            <ShieldAlert className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-200 lg:hidden cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-slate-200/80 bg-white/95 px-4 py-3 dark:border-white/10 dark:bg-[#0d0d16]/95 lg:hidden"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold cursor-pointer ${
                    active
                      ? 'bg-violet-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.id === 'favorites' && favoritesCount > 0 && (
                    <span className="ml-auto font-mono-tabular text-[11px] opacity-80">
                      {favoritesCount}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                onRandomPlay();
                setMobileMenuOpen(false);
              }}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 cursor-pointer"
            >
              <Shuffle className="h-4 w-4 shrink-0" />
              <span>Random Game</span>
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
