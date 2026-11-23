import type { CategoryId, CategoryMeta } from '../types/zone';

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'arcade',
    label: 'Arcade',
    description: 'Fast score-chasers, endless runners, and quick reflex challenges.',
    accent: 'from-violet-600/25 to-indigo-600/10',
  },
  {
    id: 'action',
    label: 'Action',
    description: 'Combat, shooters, boss battles, and high-tempo arena games.',
    accent: 'from-rose-600/25 to-orange-600/10',
  },
  {
    id: 'adventure',
    label: 'Adventure',
    description: 'Story-driven worlds, RPG ports, and exploration titles.',
    accent: 'from-amber-600/25 to-yellow-600/10',
  },
  {
    id: 'platformer',
    label: 'Platformer',
    description: 'Precision jumping, obstacle courses, and side-scrolling classics.',
    accent: 'from-sky-600/25 to-cyan-600/10',
  },
  {
    id: 'puzzle',
    label: 'Puzzle',
    description: 'Logic grids, physics contraptions, word & number games.',
    accent: 'from-emerald-600/25 to-teal-600/10',
  },
  {
    id: 'racing',
    label: 'Racing',
    description: 'Drift circuits, stunt tracks, and high-speed vehicular runs.',
    accent: 'from-orange-600/25 to-red-600/10',
  },
  {
    id: 'sports',
    label: 'Sports',
    description: 'Football, basketball, soccer, boxing, and arcade athletics.',
    accent: 'from-green-600/25 to-emerald-600/10',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    description: 'Tower defense, tactical positioning, and resource management.',
    accent: 'from-indigo-600/25 to-blue-600/10',
  },
  {
    id: 'simulation',
    label: 'Simulation',
    description: 'Life sims, crafting sandboxes, tycoons, and driving rigs.',
    accent: 'from-cyan-600/25 to-sky-600/10',
  },
  {
    id: 'multiplayer',
    label: 'Multiplayer',
    description: 'Local co-op, versus modes, and competitive arena builds.',
    accent: 'from-fuchsia-600/25 to-purple-600/10',
  },
  {
    id: 'casual',
    label: 'Casual',
    description: 'Rhythm, soundboards, idle clickers, and easy pick-up sessions.',
    accent: 'from-pink-600/25 to-rose-600/10',
  },
  {
    id: 'retro',
    label: 'Retro & Console',
    description: 'Emulated GBA, NES, SNES, Genesis, N64, DS, DOS, and PSX ROMs.',
    accent: 'from-purple-600/25 to-violet-600/10',
  },
  {
    id: 'flash',
    label: 'Flash Classics',
    description: 'Preserved browser Flash titles powered by the Ruffle runtime.',
    accent: 'from-yellow-600/25 to-amber-600/10',
  },
  {
    id: 'tools',
    label: 'Tools & Extras',
    description: 'Soundboards, utilities, and interactive creative toys.',
    accent: 'from-slate-600/25 to-zinc-600/10',
  },
];

export const CATEGORY_MAP: Record<CategoryId, CategoryMeta> = CATEGORIES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<CategoryId, CategoryMeta>
);

export const SPECIAL_TAG_LABELS: Record<string, string> = {
  port: 'Web Port',
  emulator: 'Console Emulator',
  flash: 'Flash (Ruffle)',
  fnf: 'Friday Night Funkin',
  incbox: 'Incredibox / Sprunki',
  gba: 'Game Boy Advance',
  fps: 'First-Person Shooter',
  nes: 'NES',
  dos: 'DOS',
  psx: 'PlayStation',
  nds: 'Nintendo DS',
  n64: 'Nintendo 64',
  tools: 'Utility / Tool',
  spanish: 'Spanish',
};
