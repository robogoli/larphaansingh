import type {
  AchievementStatus,
  AppSettings,
  CategoryId,
  EnrichedZone,
  FeedbackDraft,
  PlayHistoryEntry,
  SearchHistoryItem,
} from '../types/zone';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  cardSize: 'comfortable',
  gridDensity: 'standard',
  animations: true,
  soundEffects: false,
  backgroundStyle: 'obsidian',
  reducedMotion: false,
  preferredCategories: [],
  cloakId: 'default',
  customCloakTitle: '',
  panicKey: 'Backquote',
  showMarquee: true,
};

const KEYS = {
  settings: 'daknuxSettings',
  favorites: 'daknuxFavorites',
  history: 'daknuxPlayHistory',
  legacyRecents: 'daknuxRecents',
  searchHistory: 'daknuxSearchHistory',
  visitDays: 'daknuxVisitDays',
  searchUsed: 'daknuxSearchUsed',
  achievementsUnlockedAt: 'daknuxAchievementsUnlockedAt',
  feedbackLog: 'daknuxFeedbackLog',
};

export function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadSettings(): AppSettings {
  const stored = safeJsonParse<Partial<AppSettings>>(
    localStorage.getItem(KEYS.settings),
    {}
  );
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    preferredCategories: Array.isArray(stored.preferredCategories)
      ? (stored.preferredCategories as CategoryId[])
      : [],
  };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function loadFavorites(): number[] {
  const raw = safeJsonParse<unknown>(localStorage.getItem(KEYS.favorites), []);
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.filter((n): n is number => typeof n === 'number')));
}

export function saveFavorites(ids: number[]): void {
  localStorage.setItem(KEYS.favorites, JSON.stringify(Array.from(new Set(ids))));
}

export function loadPlayHistory(zones: EnrichedZone[]): PlayHistoryEntry[] {
  const parsed = safeJsonParse<unknown>(localStorage.getItem(KEYS.history), null);
  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is PlayHistoryEntry =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as PlayHistoryEntry).id === 'number' &&
        typeof (item as PlayHistoryEntry).name === 'string' &&
        typeof (item as PlayHistoryEntry).lastPlayedAt === 'string' &&
        typeof (item as PlayHistoryEntry).playCount === 'number'
    );
  }

  // Migrate legacy daknuxRecents number[] cleanly without losing history
  const legacy = safeJsonParse<unknown>(localStorage.getItem(KEYS.legacyRecents), []);
  if (!Array.isArray(legacy) || legacy.length === 0) return [];
  const byId = new Map(zones.map((z) => [z.id, z]));
  const now = new Date().toISOString();
  const migrated: PlayHistoryEntry[] = [];
  for (const id of legacy) {
    if (typeof id !== 'number') continue;
    const z = byId.get(id);
    if (!z) continue;
    migrated.push({ id: z.id, name: z.name, lastPlayedAt: now, playCount: 1 });
  }
  if (migrated.length > 0) {
    savePlayHistory(migrated);
  }
  return migrated;
}

export function savePlayHistory(entries: PlayHistoryEntry[]): void {
  localStorage.setItem(KEYS.history, JSON.stringify(entries.slice(0, 60)));
  // Keep legacy daknuxRecents synced for backward compatibility
  localStorage.setItem(
    KEYS.legacyRecents,
    JSON.stringify(entries.slice(0, 12).map((e) => e.id))
  );
}

export function loadSearchHistory(): SearchHistoryItem[] {
  const raw = safeJsonParse<unknown>(localStorage.getItem(KEYS.searchHistory), []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is SearchHistoryItem =>
      Boolean(x) &&
      typeof x === 'object' &&
      typeof (x as SearchHistoryItem).query === 'string' &&
      typeof (x as SearchHistoryItem).timestamp === 'string'
  );
}

export function saveSearchHistory(items: SearchHistoryItem[]): void {
  localStorage.setItem(KEYS.searchHistory, JSON.stringify(items.slice(0, 12)));
}

export function recordTodayVisit(): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const existing = safeJsonParse<unknown>(localStorage.getItem(KEYS.visitDays), []);
  const days = Array.isArray(existing)
    ? existing.filter((d): d is string => typeof d === 'string')
    : [];
  if (!days.includes(today)) {
    const next = [...days, today].slice(-90);
    localStorage.setItem(KEYS.visitDays, JSON.stringify(next));
    return next;
  }
  return days;
}

export function getSearchUsed(): boolean {
  return localStorage.getItem(KEYS.searchUsed) === '1';
}

export function markSearchUsed(): void {
  localStorage.setItem(KEYS.searchUsed, '1');
}

export function loadFeedbackLog(): FeedbackDraft[] {
  const raw = safeJsonParse<unknown>(localStorage.getItem(KEYS.feedbackLog), []);
  return Array.isArray(raw) ? (raw as FeedbackDraft[]) : [];
}

export function saveFeedbackLog(items: FeedbackDraft[]): void {
  localStorage.setItem(KEYS.feedbackLog, JSON.stringify(items.slice(0, 20)));
}

export function computeAchievements(
  zones: EnrichedZone[],
  history: PlayHistoryEntry[],
  favorites: number[],
  visitDays: string[],
  searchUsed: boolean
): AchievementStatus[] {
  const byId = new Map(zones.map((z) => [z.id, z]));
  const playedCategories = new Set<CategoryId>();
  for (const h of history) {
    const z = byId.get(h.id);
    if (z) playedCategories.add(z.primaryCategory);
  }

  const storedDates = safeJsonParse<Record<string, string>>(
    localStorage.getItem(KEYS.achievementsUnlockedAt),
    {}
  );
  const now = new Date().toISOString();
  let datesChanged = false;

  const rawList: Array<Omit<AchievementStatus, 'unlockedAt'>> = [
    {
      id: 'first_game',
      name: 'First Launch',
      description: 'Open and play your first game in LarphaanSingh.',
      conditionLabel: 'Play 1 game',
      unlocked: history.length >= 1,
      progress: Math.min(1, history.length),
      target: 1,
    },
    {
      id: 'explorer',
      name: 'Catalog Explorer',
      description: 'Try at least 5 unique games from the library.',
      conditionLabel: 'Open 5 unique games',
      unlocked: history.length >= 5,
      progress: Math.min(5, history.length),
      target: 5,
    },
    {
      id: 'collector',
      name: 'Game Collector',
      description: 'Save 5 favorites to build your personal shelf.',
      conditionLabel: 'Favorite 5 games',
      unlocked: favorites.length >= 5,
      progress: Math.min(5, favorites.length),
      target: 5,
    },
    {
      id: 'variety_player',
      name: 'Genre Hopper',
      description: 'Play games across 4 different genres or categories.',
      conditionLabel: 'Play 4 categories',
      unlocked: playedCategories.size >= 4,
      progress: Math.min(4, playedCategories.size),
      target: 4,
    },
    {
      id: 'regular_visitor',
      name: 'Regular Visitor',
      description: 'Visit LarphaanSingh on 3 separate calendar days.',
      conditionLabel: 'Visit on 3 days',
      unlocked: visitDays.length >= 3,
      progress: Math.min(3, visitDays.length),
      target: 3,
    },
    {
      id: 'discoverer',
      name: 'Discoverer',
      description: 'Use search or filters to discover games in the catalog.',
      conditionLabel: 'Search the library',
      unlocked: searchUsed,
      progress: searchUsed ? 1 : 0,
      target: 1,
    },
  ];

  const final = rawList.map((a) => {
    if (a.unlocked && !storedDates[a.id]) {
      storedDates[a.id] = now;
      datesChanged = true;
    }
    return {
      ...a,
      unlockedAt: a.unlocked ? storedDates[a.id] || now : null,
    };
  });

  if (datesChanged) {
    localStorage.setItem(KEYS.achievementsUnlockedAt, JSON.stringify(storedDates));
  }

  return final;
}

export function exportPersonalData(): string {
  return JSON.stringify(
    {
      app: 'LarphaanSingh',
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      localStorage: { ...localStorage },
    },
    null,
    2
  );
}

export function importPersonalData(jsonText: string): { ok: boolean; error?: string } {
  try {
    const parsed = JSON.parse(jsonText) as {
      localStorage?: Record<string, unknown>;
    };
    if (!parsed || typeof parsed !== 'object' || !parsed.localStorage || typeof parsed.localStorage !== 'object') {
      return { ok: false, error: 'Invalid backup format: missing localStorage object.' };
    }
    for (const [k, v] of Object.entries(parsed.localStorage)) {
      if (typeof v === 'string' && k.startsWith('daknux')) {
        localStorage.setItem(k, v);
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not parse backup JSON file.' };
  }
}

export function clearPersonalDataScope(
  scope: 'favorites' | 'history' | 'search' | 'preferences'
): void {
  if (scope === 'favorites') {
    localStorage.removeItem(KEYS.favorites);
  } else if (scope === 'history') {
    localStorage.removeItem(KEYS.history);
    localStorage.removeItem(KEYS.legacyRecents);
    localStorage.removeItem(KEYS.achievementsUnlockedAt);
  } else if (scope === 'search') {
    localStorage.removeItem(KEYS.searchHistory);
  } else if (scope === 'preferences') {
    localStorage.setItem(KEYS.settings, JSON.stringify(DEFAULT_SETTINGS));
  }
}
