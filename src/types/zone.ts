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

export type SortOption =
  | 'name'
  | 'id'
  | 'popular'
  | 'trendingDay'
  | 'trendingWeek'
  | 'trendingMonth';

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
  theme: 'dark' | 'light';
  cloakId: string;
  customCloakTitle: string;
  panicKey: 'Backquote' | 'ShiftEscape' | 'F9';
  showMarquee: boolean;
}
