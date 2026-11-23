import type { StatsMap, Zone } from '../types/zone';

export const UPSTREAM_COVERS_BASE = 'https://cdn.jsdelivr.net/gh/daknux/covers@main';
export const UPSTREAM_HTML_BASE = 'https://cdn.jsdelivr.net/gh/daknux/html@main';
export const UPSTREAM_STATS_BASE =
  'https://data.jsdelivr.com/v1/stats/packages/gh/daknux/html@main/files';

export function assetPath(relativePath: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanRel = relativePath.replace(/^\/+/, '');
  return `${cleanBase}${cleanRel}`;
}

export function resolveCoverUrl(rawCover: string, hasProxy: boolean): string {
  if (!rawCover || typeof rawCover !== 'string') return '';
  const expanded = rawCover
    .replace('{COVER_URL}', UPSTREAM_COVERS_BASE)
    .replace('{HTML_URL}', UPSTREAM_HTML_BASE)
    .trim();

  if (hasProxy) {
    return `/api/cover?src=${encodeURIComponent(rawCover)}`;
  }
  return expanded;
}

export function resolveGameSourceUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  return rawUrl
    .replace('{HTML_URL}', UPSTREAM_HTML_BASE)
    .replace('{COVER_URL}', UPSTREAM_COVERS_BASE)
    .trim();
}

export interface CatalogLoadResult {
  zones: Zone[];
  quotes: string[];
  stats: StatsMap;
  hasProxy: boolean;
}

async function fetchStatsFromJsDelivrPeriod(
  period: 'year' | 'month' | 'week' | 'day'
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const res = await fetch(`${UPSTREAM_STATS_BASE}?period=${period}&page=1&limit=100`);
    if (!res.ok) return out;
    const data = (await res.json()) as Array<{ name?: string; hits?: { total?: number } }>;
    if (!Array.isArray(data)) return out;
    for (const item of data) {
      if (!item?.name) continue;
      const m = item.name.match(/^\/(\d+)([.-])/);
      if (!m) continue;
      const id = m[1];
      out[id] = (out[id] || 0) + (item.hits?.total ?? 0);
    }
  } catch {
    // Graceful empty stats when offline or blocked
  }
  return out;
}

export async function loadCatalogRuntime(refresh = false): Promise<CatalogLoadResult> {
  const isSubpathStaticHost =
    (import.meta.env.BASE_URL || '/') !== '/' && !refresh;

  // 1. Try local Express proxy when served from root (/) in local/full-stack mode
  if (!isSubpathStaticHost) {
    try {
      const zonesRes = await fetch(refresh ? '/api/zones?refresh=1' : '/api/zones');
      const isProxy =
        zonesRes.ok &&
        zonesRes.headers.get('content-type')?.includes('application/json') &&
        zonesRes.headers.get('x-daknux-proxy') === '1';

      if (isProxy) {
        const [zonesData, quotesRes, statsRes] = await Promise.all([
          zonesRes.json() as Promise<Zone[]>,
          fetch('/api/quotes'),
          fetch('/api/stats'),
        ]);
        const quotes = quotesRes.ok ? ((await quotesRes.json()) as string[]) : [];
        const stats = statsRes.ok ? ((await statsRes.json()) as StatsMap) : {};
        return {
          zones: Array.isArray(zonesData) ? zonesData : [],
          quotes: Array.isArray(quotes) ? quotes : [],
          stats,
          hasProxy: true,
        };
      }
    } catch {
      // Expected on static host — fall through cleanly to bundled static catalog
    }
  }

  // 2. Static mode (GitHub Pages / vite preview): load bundled JSON assets
  const [zonesRes, quotesRes] = await Promise.all([
    fetch(assetPath('data/zones.json')),
    fetch(assetPath('data/quotes.json')),
  ]);

  if (!zonesRes.ok) {
    throw new Error('Unable to load bundled game catalog');
  }

  const rawZones = (await zonesRes.json()) as Zone[];
  const rawQuotes = quotesRes.ok ? await quotesRes.json() : [];
  const quotes = Array.isArray(rawQuotes)
    ? rawQuotes.map((q) => (typeof q === 'string' ? q : q?.text || q?.quote || String(q)))
    : [];

  // Fetch verified jsDelivr play counts directly (client-safe CORS endpoint)
  const [year, month, week, day] = await Promise.all([
    fetchStatsFromJsDelivrPeriod('year'),
    fetchStatsFromJsDelivrPeriod('month'),
    fetchStatsFromJsDelivrPeriod('week'),
    fetchStatsFromJsDelivrPeriod('day'),
  ]);

  return {
    zones: Array.isArray(rawZones) ? rawZones : [],
    quotes,
    stats: { year, month, week, day },
    hasProxy: false,
  };
}
