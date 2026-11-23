export interface Zone {
  id: number;
  name: string;
  cover: string;
  url: string;
  author?: string;
  authorLink?: string;
  featured?: boolean;
  special?: string[];
}

export type CategoryId =
  | 'arcade'
  | 'action'
  | 'adventure'
  | 'puzzle'
  | 'racing'
  | 'sports'
  | 'strategy'
  | 'platformer'
  | 'simulation'
  | 'multiplayer'
  | 'casual'
  | 'retro'
  | 'flash'
  | 'tools';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  description: string;
  accent: string;
}

export interface EnrichedZone extends Zone {
  categories: CategoryId[];
  primaryCategory: CategoryId;
  primaryCategoryLabel: string;
  description: string;
  controlsHint: string;
  rawCoverUrl: string;
  rawSourceUrl: string;
  isValid: boolean;
  isEmbeddable: boolean;
}

export type NavPage =
  | 'home'
  | 'library'
  | 'categories'
  | 'discover'
  | 'favorites'
  | 'history'
  | 'stats';

export type SortOption =
  | 'nameAsc'
  | 'nameDesc'
  | 'newest'
  | 'popular'
  | 'category'
  | 'favorites';

export type StatsMap = {
  year?: Record<string, number>;
  month?: Record<string, number>;
  week?: Record<string, number>;
  day?: Record<string, number>;
};

export interface CloakPreset {
  id: string;
  label: string;
  title: string;
  favicon: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  cardSize: 'compact' | 'comfortable' | 'large';
  gridDensity: 'compact' | 'standard' | 'spacious';
  animations: boolean;
  soundEffects: boolean;
  backgroundStyle: 'obsidian' | 'cosmic' | 'midnight';
  reducedMotion: boolean;
  preferredCategories: CategoryId[];
  cloakId: string;
  customCloakTitle: string;
  panicKey: 'Backquote' | 'ShiftEscape' | 'F9';
  showMarquee: boolean;
}

export interface PlayHistoryEntry {
  id: number;
  name: string;
  lastPlayedAt: string;
  playCount: number;
}

export interface SearchHistoryItem {
  query: string;
  timestamp: string;
}

export type AchievementId =
  | 'first_game'
  | 'explorer'
  | 'collector'
  | 'variety_player'
  | 'regular_visitor'
  | 'discoverer';

export interface AchievementStatus {
  id: AchievementId;
  name: string;
  description: string;
  conditionLabel: string;
  unlocked: boolean;
  progress: number;
  target: number;
  unlockedAt: string | null;
}

export interface ToastItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
}

export interface FeedbackDraft {
  kind: 'broken_game' | 'suggest_game' | 'general';
  zoneName?: string;
  details: string;
  createdAt: string;
}
