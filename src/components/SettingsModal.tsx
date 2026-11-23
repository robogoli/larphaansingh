import { useRef, useState } from 'react';
import {
  Download,
  Laptop,
  Moon,
  RotateCcw,
  Shield,
  Sun,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { CATEGORIES } from '../data/categories';
import { CLOAK_PRESETS } from '../data/cloaks';
import type { AppSettings, CategoryId } from '../types/zone';
import { exportPersonalData, importPersonalData } from '../utils/storage';
import ConfirmDialog from './ConfirmDialog';

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  onUpdate: (next: AppSettings) => void;
  onClose: () => void;
  onClearScope: (scope: 'favorites' | 'history' | 'search' | 'preferences') => void;
  onDataImported: () => void;
  onToast: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

type ClearScope = 'favorites' | 'history' | 'search' | 'preferences';

const CLEAR_LABELS: Record<ClearScope, { title: string; desc: string }> = {
  favorites: {
    title: 'Clear all saved favorites?',
    desc: 'This removes every game currently marked as a favorite on this device. This cannot be undone unless you have a JSON backup.',
  },
  history: {
    title: 'Clear play history & achievements?',
    desc: 'This deletes your local play history timeline and resets locally earned achievement unlock dates.',
  },
  search: {
    title: 'Clear search history?',
    desc: 'This clears all saved recent search queries from your browser storage.',
  },
  preferences: {
    title: 'Reset display & personalization preferences?',
    desc: 'Theme, layout density, preferred genres, cloak preset, and motion settings will revert to defaults.',
  },
};

export default function SettingsModal({
  open,
  settings,
  onUpdate,
  onClose,
  onClearScope,
  onDataImported,
  onToast,
}: SettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmScope, setConfirmScope] = useState<ClearScope | null>(null);

  if (!open) return null;

  function patch(partial: Partial<AppSettings>) {
    onUpdate({ ...settings, ...partial });
  }

  function togglePreferredCategory(cat: CategoryId) {
    const exists = settings.preferredCategories.includes(cat);
    const next = exists
      ? settings.preferredCategories.filter((c) => c !== cat)
      : [...settings.preferredCategories, cat];
    patch({ preferredCategories: next });
  }

  function handleExport() {
    const json = exportPersonalData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `larphaansingh-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onToast('Backup exported', 'Your settings, favorites, and play history downloaded as JSON.', 'success');
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importPersonalData(String(reader.result || ''));
      if (!result.ok) {
        onToast('Import failed', result.error || 'Invalid backup file.', 'error');
      } else {
        onDataImported();
        onToast('Backup imported', 'Your saved preferences and history were restored.', 'success');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={onClose}
      >
        <div
          className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-white/15 dark:bg-[#12121c] dark:text-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
            <div>
              <h2 id="settings-modal-title" className="text-lg font-bold">
                Personalization &amp; Data
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preferences save automatically to your browser storage.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 p-5">
            {/* Theme & Background */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Theme &amp; Backdrop
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'dark' as const, label: 'Dark', icon: Moon },
                  { id: 'light' as const, label: 'Light', icon: Sun },
                  { id: 'system' as const, label: 'System', icon: Laptop },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = settings.theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => patch({ theme: opt.id })}
                      className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                        active
                          ? 'border-violet-500 bg-violet-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'obsidian' as const, label: 'Obsidian Dark' },
                  { id: 'cosmic' as const, label: 'Cosmic Violet' },
                  { id: 'midnight' as const, label: 'Midnight Slate' },
                ].map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => patch({ backgroundStyle: bg.id })}
                    className={`h-9 rounded-xl border px-3 text-xs font-medium cursor-pointer ${
                      settings.backgroundStyle === bg.id
                        ? 'border-violet-500 bg-violet-500/15 text-violet-700 dark:text-violet-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Layout & Density */}
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Card Size
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['compact', 'comfortable', 'large'] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => patch({ cardSize: sz })}
                      className={`h-9 rounded-xl border text-xs font-medium capitalize cursor-pointer ${
                        settings.cardSize === sz
                          ? 'border-violet-500 bg-violet-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Grid Density
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['compact', 'standard', 'spacious'] as const).map((den) => (
                    <button
                      key={den}
                      type="button"
                      onClick={() => patch({ gridDensity: den })}
                      className={`h-9 rounded-xl border text-xs font-medium capitalize cursor-pointer ${
                        settings.gridDensity === den
                          ? 'border-violet-500 bg-violet-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                      }`}
                    >
                      {den}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Toggles: Animations, Reduced Motion, Sound Effects, Marquee */}
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Feedback &amp; Motion
              </h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {[
                  {
                    key: 'animations' as const,
                    label: 'UI Hover Animations',
                    desc: 'Subtle card lift and image zoom transitions',
                  },
                  {
                    key: 'reducedMotion' as const,
                    label: 'Reduced Motion',
                    desc: 'Minimize movement across menus and marquees',
                  },
                  {
                    key: 'soundEffects' as const,
                    label: 'Subtle Sound Effects',
                    desc: 'Soft Web Audio feedback on clicks and unlocks',
                  },
                  {
                    key: 'showMarquee' as const,
                    label: 'Show Community Ticker',
                    desc: 'Display rotating banner quotes above the fold',
                  },
                ].map((item) => {
                  const enabled = settings[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => patch({ [item.key]: !enabled })}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left dark:border-white/10 dark:bg-white/[0.03] cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          {item.key === 'soundEffects' && <Volume2 className="h-3.5 w-3.5 text-violet-500" />}
                          <span>{item.label}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {item.desc}
                        </p>
                      </div>
                      <span
                        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                          enabled ? 'bg-violet-600' : 'bg-slate-300 dark:bg-white/15'
                        }`}
                      >
                        <span
                          className={`h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                            enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Preferred Genres for Recommendations */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Preferred Genres (Tailors Recommendations)
                </h3>
                {settings.preferredCategories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => patch({ preferredCategories: [] })}
                    className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-400 cursor-pointer"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => {
                  const selected = settings.preferredCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => togglePreferredCategory(cat.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                        selected
                          ? 'border-violet-500 bg-violet-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Tab Cloak & Panic Shield */}
            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Shield className="h-3.5 w-3.5 text-violet-500" />
                <span>Tab Cloak &amp; Panic Shield</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Tab Preset
                  </span>
                  <select
                    value={settings.cloakId}
                    onChange={(e) => patch({ cloakId: e.target.value })}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-white/15 dark:bg-[#1a1a28] dark:text-white"
                  >
                    {CLOAK_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Panic Shortcut Key
                  </span>
                  <select
                    value={settings.panicKey}
                    onChange={(e) =>
                      patch({ panicKey: e.target.value as AppSettings['panicKey'] })
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-white/15 dark:bg-[#1a1a28] dark:text-white"
                  >
                    <option value="Backquote">Backtick / Tilde (`)</option>
                    <option value="ShiftEscape">Shift + Escape</option>
                    <option value="F9">F9 Key</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Custom Tab Title (Optional)
                </span>
                <input
                  type="text"
                  value={settings.customCloakTitle}
                  onChange={(e) => patch({ customCloakTitle: e.target.value })}
                  placeholder="Overrides preset tab title when non-empty..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-[#1a1a28] dark:text-white"
                />
              </label>
            </section>

            {/* Backup & Clear Data */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Backup &amp; Local Storage Management
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 cursor-pointer"
                >
                  <Download className="h-4 w-4 text-violet-500" />
                  <span>Export Data JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 cursor-pointer"
                >
                  <Upload className="h-4 w-4 text-violet-500" />
                  <span>Import Backup JSON</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>

              <div className="grid gap-2 pt-1 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setConfirmScope('favorites')}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 text-xs font-medium text-rose-600 hover:bg-rose-500/15 dark:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Favorites</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmScope('history')}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 text-xs font-medium text-rose-600 hover:bg-rose-500/15 dark:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Play History</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmScope('search')}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 text-xs font-medium text-rose-600 hover:bg-rose-500/15 dark:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Search History</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmScope('preferences')}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Preferences</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmScope !== null}
        title={confirmScope ? CLEAR_LABELS[confirmScope].title : ''}
        description={confirmScope ? CLEAR_LABELS[confirmScope].desc : ''}
        confirmLabel="Confirm Clear"
        destructive={confirmScope !== 'preferences'}
        onCancel={() => setConfirmScope(null)}
        onConfirm={() => {
          if (confirmScope) {
            onClearScope(confirmScope);
          }
          setConfirmScope(null);
        }}
      />
    </>
  );
}
