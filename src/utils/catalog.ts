import { CATEGORY_MAP } from '../data/categories';
import type { CategoryId, EnrichedZone, PlayHistoryEntry, Zone } from '../types/zone';
import { resolveCoverUrl, resolveGameSourceUrl } from './runtime';

const KEYWORD_CATEGORY_RULES: Array<[RegExp, CategoryId]> = [
  [/\b(drift|race|racing|kart|moto|car|drive|truck|moto x3m|hill climb|polytrack|escape road)\b/i, 'racing'],
  [/\b(soccer|football|basketball|baseball|golf|tennis|hockey|boxing|retro bowl|fifa|nba|volley|cricket|sport)\b/i, 'sports'],
  [/\b(chess|sudoku|2048|tetris|wordle|puzzle|crossword|minesweeper|solitaire|mahjong|nonogram|unblock|portal|water sort|cut the rope|brain)\b/i, 'puzzle'],
  [/\b(bloons|tower defense|kingdom|empire|chess|civilization|clash|rts|strategy|polytopia|risk|plague|age of war)\b/i, 'strategy'],
  [/\b(simulator|tycoon|bitlife|papa'?s|cooking|farming|minecraft|eaglercraft|stardew|sandbox|flight|city|planet|universe)\b/i, 'simulation'],
  [/\b(2 player|2-player|multiplayer|1v1|io\b|versus|co-op|tag|rooftop snipers|getaway shootout|fireboy|watergirl)\b/i, 'multiplayer'],
  [/\b(mario|sonic|platform|celeste|geometry dash|super meat|vex|ovo|parkour|mario 64|hollow|shantae|shovel)\b/i, 'platformer'],
  [/\b(undertale|deltarune|zelda|pokemon|rpg|quest|adventure|omori|earthbound|chrono|hollow|dungeons)\b/i, 'adventure'],
  [/\b(shooter|fps|sniper|gun|doom|quake|ultrakill|combat|fight|street fighter|mortal|stickman|zombie|ninja|blade|action|brawl)\b/i, 'action'],
  [/\b(clicker|idle|cookie|flappy|fnf|funkin|sprunki|incredibox|rhythm|slope|run 3|temple|subway|crossy|stack|snake|pacman|pac-man)\b/i, 'casual'],
];

const KNOWN_FRAME_BLOCKED_DOMAINS = [
  'discord.gg',
  'discord.com',
  'github.com',
  'youtube.com',
  'youtu.be',
  'twitch.tv',
];

function inferCategories(zone: Zone): CategoryId[] {
  const cats = new Set<CategoryId>();
  const tags = (zone.special || []).map((t) => t.toLowerCase());
  const name = zone.name || '';

  if (tags.includes('tools')) {
    cats.add('tools');
  }
  if (tags.includes('flash')) {
    cats.add('flash');
  }
  if (tags.some((t) => ['emulator', 'gba', 'nes', 'dos', 'psx', 'nds', 'n64'].includes(t))) {
    cats.add('retro');
  }
  if (tags.includes('fps')) {
    cats.add('action');
  }
  if (tags.includes('fnf') || tags.includes('incbox')) {
    cats.add('casual');
  }

  for (const [pattern, cat] of KEYWORD_CATEGORY_RULES) {
    if (pattern.test(name)) {
      cats.add(cat);
    }
  }

  if (cats.size === 0) {
    cats.add('arcade');
  }
  return Array.from(cats);
}

function buildHonestDescription(zone: Zone, categories: CategoryId[]): string {
  const tags = (zone.special || []).map((t) => t.toLowerCase());
  const creator = zone.author ? `Created or ported by ${zone.author}.` : 'Community catalog release.';
  const categoryName = CATEGORY_MAP[categories[0]]?.label || 'Arcade';

  if (tags.includes('flash')) {
    return `${zone.name} is a preserved Flash title in the ${categoryName} collection, running locally in your browser via Ruffle. ${creator}`;
  }
  if (tags.some((t) => ['emulator', 'gba', 'nes', 'dos', 'psx', 'nds', 'n64'].includes(t))) {
    return `${zone.name} runs via browser-based retro emulation in the ${categoryName} library. ${creator}`;
  }
  if (tags.includes('tools')) {
    return `${zone.name} is an interactive browser utility or soundboard included in the DAKNUX collection. ${creator}`;
  }
  return `${zone.name} is a playable browser entry in the ${categoryName} catalog. ${creator}`;
}

function buildHonestControlsHint(zone: Zone): string {
  const tags = (zone.special || []).map((t) => t.toLowerCase());
  if (tags.includes('fnf')) {
    return 'Keyboard Arrow keys or WASD for rhythm notes. Click inside the game window first to focus keyboard input, or toggle Touch Pad on mobile.';
  }
  if (tags.some((t) => ['emulator', 'gba', 'nes', 'psx', 'nds', 'n64'].includes(t))) {
    return 'Supports keyboard bindings (Arrow keys, Z/X/Enter/Shift) or the built-in Touch Pad and emulator on-screen controls.';
  }
  if (tags.includes('flash')) {
    return 'Runs via Ruffle Flash emulation. Click once inside the player to activate audio and mouse or keyboard controls.';
  }
  if (tags.includes('fps')) {
    return 'Click inside the game canvas to lock pointer/mouse aim and use keyboard movement controls.';
  }
  return 'Uses standard browser mouse, keyboard, or touch controls depending on the game. Click the frame once if keys do not respond, or toggle Touch Pad for mobile.';
}

export function isValidSafeExternalUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isValidHttpOrRelativeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || /^javascript:/i.test(trimmed) || /^data:/i.test(trimmed)) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('./')) return true;
  return isValidSafeExternalUrl(trimmed);
}

export function isLikelyEmbeddableUrl(rawOriginalUrl: string, resolvedUrl: string): boolean {
  if (!isValidHttpOrRelativeUrl(resolvedUrl)) return false;
  if (rawOriginalUrl.startsWith('{HTML_URL}') || rawOriginalUrl.startsWith('{COVER_URL}')) {
    return true;
  }
  try {
    const parsed = new URL(resolvedUrl);
    const host = parsed.hostname.toLowerCase();
    if (KNOWN_FRAME_BLOCKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
      return false;
    }
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return resolvedUrl.startsWith('/') || resolvedUrl.startsWith('./');
  }
}

export function validateAndEnrichCatalog(rawZones: Zone[]): EnrichedZone[] {
  const seenIds = new Set<number>();
  const enriched: EnrichedZone[] = [];

  for (const item of rawZones) {
    if (!item || typeof item.id !== 'number' || Number.isNaN(item.id)) continue;
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);

    // Skip non-game promotional/utility entries (id -1 Discord link, -2 comments)
    if (item.id < 0) continue;

    const cleanName = typeof item.name === 'string' ? item.name.trim() : '';
    if (!cleanName) continue;

    const rawCoverUrl = resolveCoverUrl(item.cover || '', false);
    const rawSourceUrl = resolveGameSourceUrl(item.url || '');
    const isValid = isValidHttpOrRelativeUrl(rawSourceUrl);
    const isEmbeddable = isLikelyEmbeddableUrl(item.url || '', rawSourceUrl);
    const safeAuthorLink =
      item.authorLink && isValidSafeExternalUrl(item.authorLink) ? item.authorLink.trim() : undefined;

    const categories = inferCategories(item);
    const primaryCategory = categories[0];
    const primaryCategoryLabel = CATEGORY_MAP[primaryCategory]?.label || 'Arcade';

    enriched.push({
      ...item,
      authorLink: safeAuthorLink,
      name: cleanName,
      categories,
      primaryCategory,
      primaryCategoryLabel,
      description: buildHonestDescription(item, categories),
      controlsHint: buildHonestControlsHint(item),
      rawCoverUrl,
      rawSourceUrl,
      isValid,
      isEmbeddable,
    });
  }

  return enriched;
}

export function getDailyFeaturedZone(zones: EnrichedZone[]): EnrichedZone | null {
  const pool = zones.filter((z) => z.isValid && z.isEmbeddable && z.featured);
  const candidates = pool.length ? pool : zones.filter((z) => z.isValid && z.isEmbeddable);
  if (!candidates.length) return null;

  const today = new Date();
  const dateSeed =
    today.getUTCFullYear() * 10000 + (today.getUTCMonth() + 1) * 100 + today.getUTCDate();
  let hash = dateSeed * 2654435761;
  hash = ((hash >>> 16) ^ hash) >>> 0;
  return candidates[hash % candidates.length] || candidates[0];
}

export function getRecommendedZones(
  zones: EnrichedZone[],
  favorites: number[],
  history: PlayHistoryEntry[],
  preferredCategories: CategoryId[],
  limit = 12
): EnrichedZone[] {
  if (!zones.length) return [];

  const recentSet = new Set(history.slice(0, 8).map((h) => h.id));
  const favSet = new Set(favorites);
  const categoryWeights = new Map<CategoryId, number>();
  const tagWeights = new Map<string, number>();

  for (const cat of preferredCategories) {
    categoryWeights.set(cat, (categoryWeights.get(cat) || 0) + 4);
  }

  const byId = new Map(zones.map((z) => [z.id, z]));
  for (const favId of favorites) {
    const z = byId.get(favId);
    if (!z) continue;
    for (const c of z.categories) {
      categoryWeights.set(c, (categoryWeights.get(c) || 0) + 3);
    }
    for (const t of z.special || []) {
      tagWeights.set(t, (tagWeights.get(t) || 0) + 2);
    }
  }

  for (const entry of history.slice(0, 20)) {
    const z = byId.get(entry.id);
    if (!z) continue;
    const boost = Math.min(4, entry.playCount);
    for (const c of z.categories) {
      categoryWeights.set(c, (categoryWeights.get(c) || 0) + boost);
    }
    for (const t of z.special || []) {
      tagWeights.set(t, (tagWeights.get(t) || 0) + 1);
    }
  }

  const hasSignals = categoryWeights.size > 0 || tagWeights.size > 0;
  const candidates = zones.filter((z) => z.isValid && z.isEmbeddable && !recentSet.has(z.id));
  const pool = candidates.length >= limit ? candidates : zones.filter((z) => z.isValid);

  return [...pool]
    .sort((a, b) => {
      if (!hasSignals) {
        const featDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        if (featDiff !== 0) return featDiff;
        return b.id - a.id;
      }
      const score = (z: EnrichedZone) => {
        let s = z.featured ? 1.5 : 0;
        if (favSet.has(z.id)) s -= 1;
        for (const c of z.categories) s += categoryWeights.get(c) || 0;
        for (const t of z.special || []) s += tagWeights.get(t) || 0;
        return s;
      };
      return score(b) - score(a);
    })
    .slice(0, limit);
}
