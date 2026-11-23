import { useRef } from 'react';
import {
  Download,
  ExternalLink,
  Moon,
  RefreshCw,
  Shield,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { CLOAK_PRESETS } from '../data/cloaks';
import type { AppSettings } from '../types/zone';

interface SettingsModalProps {
  settings: AppSettings;
  onUpdateSettings: (next: Partial<AppSettings>) => void;
  onRefreshZones: () => Promise<void>;
  onClose: () => void;
}

export default function SettingsModal({
  settings,
  onUpdateSettings,
  onRefreshZones,
  onClose,
}: SettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      localStorage: { ...localStorage },
      sessionStorage: { ...sessionStorage },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daknux-save-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        if (parsed.localStorage && typeof parsed.localStorage === 'object') {
          Object.entries(parsed.localStorage).forEach(([k, v]) => {
            if (typeof v === 'string') localStorage.setItem(k, v);
          });
        }
        if (parsed.sessionStorage && typeof parsed.sessionStorage === 'object') {
          Object.entries(parsed.sessionStorage).forEach(([k, v]) => {
            if (typeof v === 'string') sessionStorage.setItem(k, v);
          });
        }
        window.location.reload();
      } catch {
        // Ignore malformed JSON
      }
    };
    reader.readAsText(file);
  }

  function handleLaunchPortalAboutBlank() {
    const preset = CLOAK_PRESETS.find((c) => c.id === settings.cloakId) || CLOAK_PRESETS[1];
    const title = (settings.customCloakTitle || preset.title).replace(/</g, '&lt;');
    const win = window.open('about:blank', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="icon" href="${preset.favicon}" />
  <style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#080510;}iframe{border:0;width:100%;height:100%;display:block;}</style>
</head>
<body>
  <iframe src="${window.location.origin}/" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>
</body>
</html>`);
    win.document.close();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-[#3b2a5e] bg-white dark:bg-[#150d26] text-slate-900 dark:text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2e2050] bg-gradient-to-r from-[#581c87] to-[#7e22ce] px-5 py-4 text-white">
          <h2 className="text-lg font-bold">Settings &amp; School Stealth</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* Appearance */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-purple-300">
              Appearance &amp; Chromebook Performance
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#2e2050] bg-slate-50 dark:bg-[#1e1235] px-4 py-2.5 text-sm font-semibold hover:border-purple-500 cursor-pointer"
              >
                {settings.theme === 'dark' ? (
                  <>
                    <Moon className="h-4 w-4 text-purple-400" />
                    <span>Cosmic Dark</span>
                  </>
                ) : (
                  <>
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span>Crisp Light</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ showMarquee: !settings.showMarquee })}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#2e2050] bg-slate-50 dark:bg-[#1e1235] px-4 py-2.5 text-sm font-semibold hover:border-purple-500 cursor-pointer"
              >
                <span>Quote Banner: {settings.showMarquee ? 'On' : 'Off'}</span>
              </button>
            </div>
          </section>

          {/* Tab Cloak & Forsyth Bypass */}
          <section className="space-y-3 border-t border-slate-200 dark:border-[#2e2050] pt-5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-purple-300">
                Tab Cloak &amp; Panic Shield
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-purple-200/75">
              Disguises your browser tab title and icon for school-issued hardware. All games stream
              through the built-in same-origin proxy automatically.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {CLOAK_PRESETS.map((preset) => {
                const active = settings.cloakId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ cloakId: preset.id, customCloakTitle: '' })
                    }
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'border-purple-500 bg-purple-600/15 text-purple-700 dark:text-purple-200'
                        : 'border-slate-200 dark:border-[#2e2050] bg-slate-50 dark:bg-[#1e1235] hover:border-purple-400'
                    }`}
                  >
                    <img src={preset.favicon} alt="" className="h-4 w-4 shrink-0 rounded-xs" />
                    <span className="truncate">{preset.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-purple-200">
                  Custom Tab Title
                </label>
                <input
                  type="text"
                  value={settings.customCloakTitle}
                  onChange={(e) => onUpdateSettings({ customCloakTitle: e.target.value })}
                  placeholder="Optional custom title..."
                  className="h-10 w-full rounded-lg border border-slate-200 dark:border-[#2e2050] bg-slate-50 dark:bg-[#0f081b] px-3 text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-purple-200">
                  Study Shield Panic Key
                </label>
                <select
                  value={settings.panicKey}
                  onChange={(e) =>
                    onUpdateSettings({
                      panicKey: e.target.value as AppSettings['panicKey'],
                    })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 dark:border-[#2e2050] bg-slate-50 dark:bg-[#0f081b] px-3 text-sm focus:border-purple-500 focus:outline-none"
                >
                  <option value="Backquote">Backtick (`)</option>
                  <option value="ShiftEscape">Shift + Esc</option>
                  <option value="F9">F9 Key</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLaunchPortalAboutBlank}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white hover:bg-purple-700 transition-colors cursor-pointer"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open Full Portal in about:blank Tab</span>
            </button>
          </section>

          {/* Save Data & Catalog */}
          <section className="space-y-3 border-t border-slate-200 dark:border-[#2e2050] pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-purple-300">
              Save Data &amp; Catalog
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={handleExportData}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#2e2050] bg-slate-50 dark:bg-[#1e1235] px-3 text-xs font-semibold hover:border-purple-500 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Export Data</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#2e2050] bg-slate-50 dark:bg-[#1e1235] px-3 text-xs font-semibold hover:border-purple-500 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Import Data</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportData}
                className="hidden"
              />

              <button
                type="button"
                onClick={async () => {
                  await onRefreshZones();
                }}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#2e2050] bg-slate-50 dark:bg-[#1e1235] px-3 text-xs font-semibold hover:border-purple-500 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Sync Catalog</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
