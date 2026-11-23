import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  Compass,
  Filter,
  Flame,
  Gamepad2,
  Grid2x2,
  Heart,
  History,
  Info,
  Play,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import ConfirmDialog from './components/ConfirmDialog';
import Header from './components/Header';
import InfoModal from './components/InfoModal';
import PanicShield from './components/PanicShield';
import QuoteMarquee from './components/QuoteMarquee';
import SettingsModal from './components/SettingsModal';
import StatsAndFeedbackView from './components/StatsAndFeedbackView';
import ToastContainer from './components/ToastContainer';
import ZoneCard from './components/ZoneCard';
import ZoneViewer from './components/ZoneViewer';
import { CATEGORIES, CATEGORY_MAP } from './data/categories';
import { CLOAK_PRESETS, applyTabCloak } from './data/cloaks';
import type {
  AppSettings,
  CategoryId,
  EnrichedZone,
  FeedbackDraft,
  NavPage,
  PlayHistoryEntry,
  SearchHistoryItem,
  SortOption,
  StatsMap,
  ToastItem,
} from './types/zone';
import {
  getDailyFeaturedZone,
  getRecommendedZones,
  validateAndEnrichCatalog,
} from './utils/catalog';
import { assetPath, loadCatalogRuntime, resolveCoverUrl } from './utils/runtime';
import { playUiTone } from './utils/sound';
import {
  DEFAULT_SETTINGS,
  clearPersonalDataScope,
  computeAchievements,
  getSearchUsed,
  loadFavorites,
  loadFeedbackLog,
  loadPlayHistory,
  loadSearchHistory,
  loadSettings,
  markSearchUsed,
  recordTodayVisit,
  saveFavorites,
  saveFeedbackLog,
  savePlayHistory,
  saveSearchHistory,
  saveSettings,
} from './utils/storage';

const PAGE_BATCH = 48;
const VALID_PAGES: NavPage[] = [
  'home',
  'library',
  'categories',
  'discover',
  'favorites',
  'history',
  'stats',
];

function getInitialPageFromHash(): NavPage {
  const hash = window.location.hash.replace(/^#\/?/, '').trim() as NavPage;
  return VALID_PAGES.includes(hash) ? hash : 'home';
}

export default function App() {
  const [zones, setZones] = useState<EnrichedZone[]>([]);
  const [quotes, setQuotes] = useState<string[]>([]);
  const [stats, setStats] = useState<StatsMap>({});
  const [hasProxy, setHasProxy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activePage, setActivePage] = useState<NavPage>(getInitialPageFromHash);
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<CategoryId[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [recentAddedOnly, setRecentAddedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [visibleCount, setVisibleCount] = useState(PAGE_BATCH);

  const [favorites, setFavorites] = useState<number[]>(loadFavorites);
  const [playHistory, setPlayHistory] = useState<PlayHistoryEntry[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(loadSearchHistory);
  const [visitDays] = useState<string[]>(recordTodayVisit);
  const [searchUsed, setSearchUsed] = useState<boolean>(getSearchUsed);
  const [feedbackLog, setFeedbackLog] = useState<FeedbackDraft[]>(loadFeedbackLog);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  );
  const [systemReducedMotion, setSystemReducedMotion] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  const [activeZone, setActiveZone] = useState<EnrichedZone | null>(null);
  const [infoZone, setInfoZone] = useState<EnrichedZone | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panicActive, setPanicActive] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [discoverRollNonce, setDiscoverRollNonce] = useState(0);

  const unlockedTrackRef = useRef<Set<string> | null>(null);

  const addToast = useCallback(
    (title: string, message?: string, type: ToastItem['type'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, message, type }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadAll = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const runtime = await loadCatalogRuntime(refresh);
      const enriched = validateAndEnrichCatalog(runtime.zones);
      setZones(enriched);
      setQuotes(runtime.quotes);
      setStats(runtime.stats);
      setHasProxy(runtime.hasProxy);
      setPlayHistory(loadPlayHistory(enriched));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the game catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll(false);
  }, [loadAll]);

  // Listen to OS theme & reduced-motion changes when system preference active
  useEffect(() => {
    if (!window.matchMedia) return;
    const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
    const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onDark = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    const onMotion = (e: MediaQueryListEvent) => setSystemReducedMotion(e.matches);
    darkMq.addEventListener('change', onDark);
    motionMq.addEventListener('change', onMotion);
    return () => {
      darkMq.removeEventListener('change', onDark);
      motionMq.removeEventListener('change', onMotion);
    };
  }, []);

  // Sync URL hash with active page for browser history & refresh safety
  useEffect(() => {
    function onHashChange() {
      setActivePage(getInitialPageFromHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function navigateTo(page: NavPage) {
    setActivePage(page);
    if (window.location.hash !== `#${page}`) {
      window.history.replaceState(null, '', `#${page}`);
    }
    window.scrollTo({ top: 0, behavior: settings.reducedMotion ? 'auto' : 'smooth' });
  }

  // Deep-link support: ?id=123
  useEffect(() => {
    if (!zones.length) return;
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam) {
      const target = zones.find((z) => String(z.id) === idParam);
      if (target) {
        setActiveZone(target);
      }
    }
  }, [zones]);

  // Persist settings and apply CSS classes to <html>
  const effectiveDark =
    settings.theme === 'dark' || (settings.theme === 'system' && systemPrefersDark);
  const effectiveReducedMotion = settings.reducedMotion || systemReducedMotion;

  useEffect(() => {
    saveSettings(settings);
    const root = document.documentElement;
    root.classList.toggle('dark', effectiveDark);
    root.classList.toggle('reduce-motion', effectiveReducedMotion);

    const cloak = CLOAK_PRESETS.find((c) => c.id === settings.cloakId) || CLOAK_PRESETS[0];
    const effectiveTitle = panicActive
      ? 'AP Biology — Unit 3 Review Notes'
      : settings.customCloakTitle.trim() || cloak.title;
    const effectiveFavicon = panicActive
      ? CLOAK_PRESETS[4].favicon
      : cloak.favicon;
    applyTabCloak(effectiveTitle, effectiveFavicon);
  }, [settings, effectiveDark, effectiveReducedMotion, panicActive]);

  // Global panic key shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');
      if (isTyping && settings.panicKey === 'Backquote') return;

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

  const achievements = useMemo(
    () => computeAchievements(zones, playHistory, favorites, visitDays, searchUsed),
    [zones, playHistory, favorites, visitDays, searchUsed]
  );

  // Notify cleanly when user unlocks a new milestone mid-session
  useEffect(() => {
    if (!zones.length) return;
    const currentUnlocked = new Set(achievements.filter((a) => a.unlocked).map((a) => a.id));
    if (unlockedTrackRef.current === null) {
      unlockedTrackRef.current = currentUnlocked;
      return;
    }
    for (const ach of achievements) {
      if (ach.unlocked && !unlockedTrackRef.current.has(ach.id)) {
        unlockedTrackRef.current.add(ach.id);
        playUiTone('achievement', settings.soundEffects);
        addToast(`Milestone Unlocked: ${ach.name}`, ach.description, 'success');
      }
    }
  }, [achievements, zones.length, settings.soundEffects, addToast]);

  const hasVerifiedStats = useMemo(
    () =>
      Object.keys(stats.year || {}).length > 0 ||
      Object.keys(stats.month || {}).length > 0,
    [stats]
  );

  // Switch default sort automatically if no external stats could be fetched
  useEffect(() => {
    if (!loading && !hasVerifiedStats && sortBy === 'popular') {
      setSortBy('newest');
    }
  }, [loading, hasVerifiedStats, sortBy]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const handleToggleFavorite = useCallback(
    (id: number) => {
      playUiTone('favorite', settings.soundEffects);
      setFavorites((prev) => {
        const exists = prev.includes(id);
        const next = exists ? prev.filter((x) => x !== id) : [id, ...prev];
        saveFavorites(next);
        return next;
      });
    },
    [settings.soundEffects]
  );

  const handlePlayZone = useCallback(
    (zone: EnrichedZone) => {
      playUiTone('launch', settings.soundEffects);
      setActiveZone(zone);
      setPlayHistory((prev) => {
        const now = new Date().toISOString();
        const existing = prev.find((p) => p.id === zone.id);
        const nextEntry: PlayHistoryEntry = existing
          ? { ...existing, name: zone.name, lastPlayedAt: now, playCount: existing.playCount + 1 }
          : { id: zone.id, name: zone.name, lastPlayedAt: now, playCount: 1 };
        const next = [nextEntry, ...prev.filter((p) => p.id !== zone.id)];
        savePlayHistory(next);
        return next;
      });
    },
    [settings.soundEffects]
  );

  function handleSearchChange(val: string) {
    setSearch(val);
    setVisibleCount(PAGE_BATCH);
    if (val.trim().length > 0 && !searchUsed) {
      markSearchUsed();
      setSearchUsed(true);
    }
    if (val.trim().length > 0 && activePage !== 'library') {
      navigateTo('library');
    }
  }

  function handleSearchSubmit(query: string) {
    const clean = query.trim();
    if (!clean) return;
    if (!searchUsed) {
      markSearchUsed();
      setSearchUsed(true);
    }
    setSearchHistory((prev) => {
      const next: SearchHistoryItem[] = [
        { query: clean, timestamp: new Date().toISOString() },
        ...prev.filter((item) => item.query.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, 12);
      saveSearchHistory(next);
      return next;
    });
  }

  function handleRandomPlay() {
    const pool = zones.filter((z) => z.isValid && z.isEmbeddable);
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    handlePlayZone(pick);
  }

  function handleClearScope(scope: 'favorites' | 'history' | 'search' | 'preferences') {
    clearPersonalDataScope(scope);
    if (scope === 'favorites') {
      setFavorites([]);
      addToast('Favorites cleared', 'All favorited games removed on this device.', 'info');
    } else if (scope === 'history') {
      setPlayHistory([]);
      unlockedTrackRef.current = new Set();
      addToast('History cleared', 'Play history and achievement dates reset.', 'info');
    } else if (scope === 'search') {
      setSearchHistory([]);
      addToast('Search history cleared', undefined, 'info');
    } else {
      setSettings(DEFAULT_SETTINGS);
      addToast('Preferences reset', 'Display and personalization restored to defaults.', 'info');
    }
  }

  function handleDataImported() {
    setSettings(loadSettings());
    setFavorites(loadFavorites());
    setSearchHistory(loadSearchHistory());
    setFeedbackLog(loadFeedbackLog());
    setPlayHistory(loadPlayHistory(zones));
    setSearchUsed(getSearchUsed());
  }

  const byId = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return zones
      .filter((z) => z.name.toLowerCase().includes(q))
      .slice(0, 7);
  }, [zones, search]);

  const newestThresholdId = useMemo(() => {
    if (zones.length <= 60) return 0;
    const sortedIds = [...zones].map((z) => z.id).sort((a, b) => b - a);
    return sortedIds[59] || 0;
  }, [zones]);

  const filteredZones = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = zones.filter((z) => {
      if (favoritesOnly && !favoriteSet.has(z.id)) return false;
      if (recentAddedOnly && z.id < newestThresholdId) return false;
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.some((cat) => z.categories.includes(cat))
      ) {
        return false;
      }
      if (!q) return true;
      const inName = z.name.toLowerCase().includes(q);
      const inAuthor = (z.author || '').toLowerCase().includes(q);
      const inDesc = z.description.toLowerCase().includes(q);
      const inTags = (z.special || []).some((t) => t.toLowerCase().includes(q));
      const inCats = z.categories.some((c) =>
        (CATEGORY_MAP[c]?.label || c).toLowerCase().includes(q)
      );
      return inName || inAuthor || inDesc || inTags || inCats;
    });

    const yearHits = stats.year || {};
    return [...list].sort((a, b) => {
      if (sortBy === 'nameAsc') return a.name.localeCompare(b.name);
      if (sortBy === 'nameDesc') return b.name.localeCompare(a.name);
      if (sortBy === 'newest') return b.id - a.id;
      if (sortBy === 'category') {
        const cmp = a.primaryCategoryLabel.localeCompare(b.primaryCategoryLabel);
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
      }
      if (sortBy === 'favorites') {
        const favDiff = Number(favoriteSet.has(b.id)) - Number(favoriteSet.has(a.id));
        return favDiff !== 0 ? favDiff : a.name.localeCompare(b.name);
      }
      // popular
      const hitDiff = (yearHits[String(b.id)] || 0) - (yearHits[String(a.id)] || 0);
      if (hitDiff !== 0) return hitDiff;
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name);
    });
  }, [
    zones,
    search,
    favoritesOnly,
    recentAddedOnly,
    newestThresholdId,
    selectedCategories,
    favoriteSet,
    sortBy,
    stats.year,
  ]);

  // Curated Home & Discover Shelves
  const dailyFeatured = useMemo(() => getDailyFeaturedZone(zones), [zones]);

  const continuePlayingZones = useMemo(
    () =>
      playHistory
        .map((entry) => byId.get(entry.id))
        .filter((z): z is EnrichedZone => Boolean(z))
        .slice(0, 6),
    [playHistory, byId]
  );

  const recommendedZones = useMemo(
    () =>
      getRecommendedZones(
        zones,
        favorites,
        playHistory,
        settings.preferredCategories,
        6
      ),
    [zones, favorites, playHistory, settings.preferredCategories]
  );

  const trendingZones = useMemo(() => {
    const yearHits = stats.year || {};
    return [...zones]
      .filter((z) => z.isValid && z.isEmbeddable)
      .sort((a, b) => {
        const diff = (yearHits[String(b.id)] || 0) - (yearHits[String(a.id)] || 0);
        if (diff !== 0) return diff;
        return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.id - a.id;
      })
      .slice(0, 6);
  }, [zones, stats.year]);

  const newestZones = useMemo(
    () =>
      [...zones]
        .filter((z) => z.isValid)
        .sort((a, b) => b.id - a.id)
        .slice(0, 6),
    [zones]
  );

  const categoryCounts = useMemo(() => {
    const map = new Map<CategoryId, number>();
    for (const z of zones) {
      for (const c of z.categories) {
        map.set(c, (map.get(c) || 0) + 1);
      }
    }
    return map;
  }, [zones]);

  const surprisePicks = useMemo(() => {
    const pool = zones.filter((z) => z.isValid && z.isEmbeddable);
    if (!pool.length) return [];
    const copy = [...pool];
    // Deterministic slice seeded by discoverRollNonce + length
    let seed = (discoverRollNonce + 1) * 9301 + 49297;
    const out: EnrichedZone[] = [];
    for (let i = 0; i < Math.min(6, copy.length); i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const idx = seed % copy.length;
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  }, [zones, discoverRollNonce]);

  const favoriteZones = useMemo(
    () => favorites.map((id) => byId.get(id)).filter((z): z is EnrichedZone => Boolean(z)),
    [favorites, byId]
  );

  const gridColsClass =
    settings.gridDensity === 'compact'
      ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'
      : settings.gridDensity === 'spacious'
        ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5'
        : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4';

  const bgClass = effectiveDark
    ? settings.backgroundStyle === 'cosmic'
      ? 'daknux-bg-cosmic text-slate-100'
      : settings.backgroundStyle === 'midnight'
        ? 'daknux-bg-midnight text-slate-100'
        : 'daknux-bg-obsidian text-slate-100'
    : 'daknux-light-bg text-slate-900';

  const activeCloak = CLOAK_PRESETS.find((c) => c.id === settings.cloakId) || CLOAK_PRESETS[0];

  function toggleCategoryFilter(cat: CategoryId) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setVisibleCount(PAGE_BATCH);
  }

  function openCategoryInLibrary(cat: CategoryId) {
    setSelectedCategories([cat]);
    setFavoritesOnly(false);
    setRecentAddedOnly(false);
    setVisibleCount(PAGE_BATCH);
    navigateTo('library');
  }

  function resetAllFilters() {
    setSearch('');
    setSelectedCategories([]);
    setFavoritesOnly(false);
    setRecentAddedOnly(false);
    setVisibleCount(PAGE_BATCH);
  }

  return (
    <div className={`min-h-screen flex flex-col ${bgClass}`}>
      <Header
        activePage={activePage}
        onNavigate={navigateTo}
        search={search}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        searchHistory={searchHistory}
        onClearSearchHistory={() => handleClearScope('search')}
        suggestions={suggestions}
        onSelectSuggestion={(z) => handlePlayZone(z)}
        favoritesCount={favorites.length}
        totalCatalogCount={zones.length}
        onRandomPlay={handleRandomPlay}
        onOpenSettings={() => setSettingsOpen(true)}
        onPanic={() => setPanicActive(true)}
      />

      <QuoteMarquee
        quotes={quotes}
        visible={settings.showMarquee && !effectiveReducedMotion}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {loading ? (
          <div className="space-y-6">
            <div className="h-56 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-white/[0.05]" />
            <div className={`grid ${gridColsClass}`}>
              {Array.from({ length: 10 }).map((_, idx) => (
                <div
                  key={idx}
                  className="aspect-[4/5] animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/[0.05]"
                />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md rounded-2xl border border-rose-500/30 bg-white p-6 text-center shadow-lg dark:bg-[#13131d]">
            <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
            <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
              Could Not Load Catalog
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{error}</p>
            <button
              type="button"
              onClick={() => loadAll(true)}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry</span>
            </button>
          </div>
        ) : (
          <>
            {/* HOME VIEW */}
            {activePage === 'home' && (
              <div className="space-y-10">
                {/* Hero Spotlight Banner */}
                {dailyFeatured && (
                  <section
                    aria-label="Daily Featured Spotlight"
                    className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#12121c]"
                  >
                    <div className="grid items-center gap-6 lg:grid-cols-[1.35fr_0.9fr]">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                          <Sparkles className="h-4 w-4" />
                          <span>Daily Featured Spotlight</span>
                        </div>

                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                          {dailyFeatured.name}
                        </h1>

                        <p className="max-w-xl text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
                          {dailyFeatured.description}
                        </p>

                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {dailyFeatured.primaryCategoryLabel}
                          {dailyFeatured.author ? ` · By ${dailyFeatured.author}` : ''}
                          {' · '}
                          <span className="font-mono-tabular">
                            {zones.length} playable titles in catalog
                          </span>
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => handlePlayZone(dailyFeatured)}
                            className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-6 text-sm font-semibold text-white shadow-sm hover:bg-violet-500 cursor-pointer"
                          >
                            <Play className="h-4 w-4 fill-current" />
                            <span>Play Now</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setInfoZone(dailyFeatured)}
                            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 cursor-pointer"
                          >
                            <Info className="h-4 w-4" />
                            <span>Controls &amp; Details</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateTo('library')}
                            className="inline-flex h-11 items-center gap-1.5 px-2 text-sm font-semibold text-violet-600 hover:text-violet-500 dark:text-violet-400 cursor-pointer"
                          >
                            <span>Browse Full Library</span>
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="relative mx-auto w-full max-w-[260px] lg:max-w-[300px]">
                        <button
                          type="button"
                          onClick={() => handlePlayZone(dailyFeatured)}
                          className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xl dark:border-white/15 dark:bg-[#0c0c14] cursor-pointer"
                          aria-label={`Launch ${dailyFeatured.name}`}
                        >
                          <img
                            src={resolveCoverUrl(dailyFeatured.cover, hasProxy)}
                            alt={dailyFeatured.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* Continue Playing */}
                {continuePlayingZones.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-violet-500" />
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                          Continue Playing
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateTo('history')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400 cursor-pointer"
                      >
                        <span>Full History</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className={`grid ${gridColsClass}`}>
                      {continuePlayingZones.map((zone) => (
                        <ZoneCard
                          key={zone.id}
                          zone={zone}
                          hasProxy={hasProxy}
                          isFavorite={favoriteSet.has(zone.id)}
                          plays={stats.year?.[String(zone.id)]}
                          cardSize={settings.cardSize}
                          animations={settings.animations && !effectiveReducedMotion}
                          onPlay={handlePlayZone}
                          onToggleFavorite={handleToggleFavorite}
                          onShowInfo={setInfoZone}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Trending Now */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-violet-500" />
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                        {hasVerifiedStats ? 'Most Played Across the Library' : 'Featured Picks'}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy(hasVerifiedStats ? 'popular' : 'newest');
                        navigateTo('library');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400 cursor-pointer"
                    >
                      <span>Explore All</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className={`grid ${gridColsClass}`}>
                    {trendingZones.map((zone) => (
                      <ZoneCard
                        key={zone.id}
                        zone={zone}
                        hasProxy={hasProxy}
                        isFavorite={favoriteSet.has(zone.id)}
                        plays={stats.year?.[String(zone.id)]}
                        cardSize={settings.cardSize}
                        animations={settings.animations && !effectiveReducedMotion}
                        onPlay={handlePlayZone}
                        onToggleFavorite={handleToggleFavorite}
                        onShowInfo={setInfoZone}
                      />
                    ))}
                  </div>
                </section>

                {/* Popular Categories Quick Directory */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Grid2x2 className="h-5 w-5 text-violet-500" />
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                        Browse by Genre
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo('categories')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400 cursor-pointer"
                    >
                      <span>All {CATEGORIES.length} Categories</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {CATEGORIES.slice(0, 10).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => openCategoryInLibrary(cat.id)}
                        className="flex flex-col items-start rounded-2xl border border-slate-200/90 bg-white p-4 text-left hover:border-violet-400/50 dark:border-white/10 dark:bg-[#12121b] dark:hover:border-violet-400/40 cursor-pointer"
                      >
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {cat.label}
                        </span>
                        <span className="mt-1 font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                          {categoryCounts.get(cat.id) || 0} games
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Personalized Recommendations */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Compass className="h-5 w-5 text-violet-500" />
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                          Recommended for You
                        </h2>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Matched locally using your favorites, recent launches, and preferred genres.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo('discover')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400 cursor-pointer"
                    >
                      <span>Discovery Hub</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className={`grid ${gridColsClass}`}>
                    {recommendedZones.map((zone) => (
                      <ZoneCard
                        key={zone.id}
                        zone={zone}
                        hasProxy={hasProxy}
                        isFavorite={favoriteSet.has(zone.id)}
                        plays={stats.year?.[String(zone.id)]}
                        cardSize={settings.cardSize}
                        animations={settings.animations && !effectiveReducedMotion}
                        onPlay={handlePlayZone}
                        onToggleFavorite={handleToggleFavorite}
                        onShowInfo={setInfoZone}
                      />
                    ))}
                  </div>
                </section>

                {/* New Additions */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-violet-500" />
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                        Recent Catalog Additions
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy('newest');
                        setRecentAddedOnly(true);
                        navigateTo('library');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400 cursor-pointer"
                    >
                      <span>See Latest 60</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className={`grid ${gridColsClass}`}>
                    {newestZones.map((zone) => (
                      <ZoneCard
                        key={zone.id}
                        zone={zone}
                        hasProxy={hasProxy}
                        isFavorite={favoriteSet.has(zone.id)}
                        plays={stats.year?.[String(zone.id)]}
                        cardSize={settings.cardSize}
                        animations={settings.animations && !effectiveReducedMotion}
                        onPlay={handlePlayZone}
                        onToggleFavorite={handleToggleFavorite}
                        onShowInfo={setInfoZone}
                      />
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ALL GAMES LIBRARY VIEW */}
            {activePage === 'library' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      Game Library
                    </h1>
                    <p className="mt-1 font-mono-tabular text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      Showing {filteredZones.length} of {zones.length} games
                      {selectedCategories.length > 0 &&
                        ` · ${selectedCategories
                          .map((c) => CATEGORY_MAP[c]?.label || c)
                          .join(', ')}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFavoritesOnly((v) => !v);
                        setVisibleCount(PAGE_BATCH);
                      }}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold cursor-pointer ${
                        favoritesOnly
                          ? 'border-pink-500 bg-pink-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200'
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
                      <span>Favorites Only</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRecentAddedOnly((v) => !v);
                        setVisibleCount(PAGE_BATCH);
                      }}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold cursor-pointer ${
                        recentAddedOnly
                          ? 'border-violet-500 bg-violet-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200'
                      }`}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Latest 60</span>
                    </button>

                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <span className="sr-only">Sort library</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 dark:border-white/15 dark:bg-[#151521] dark:text-slate-100"
                      >
                        {hasVerifiedStats && <option value="popular">Sort: Popular</option>}
                        <option value="newest">Sort: Newest Added</option>
                        <option value="nameAsc">Sort: Name A–Z</option>
                        <option value="nameDesc">Sort: Name Z–A</option>
                        <option value="category">Sort: Category</option>
                        <option value="favorites">Sort: Favorites First</option>
                      </select>
                    </label>
                  </div>
                </div>

                {/* Multi-Category Filter Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Filter className="h-3.5 w-3.5" />
                      <span>Filter by Categories (multi-select)</span>
                    </span>
                    {(selectedCategories.length > 0 || favoritesOnly || recentAddedOnly || search) && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="inline-flex items-center gap-1 font-semibold text-violet-600 hover:underline dark:text-violet-400 cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reset All Filters</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => {
                      const active = selectedCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategoryFilter(cat.id)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                            active
                              ? 'border-violet-500 bg-violet-600 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/10'
                          }`}
                        >
                          {cat.label}
                          <span className="ml-1.5 font-mono-tabular opacity-65">
                            {categoryCounts.get(cat.id) || 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {filteredZones.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-white/10 dark:bg-[#12121b]">
                    <Gamepad2 className="mx-auto h-10 w-10 text-slate-400" />
                    <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                      No games match those filters
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Try clearing your search query or selecting fewer category filters.
                    </p>
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-5 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Clear Filters</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={`grid ${gridColsClass}`}>
                      {filteredZones.slice(0, visibleCount).map((zone) => (
                        <ZoneCard
                          key={zone.id}
                          zone={zone}
                          hasProxy={hasProxy}
                          isFavorite={favoriteSet.has(zone.id)}
                          plays={stats.year?.[String(zone.id)]}
                          cardSize={settings.cardSize}
                          animations={settings.animations && !effectiveReducedMotion}
                          onPlay={handlePlayZone}
                          onToggleFavorite={handleToggleFavorite}
                          onShowInfo={setInfoZone}
                        />
                      ))}
                    </div>

                    {visibleCount < filteredZones.length && (
                      <div className="flex justify-center pt-4">
                        <button
                          type="button"
                          onClick={() => setVisibleCount((n) => n + PAGE_BATCH)}
                          className="h-11 rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 cursor-pointer"
                        >
                          Load More ({filteredZones.length - visibleCount} remaining)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* CATEGORIES DIRECTORY VIEW */}
            {activePage === 'categories' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Categories &amp; Collections
                  </h1>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Explore {zones.length} games organized cleanly across {CATEGORIES.length} genres and runtime formats.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {CATEGORIES.map((cat) => {
                    const count = categoryCounts.get(cat.id) || 0;
                    const sample = zones
                      .filter((z) => z.categories.includes(cat.id))
                      .slice(0, 3)
                      .map((z) => z.name);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => openCategoryInLibrary(cat.id)}
                        className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 text-left transition-colors hover:border-violet-400/50 dark:border-white/10 dark:bg-[#12121b] dark:hover:border-violet-400/40 cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="text-base font-bold text-slate-900 group-hover:text-violet-600 dark:text-white dark:group-hover:text-violet-300">
                              {cat.label}
                            </h2>
                            <span className="font-mono-tabular text-xs font-semibold text-violet-600 dark:text-violet-400">
                              {count} games
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            {cat.description}
                          </p>
                        </div>
                        {sample.length > 0 && (
                          <p className="mt-4 truncate border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-white/5 dark:text-slate-400">
                            Includes: {sample.join(', ')}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DISCOVER VIEW */}
            {activePage === 'discover' && (
              <div className="space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      Discover Something New
                    </h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Daily featured pick, personalized suggestions, and quick random discovery.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDiscoverRollNonce((n) => n + 1)}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Shuffle Picks</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRandomPlay}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      <span>Play Random Game</span>
                    </button>
                  </div>
                </div>

                {dailyFeatured && (
                  <section className="rounded-2xl border border-violet-500/30 bg-violet-500/[0.06] p-5 sm:p-6 dark:bg-violet-500/[0.08]">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <img
                          src={resolveCoverUrl(dailyFeatured.cover, hasProxy)}
                          alt={dailyFeatured.name}
                          referrerPolicy="no-referrer"
                          className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/15"
                        />
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                            Today&apos;s Spotlight
                          </span>
                          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            {dailyFeatured.name}
                          </h2>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {dailyFeatured.primaryCategoryLabel}
                            {dailyFeatured.author ? ` · ${dailyFeatured.author}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePlayZone(dailyFeatured)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-5 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Launch Spotlight</span>
                      </button>
                    </div>
                  </section>
                )}

                <section className="space-y-4">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Tailored For Your Shelf
                  </h2>
                  <div className={`grid ${gridColsClass}`}>
                    {recommendedZones.map((zone) => (
                      <ZoneCard
                        key={zone.id}
                        zone={zone}
                        hasProxy={hasProxy}
                        isFavorite={favoriteSet.has(zone.id)}
                        plays={stats.year?.[String(zone.id)]}
                        cardSize={settings.cardSize}
                        animations={settings.animations && !effectiveReducedMotion}
                        onPlay={handlePlayZone}
                        onToggleFavorite={handleToggleFavorite}
                        onShowInfo={setInfoZone}
                      />
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Random Discovery Mix
                  </h2>
                  <div className={`grid ${gridColsClass}`}>
                    {surprisePicks.map((zone) => (
                      <ZoneCard
                        key={zone.id}
                        zone={zone}
                        hasProxy={hasProxy}
                        isFavorite={favoriteSet.has(zone.id)}
                        plays={stats.year?.[String(zone.id)]}
                        cardSize={settings.cardSize}
                        animations={settings.animations && !effectiveReducedMotion}
                        onPlay={handlePlayZone}
                        onToggleFavorite={handleToggleFavorite}
                        onShowInfo={setInfoZone}
                      />
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* FAVORITES VIEW */}
            {activePage === 'favorites' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      Your Favorites
                    </h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-mono-tabular">{favoriteZones.length}</span> saved games stored locally in your browser.
                    </p>
                  </div>
                </div>

                {favoriteZones.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-white/10 dark:bg-[#12121b]">
                    <Heart className="mx-auto h-10 w-10 text-pink-500/70" />
                    <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                      No favorites saved yet
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Tap the heart icon on any game card to pin it here for quick access.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigateTo('library')}
                      className="mt-4 inline-flex h-10 items-center rounded-xl bg-violet-600 px-5 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
                    >
                      Browse Library
                    </button>
                  </div>
                ) : (
                  <div className={`grid ${gridColsClass}`}>
                    {favoriteZones.map((zone) => (
                      <ZoneCard
                        key={zone.id}
                        zone={zone}
                        hasProxy={hasProxy}
                        isFavorite
                        plays={stats.year?.[String(zone.id)]}
                        cardSize={settings.cardSize}
                        animations={settings.animations && !effectiveReducedMotion}
                        onPlay={handlePlayZone}
                        onToggleFavorite={handleToggleFavorite}
                        onShowInfo={setInfoZone}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PLAY HISTORY VIEW */}
            {activePage === 'history' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      Recently Played
                    </h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Your chronological play log across this browser ({playHistory.length} unique titles).
                    </p>
                  </div>
                  {playHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setConfirmClearHistory(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Clear History</span>
                    </button>
                  )}
                </div>

                {playHistory.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-white/10 dark:bg-[#12121b]">
                    <History className="mx-auto h-10 w-10 text-slate-400" />
                    <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                      No play history yet
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Games you launch will appear here with timestamps and play counts.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigateTo('library')}
                      className="mt-4 inline-flex h-10 items-center rounded-xl bg-violet-600 px-5 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
                    >
                      Launch a Game
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200/80 overflow-hidden rounded-2xl border border-slate-200/90 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#12121b]">
                    {playHistory.map((entry) => {
                      const z = byId.get(entry.id);
                      if (!z) return null;
                      return (
                        <div
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-4 p-3.5 sm:px-5"
                        >
                          <div className="flex min-w-0 items-center gap-3.5">
                            <img
                              src={resolveCoverUrl(z.cover, hasProxy)}
                              alt={z.name}
                              referrerPolicy="no-referrer"
                              className="h-12 w-12 shrink-0 rounded-xl object-cover bg-slate-100 dark:bg-white/5"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                                {z.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {z.primaryCategoryLabel} ·{' '}
                                <span className="font-mono-tabular">
                                  {entry.playCount} {entry.playCount === 1 ? 'play' : 'plays'}
                                </span>{' '}
                                · {new Date(entry.lastPlayedAt).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(z.id)}
                              aria-label={
                                favoriteSet.has(z.id)
                                  ? `Unfavorite ${z.name}`
                                  : `Favorite ${z.name}`
                              }
                              className={`flex h-9 w-9 items-center justify-center rounded-xl border cursor-pointer ${
                                favoriteSet.has(z.id)
                                  ? 'border-pink-400/50 bg-pink-500/15 text-pink-500'
                                  : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5'
                              }`}
                            >
                              <Heart
                                className={`h-4 w-4 ${
                                  favoriteSet.has(z.id) ? 'fill-current' : ''
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePlayZone(z)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
                            >
                              <Play className="h-3.5 w-3.5 fill-current" />
                              <span>Play Again</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STATS, ACHIEVEMENTS & FEEDBACK VIEW */}
            {activePage === 'stats' && (
              <StatsAndFeedbackView
                zones={zones}
                history={playHistory}
                favorites={favorites}
                searchHistory={searchHistory}
                visitDays={visitDays}
                achievements={achievements}
                feedbackLog={feedbackLog}
                hasProxy={hasProxy}
                onSaveFeedbackDraft={(draft) => {
                  const next = [draft, ...feedbackLog].slice(0, 20);
                  setFeedbackLog(next);
                  saveFeedbackLog(next);
                }}
                onPlayZone={handlePlayZone}
                onToast={addToast}
              />
            )}
          </>
        )}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/70 py-6 text-xs text-slate-500 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0a11]/80 dark:text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2.5">
            <img
              src={assetPath('assets/daknux/logo.png')}
              alt=""
              className="h-6 w-6 rounded-md object-cover"
            />
            <span>
              <strong className="text-slate-800 dark:text-slate-200">DAKNUX</strong> ·{' '}
              <span className="font-mono-tabular">{zones.length}</span> browser games ·{' '}
              {hasProxy ? 'Local Proxy Mode' : 'Static GitHub Pages Mode'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigateTo('library')}
              className="hover:text-violet-600 dark:hover:text-violet-300 cursor-pointer"
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => navigateTo('categories')}
              className="hover:text-violet-600 dark:hover:text-violet-300 cursor-pointer"
            >
              Categories
            </button>
            <button
              type="button"
              onClick={() => navigateTo('stats')}
              className="hover:text-violet-600 dark:hover:text-violet-300 cursor-pointer"
            >
              Stats &amp; Report Issue
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="hover:text-violet-600 dark:hover:text-violet-300 cursor-pointer"
            >
              Privacy &amp; Data
            </button>
          </div>
        </div>
      </footer>

      {/* Active Game Viewer */}
      {activeZone && !panicActive && (
        <ZoneViewer
          zone={activeZone}
          hasProxy={hasProxy}
          isFavorite={favoriteSet.has(activeZone.id)}
          cloakTitle={settings.customCloakTitle.trim() || activeCloak.title}
          cloakFavicon={activeCloak.favicon}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setActiveZone(null)}
          onShowInfo={setInfoZone}
        />
      )}

      {/* Info Modal */}
      <InfoModal
        zone={infoZone}
        hasProxy={hasProxy}
        stats={stats}
        isFavorite={infoZone ? favoriteSet.has(infoZone.id) : false}
        onToggleFavorite={handleToggleFavorite}
        onClose={() => setInfoZone(null)}
        onPlay={handlePlayZone}
      />

      {/* Settings & Personalization Modal */}
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onUpdate={setSettings}
        onClose={() => setSettingsOpen(false)}
        onClearScope={handleClearScope}
        onDataImported={handleDataImported}
        onToast={addToast}
      />

      {/* Clear History Dialog from History Page */}
      <ConfirmDialog
        open={confirmClearHistory}
        title="Clear play history?"
        description="This removes your recently played timeline and resets achievement unlock timestamps stored in this browser."
        confirmLabel="Clear History"
        onCancel={() => setConfirmClearHistory(false)}
        onConfirm={() => {
          handleClearScope('history');
          setConfirmClearHistory(false);
        }}
      />

      {panicActive && <PanicShield onExit={() => setPanicActive(false)} />}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
