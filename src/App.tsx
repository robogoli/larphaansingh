import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Heart, History, Sparkles } from 'lucide-react';
import Header from './components/Header';
import InfoModal, { type ModalKind } from './components/InfoModal';
import PanicShield from './components/PanicShield';
import QuoteMarquee from './components/QuoteMarquee';
import SettingsModal from './components/SettingsModal';
import ZoneCard from './components/ZoneCard';
import ZoneViewer from './components/ZoneViewer';
import { applyTabCloak, CLOAK_PRESETS } from './data/cloaks';
import type { AppSettings, SortOption, StatsMap, Zone } from './types/zone';

const PAGE_SIZE = 48;

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  cloakId: 'default',
  customCloakTitle: '',
  panicKey: 'Backquote',
  showMarquee: true,
};

function loadStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [quotes, setQuotes] = useState<string[]>([]);
  const [stats, setStats] = useState<StatsMap>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [selectedTag, setSelectedTag] = useState('none');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [featuredOpen, setFeaturedOpen] = useState(true);
  const [allOpen, setAllOpen] = useState(true);

  const [activeZone, setActiveZone] = useState<Zone | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [panicActive, setPanicActive] = useState(false);

  const [favorites, setFavorites] = useState<number[]>(() =>
    loadStoredJson<number[]>('daknuxFavorites', [])
  );
  const [recents, setRecents] = useState<number[]>(() =>
    loadStoredJson<number[]>('daknuxRecents', [])
  );
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...loadStoredJson<Partial<AppSettings>>('daknuxSettings', {}),
  }));

  // Expose harmless parent hook expected by some legacy Google Sites game wrappers
  useEffect(() => {
    (window as unknown as Record<string, unknown>).maeExportApis_ = () => {};
  }, []);

  // Sync theme on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
      document.body.className =
        'daknux-cosmic-bg text-[#f5f3ff] antialiased selection:bg-purple-500/30';
    } else {
      root.classList.remove('dark');
      document.body.className =
        'daknux-light-bg text-slate-900 antialiased selection:bg-purple-500/20';
    }
    localStorage.setItem('daknuxSettings', JSON.stringify(settings));
  }, [settings]);

  // Resolve current active cloak title & favicon
  const activeCloak = useMemo(() => {
    if (panicActive) {
      return CLOAK_PRESETS.find((c) => c.id === 'gdocs') || CLOAK_PRESETS[1];
    }
    const preset = CLOAK_PRESETS.find((c) => c.id === settings.cloakId) || CLOAK_PRESETS[0];
    return {
      ...preset,
      title: settings.customCloakTitle.trim() || preset.title,
    };
  }, [panicActive, settings.cloakId, settings.customCloakTitle]);

  useEffect(() => {
    applyTabCloak(activeCloak.title, activeCloak.favicon);
  }, [activeCloak]);

  // Global panic key listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isTyping && e.key !== 'Escape') return;

      const hit =
        (settings.panicKey === 'Backquote' && e.code === 'Backquote') ||
        (settings.panicKey === 'ShiftEscape' && e.shiftKey && e.key === 'Escape') ||
        (settings.panicKey === 'F9' && e.key === 'F9');

      if (hit) {
        e.preventDefault();
        setPanicActive((prev) => !prev);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settings.panicKey]);

  const fetchCatalog = useCallback(async (refresh = false) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [zonesRes, quotesRes, statsRes] = await Promise.all([
        fetch(refresh ? '/api/zones?refresh=1' : '/api/zones'),
        fetch('/api/quotes'),
        fetch('/api/stats'),
      ]);
      if (!zonesRes.ok) throw new Error('Failed to load zones catalog');
      const zonesData = (await zonesRes.json()) as Zone[];
      // Filter out external Discord promo entry (-1) which is blocked on school networks
      const playableZones = zonesData.filter(
        (z) => !(z.id === -1 || (z.url && z.url.startsWith('http')))
      );
      setZones(playableZones);

      if (quotesRes.ok) {
        setQuotes((await quotesRes.json()) as string[]);
      }
      if (statsRes.ok) {
        setStats((await statsRes.json()) as StatsMap);
      }

      // Check URL ?id= query param
      const idParam = new URLSearchParams(window.location.search).get('id');
      if (idParam) {
        const match = playableZones.find((z) => String(z.id) === idParam);
        if (match) setActiveZone(match);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog(false);
  }, [fetchCatalog]);

  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const z of zones) {
      for (const t of z.special || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }, [zones]);

  const sortedZones = useMemo(() => {
    const list = [...zones];
    const getHits = (period: keyof StatsMap, id: number) => stats[period]?.[String(id)] ?? 0;

    list.sort((a, b) => {
      if (sortBy === 'id') return b.id - a.id;
      if (sortBy === 'popular') return getHits('year', b.id) - getHits('year', a.id);
      if (sortBy === 'trendingMonth') return getHits('month', b.id) - getHits('month', a.id);
      if (sortBy === 'trendingWeek') return getHits('week', b.id) - getHits('week', a.id);
      if (sortBy === 'trendingDay') return getHits('day', b.id) - getHits('day', a.id);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [zones, sortBy, stats]);

  const featuredZones = useMemo(
    () => sortedZones.filter((z) => z.featured && z.id >= 0),
    [sortedZones]
  );

  const filteredZones = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedZones.filter((z) => {
      if (selectedTag !== 'none' && !(z.special || []).includes(selectedTag)) {
        return false;
      }
      if (q) {
        const nameMatch = z.name.toLowerCase().includes(q);
        const authorMatch = (z.author || '').toLowerCase().includes(q);
        const tagMatch = (z.special || []).some((t) => t.toLowerCase().includes(q));
        return nameMatch || authorMatch || tagMatch;
      }
      return true;
    });
  }, [sortedZones, searchQuery, selectedTag]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedTag, sortBy]);

  const favoriteZones = useMemo(
    () => zones.filter((z) => favorites.includes(z.id)),
    [zones, favorites]
  );

  const recentZones = useMemo(
    () =>
      recents
        .map((id) => zones.find((z) => z.id === id))
        .filter((z): z is Zone => Boolean(z)),
    [zones, recents]
  );

  function handleOpenZone(zone: Zone) {
    setActiveZone(zone);
    setRecents((prev) => {
      const next = [zone.id, ...prev.filter((id) => id !== zone.id)].slice(0, 12);
      localStorage.setItem('daknuxRecents', JSON.stringify(next));
      return next;
    });
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('id', String(zone.id));
      window.history.pushState(null, '', url.toString());
    } catch {
      // Ignore
    }
  }

  function handleCloseZone() {
    setActiveZone(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      window.history.pushState(null, '', url.toString());
    } catch {
      // Ignore
    }
  }

  function handleToggleFavorite(id: number) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('daknuxFavorites', JSON.stringify(next));
      return next;
    });
  }

  function handleRandomZone() {
    const pool = filteredZones.length ? filteredZones : zones;
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    handleOpenZone(pick);
  }

  function handleResetFilters() {
    setSearchQuery('');
    setSelectedTag('none');
    setSortBy('name');
    setFeaturedOpen(true);
    setAllOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const isFiltering = searchQuery.trim().length > 0 || selectedTag !== 'none';
  const displayedZones = filteredZones.slice(0, visibleCount);
  const remainingCount = Math.max(0, filteredZones.length - displayedZones.length);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q.trim()) setFeaturedOpen(false);
        }}
        sortBy={sortBy}
        onSortChange={setSortBy}
        selectedTag={selectedTag}
        onTagChange={(t) => {
          setSelectedTag(t);
          if (t !== 'none') setFeaturedOpen(false);
        }}
        availableTags={availableTags}
        onRandomZone={handleRandomZone}
        onOpenSettings={() => setSettingsOpen(true)}
        onTriggerPanic={() => setPanicActive(true)}
        onResetFilters={handleResetFilters}
      />

      <QuoteMarquee quotes={quotes} visible={settings.showMarquee} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 space-y-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-xl border border-slate-200 dark:border-[#2e2050] bg-slate-200/60 dark:bg-[#150d26]"
              />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-6 text-center">
            <p className="text-sm font-medium text-red-400">{errorMsg}</p>
            <button
              type="button"
              onClick={() => fetchCatalog(false)}
              className="mt-3 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 cursor-pointer"
            >
              Retry Loading
            </button>
          </div>
        ) : (
          <>
            {/* Favorites & Recents (shown only when user has saved items and not actively searching) */}
            {!isFiltering && (recentZones.length > 0 || favoriteZones.length > 0) && (
              <section className="space-y-6">
                {favoriteZones.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Heart className="h-4 w-4 text-pink-500 fill-current" />
                      <h2 className="text-base font-bold tracking-tight">
                        Favorites{' '}
                        <span className="font-mono-tabular text-xs font-medium text-slate-500 dark:text-purple-300/80">
                          ({favoriteZones.length})
                        </span>
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {favoriteZones.map((zone) => (
                        <ZoneCard
                          key={`fav-${zone.id}`}
                          zone={zone}
                          isFavorite={true}
                          onToggleFavorite={handleToggleFavorite}
                          onOpen={handleOpenZone}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {recentZones.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <History className="h-4 w-4 text-purple-400" />
                      <h2 className="text-base font-bold tracking-tight">Recently Played</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {recentZones.slice(0, 6).map((zone) => (
                        <ZoneCard
                          key={`rec-${zone.id}`}
                          zone={zone}
                          isFavorite={favorites.includes(zone.id)}
                          onToggleFavorite={handleToggleFavorite}
                          onOpen={handleOpenZone}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Featured Zones */}
            {!isFiltering && featuredZones.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setFeaturedOpen((o) => !o)}
                  className="mb-4 flex w-full items-center justify-between border-b border-slate-200 dark:border-[#2e2050] pb-2 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <h2 className="text-lg font-bold tracking-tight">
                      Featured Zones{' '}
                      <span className="font-mono-tabular text-xs font-medium text-slate-500 dark:text-purple-300/80">
                        ({featuredZones.length})
                      </span>
                    </h2>
                  </div>
                  {featuredOpen ? (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                </button>

                {featuredOpen && (
                  <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {featuredZones.map((zone) => (
                      <ZoneCard
                        key={`feat-${zone.id}`}
                        zone={zone}
                        isFavorite={favorites.includes(zone.id)}
                        onToggleFavorite={handleToggleFavorite}
                        onOpen={handleOpenZone}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* All Zones */}
            <section>
              <button
                type="button"
                onClick={() => setAllOpen((o) => !o)}
                className="mb-4 flex w-full items-center justify-between border-b border-slate-200 dark:border-[#2e2050] pb-2 text-left cursor-pointer"
              >
                <h2 className="text-lg font-bold tracking-tight">
                  {isFiltering ? 'Matching Zones' : 'All Zones'}{' '}
                  <span className="font-mono-tabular text-xs font-medium text-slate-500 dark:text-purple-300/80">
                    ({filteredZones.length})
                  </span>
                </h2>
                {allOpen ? (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                )}
              </button>

              {allOpen && (
                <>
                  {displayedZones.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 dark:border-[#2e2050] bg-white/60 dark:bg-[#150d26]/60 p-10 text-center">
                      <p className="text-sm text-slate-500 dark:text-purple-200/80">
                        No zones match your search or tag filter.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {displayedZones.map((zone) => (
                          <ZoneCard
                            key={zone.id}
                            zone={zone}
                            isFavorite={favorites.includes(zone.id)}
                            onToggleFavorite={handleToggleFavorite}
                            onOpen={handleOpenZone}
                          />
                        ))}
                      </div>

                      {remainingCount > 0 && (
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                            className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors cursor-pointer"
                          >
                            Load More ({Math.min(PAGE_SIZE, remainingCount)} of {remainingCount}{' '}
                            remaining)
                          </button>
                          <button
                            type="button"
                            onClick={() => setVisibleCount(filteredZones.length)}
                            className="rounded-xl border border-slate-200 dark:border-[#2e2050] bg-white dark:bg-[#150d26] px-5 py-2.5 text-sm font-semibold hover:border-purple-500 transition-colors cursor-pointer"
                          >
                            Show All ({filteredZones.length})
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-slate-200 dark:border-[#2e2050] bg-white/70 dark:bg-[#120a20]/90 px-4 py-5 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-purple-200/80">
          <span className="font-medium">DAKNUX Arcade · Same-Origin Proxy Enabled</span>
          <div className="flex flex-wrap items-center gap-5 font-semibold">
            <button
              type="button"
              onClick={() => setModal({ type: 'credits' })}
              className="hover:text-purple-500 hover:underline cursor-pointer"
            >
              Credits &amp; Info
            </button>
            <button
              type="button"
              onClick={() => setModal({ type: 'privacy' })}
              className="hover:text-purple-500 hover:underline cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="hover:text-purple-500 hover:underline cursor-pointer"
            >
              Stealth &amp; Save Data
            </button>
          </div>
        </div>
      </footer>

      {activeZone && !panicActive && (
        <ZoneViewer
          zone={activeZone}
          cloakTitle={activeCloak.title}
          cloakFavicon={activeCloak.favicon}
          onClose={handleCloseZone}
          onShowInfo={(z) => setModal({ type: 'zone', zone: z })}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={(next) => setSettings((prev) => ({ ...prev, ...next }))}
          onRefreshZones={() => fetchCatalog(true)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <InfoModal modal={modal} stats={stats} onClose={() => setModal(null)} />

      {panicActive && <PanicShield onExit={() => setPanicActive(false)} />}
    </div>
  );
}
