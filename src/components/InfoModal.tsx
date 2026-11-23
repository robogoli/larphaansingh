import { Bug, ExternalLink, Heart, Play, ShieldCheck, User, X } from 'lucide-react';
import { CATEGORY_MAP, SPECIAL_TAG_LABELS } from '../data/categories';
import type { EnrichedZone, StatsMap } from '../types/zone';
import { resolveCoverUrl } from '../utils/runtime';

interface InfoModalProps {
  zone: EnrichedZone | null;
  hasProxy: boolean;
  stats: StatsMap;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
  onClose: () => void;
  onPlay: (zone: EnrichedZone) => void;
  onReportIssue: (zone: EnrichedZone) => void;
}

export default function InfoModal({
  zone,
  hasProxy,
  stats,
  isFavorite,
  onToggleFavorite,
  onClose,
  onPlay,
  onReportIssue,
}: InfoModalProps) {
  if (!zone) return null;

  const yearPlays = stats.year?.[String(zone.id)] || 0;
  const monthPlays = stats.month?.[String(zone.id)] || 0;
  const weekPlays = stats.week?.[String(zone.id)] || 0;
  const coverSrc = resolveCoverUrl(zone.cover, hasProxy);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-white/15 dark:bg-[#12121c] dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 border-b border-slate-200/80 p-5 dark:border-white/10">
          {coverSrc && (
            <img
              src={coverSrc}
              alt={`${zone.name} cover`}
              referrerPolicy="no-referrer"
              className="h-18 w-18 shrink-0 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/15"
            />
          )}
          <div className="min-w-0 flex-1">
            <h2 id="info-modal-title" className="text-lg font-bold leading-snug">
              {zone.name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {zone.categories.map((c) => CATEGORY_MAP[c]?.label || c).join(' · ')}
            </p>
            {zone.author && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                {zone.authorLink ? (
                  <a
                    href={zone.authorLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-violet-600 hover:underline dark:text-violet-400"
                  >
                    <span>{zone.author}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span>{zone.author}</span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close game details"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto space-y-4 p-5">
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {zone.description}
          </p>

          {zone.special && zone.special.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Platform &amp; Format
              </p>
              <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                {zone.special
                  .map((tag) => SPECIAL_TAG_LABELS[tag.toLowerCase()] || tag.toUpperCase())
                  .join(' · ')}
              </p>
            </div>
          )}

          {(yearPlays > 0 || monthPlays > 0 || weekPlays > 0) && (
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="font-mono-tabular text-base font-bold text-slate-900 dark:text-white">
                  {weekPlays.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">7-Day Hits</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="font-mono-tabular text-base font-bold text-slate-900 dark:text-white">
                  {monthPlays.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">30-Day Hits</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="font-mono-tabular text-base font-bold text-slate-900 dark:text-white">
                  {yearPlays.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Yearly Hits</div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Controls &amp; Input
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {zone.controlsHint}
            </p>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-slate-600 dark:text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span>
              {hasProxy
                ? 'Running with local LarphaanSingh streaming proxy enabled for asset compatibility.'
                : 'Static GitHub Pages mode: embeds source directly via standard browser iframe. Some external hosts may restrict framing.'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 px-5 py-3.5 dark:border-white/10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(zone.id)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold cursor-pointer ${
                isFavorite
                  ? 'border-pink-500/40 bg-pink-500/15 text-pink-600 dark:text-pink-300'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10'
              }`}
            >
              <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
              <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onReportIssue(zone);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 cursor-pointer"
            >
              <Bug className="h-3.5 w-3.5 text-amber-500" />
              <span>Report Issue</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onPlay(zone);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Launch Game</span>
          </button>
        </div>
      </div>
    </div>
  );
}
