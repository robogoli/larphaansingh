import { ExternalLink, X } from 'lucide-react';
import type { StatsMap, Zone } from '../types/zone';

export type ModalKind =
  | { type: 'zone'; zone: Zone }
  | { type: 'credits' }
  | { type: 'privacy' }
  | null;

interface InfoModalProps {
  modal: ModalKind;
  stats: StatsMap;
  onClose: () => void;
}

export default function InfoModal({ modal, stats, onClose }: InfoModalProps) {
  if (!modal) return null;

  let title = 'Information';
  if (modal.type === 'zone') title = `${modal.zone.name} Info`;
  if (modal.type === 'credits') title = 'Credits & Information';
  if (modal.type === 'privacy') title = 'Privacy & Local Storage';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-[#3b2a5e] bg-white dark:bg-[#150d26] text-slate-900 dark:text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2e2050] bg-gradient-to-r from-[#581c87] to-[#7e22ce] px-5 py-3.5 text-white">
          <h2 className="truncate text-base font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 text-sm leading-relaxed">
          {modal.type === 'zone' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 dark:border-[#2e2050] bg-slate-50 dark:bg-[#1a0f2e] p-3.5">
                <div>
                  <div className="text-xs text-slate-500 dark:text-purple-300/75">Zone ID</div>
                  <div className="font-mono-tabular font-semibold">{modal.zone.id}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-purple-300/75">Global Plays</div>
                  <div className="font-mono-tabular font-semibold">
                    {(stats.year?.[String(modal.zone.id)] ?? 0).toLocaleString('en-US')}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-slate-500 dark:text-purple-300/75">Author</div>
                  <div className="font-semibold">{modal.zone.author || 'Community'}</div>
                </div>
                {modal.zone.special && modal.zone.special.length > 0 && (
                  <div className="col-span-2">
                    <div className="text-xs text-slate-500 dark:text-purple-300/75">Categories</div>
                    <div className="font-medium">{modal.zone.special.join(' · ')}</div>
                  </div>
                )}
              </div>

              {modal.zone.authorLink && (
                <a
                  href={modal.zone.authorLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline"
                >
                  <span>Visit Original Creator Page</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}

              <div className="rounded-xl border border-slate-200 dark:border-[#2e2050] bg-slate-50 dark:bg-[#1a0f2e] p-3.5 text-xs text-slate-600 dark:text-purple-200/80 space-y-1">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Hardware &amp; Control Tips
                </div>
                <p>
                  Click inside the game window once if keyboard keys do not respond immediately. On
                  phones or touch Chromebooks, enable <strong>Touch Pad</strong> in the top bar for
                  on-screen D-Pad &amp; Z/X/Space controls.
                </p>
              </div>
            </div>
          )}

          {modal.type === 'credits' && (
            <div className="space-y-3 text-slate-600 dark:text-purple-100/85">
              <p>
                Built as a fast, school-network-resilient replication of the{' '}
                <strong>DAKNUX</strong> catalog, inspired by <strong>gn-math</strong> and community
                web ports.
              </p>
              <p>
                All game covers, HTML wrappers, WebGL data chunks, and emulator cores are routed
                through a local same-origin proxy so restricted networks never block CDN domains.
              </p>
              <p className="text-xs text-slate-500 dark:text-purple-300/75">
                Disclaimer: DAKNUX is a non-commercial showcase of community HTML5 ports, ROM
                homebrew, and open-source web games. All trademarks belong to their respective
                creators.
              </p>
            </div>
          )}

          {modal.type === 'privacy' && (
            <div className="space-y-3 text-slate-600 dark:text-purple-100/85">
              <p>
                This application runs without third-party analytics trackers (no Google Analytics or
                ad scripts).
              </p>
              <p>
                Favorites, recently played games, theme preference, and Tab Cloak settings are
                stored exclusively in your browser&apos;s local storage and can be exported or
                cleared at any time from Settings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
