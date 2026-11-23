import { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Bug,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  ExternalLink,
  Heart,
  Lock,
  Play,
  Send,
} from 'lucide-react';
import { CATEGORY_MAP } from '../data/categories';
import type {
  AchievementStatus,
  CategoryId,
  EnrichedZone,
  FeedbackDraft,
  PlayHistoryEntry,
  SearchHistoryItem,
} from '../types/zone';

interface StatsAndFeedbackViewProps {
  zones: EnrichedZone[];
  history: PlayHistoryEntry[];
  favorites: number[];
  searchHistory: SearchHistoryItem[];
  visitDays: string[];
  achievements: AchievementStatus[];
  feedbackLog: FeedbackDraft[];
  hasProxy: boolean;
  onSaveFeedbackDraft: (draft: FeedbackDraft) => void;
  onPlayZone: (zone: EnrichedZone) => void;
  onToast: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const GITHUB_ISSUES_NEW_URL = 'https://github.com/robogoli/larphaansingh/issues/new';

export default function StatsAndFeedbackView({
  zones,
  history,
  favorites,
  searchHistory,
  visitDays,
  achievements,
  feedbackLog,
  hasProxy,
  onSaveFeedbackDraft,
  onPlayZone,
  onToast,
}: StatsAndFeedbackViewProps) {
  const [kind, setKind] = useState<FeedbackDraft['kind']>('broken_game');
  const [zoneName, setZoneName] = useState('');
  const [details, setDetails] = useState('');

  const byId = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const metrics = useMemo(() => {
    const totalPlays = history.reduce((acc, h) => acc + h.playCount, 0);
    const catCounts = new Map<CategoryId, number>();

    for (const entry of history) {
      const z = byId.get(entry.id);
      if (!z) continue;
      catCounts.set(
        z.primaryCategory,
        (catCounts.get(z.primaryCategory) || 0) + entry.playCount
      );
    }

    const sortedCategories = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCategories[0]?.[0] || null;
    const maxCatCount = sortedCategories[0]?.[1] || 1;

    return {
      totalPlays,
      uniquePlayed: history.length,
      favoritesCount: favorites.length,
      searchCount: searchHistory.length,
      visitDaysCount: visitDays.length,
      topCategoryLabel: topCategory ? CATEGORY_MAP[topCategory]?.label || topCategory : 'None yet',
      categoryBreakdown: sortedCategories.slice(0, 6).map(([cat, count]) => ({
        id: cat,
        label: CATEGORY_MAP[cat]?.label || cat,
        count,
        pct: Math.round((count / maxCatCount) * 100),
      })),
    };
  }, [history, byId, favorites.length, searchHistory.length, visitDays.length]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  function buildReportBody(): string {
    const typeLabel =
      kind === 'broken_game'
        ? 'Broken Game Report'
        : kind === 'suggest_game'
          ? 'Game Suggestion'
          : 'General Feedback';
    return [
      `**Type:** ${typeLabel}`,
      zoneName.trim() ? `**Title:** ${zoneName.trim()}` : null,
      `**Runtime Mode:** ${hasProxy ? 'Express Proxy' : 'Static GitHub Pages'}`,
      `**Viewport:** ${window.innerWidth}x${window.innerHeight}`,
      '',
      '**Details:**',
      details.trim(),
    ]
      .filter(Boolean)
      .join('\n');
  }

  function handleSaveAndCopy() {
    if (details.trim().length < 8) {
      onToast('More detail needed', 'Please write at least 8 characters describing the issue or idea.', 'warning');
      return;
    }
    const draft: FeedbackDraft = {
      kind,
      zoneName: zoneName.trim() || undefined,
      details: details.trim(),
      createdAt: new Date().toISOString(),
    };
    onSaveFeedbackDraft(draft);
    const body = buildReportBody();
    navigator.clipboard?.writeText(body).catch(() => {});
    setDetails('');
    setZoneName('');
    onToast(
      'Saved locally & copied',
      'Report copied to clipboard and saved to your local log. Use Open GitHub Issue to submit publicly.',
      'success'
    );
  }

  function buildGitHubIssueHref(): string {
    const prefix =
      kind === 'broken_game' ? '[Broken Game]' : kind === 'suggest_game' ? '[Game Request]' : '[Feedback]';
    const title = `${prefix} ${zoneName.trim() || 'DAKNUX Platform'}`;
    const body = buildReportBody();
    const params = new URLSearchParams({ title, body });
    return `${GITHUB_ISSUES_NEW_URL}?${params.toString()}`;
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Personal Stats, Achievements &amp; Feedback
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Activity metrics and milestones are calculated strictly from your device&apos;s local browser history.
          </p>
        </div>
      </div>

      {/* Personal Stats Grid */}
      <section aria-labelledby="stats-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-violet-500" />
          <h2 id="stats-heading" className="text-lg font-bold text-slate-900 dark:text-white">
            Your Play Statistics
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Total Launches', value: metrics.totalPlays, icon: Play },
            { label: 'Unique Games', value: metrics.uniquePlayed, icon: CheckCircle2 },
            { label: 'Saved Favorites', value: metrics.favoritesCount, icon: Heart },
            { label: 'Days Visited', value: metrics.visitDaysCount, icon: Clock },
            { label: 'Top Genre', value: metrics.topCategoryLabel, icon: Award, isText: true },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#12121b]"
              >
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>{stat.label}</span>
                  <Icon className="h-4 w-4 text-violet-500" />
                </div>
                <div
                  className={`mt-2 truncate font-bold text-slate-900 dark:text-white ${
                    stat.isText ? 'text-base sm:text-lg' : 'font-mono-tabular text-2xl'
                  }`}
                >
                  {stat.value}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Category Breakdown */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-white/10 dark:bg-[#12121b]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Most Played Categories
            </h3>
            {metrics.categoryBreakdown.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Launch a few games to see your category breakdown appear here.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {metrics.categoryBreakdown.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-700 dark:text-slate-200">{item.label}</span>
                      <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                        {item.count} {item.count === 1 ? 'launch' : 'launches'}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-violet-600"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-white/10 dark:bg-[#12121b]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Activity
            </h3>
            {history.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                No games launched on this device yet.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
                {history.slice(0, 5).map((entry) => {
                  const zone = byId.get(entry.id);
                  return (
                    <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {entry.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                          {entry.playCount} {entry.playCount === 1 ? 'play' : 'plays'} · Last{' '}
                          {new Date(entry.lastPlayedAt).toLocaleDateString()}
                        </p>
                      </div>
                      {zone && (
                        <button
                          type="button"
                          onClick={() => onPlayZone(zone)}
                          className="h-8 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-violet-600 hover:text-white hover:border-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 cursor-pointer"
                        >
                          Play
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section aria-labelledby="achievements-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-violet-500" />
            <h2 id="achievements-heading" className="text-lg font-bold text-slate-900 dark:text-white">
              Local Milestones
            </h2>
          </div>
          <span className="font-mono-tabular text-xs font-semibold text-slate-500 dark:text-slate-400">
            {unlockedCount} / {achievements.length} Unlocked
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((ach) => {
            const pct = Math.min(100, Math.round((ach.progress / ach.target) * 100));
            return (
              <div
                key={ach.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  ach.unlocked
                    ? 'border-violet-500/40 bg-violet-500/[0.06] dark:bg-violet-500/[0.08]'
                    : 'border-slate-200/90 bg-white dark:border-white/10 dark:bg-[#12121b]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {ach.name}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {ach.description}
                    </p>
                  </div>
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      ach.unlocked
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-400 dark:bg-white/5'
                    }`}
                  >
                    {ach.unlocked ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <span>{ach.conditionLabel}</span>
                    <span className="font-mono-tabular">
                      {ach.progress} / {ach.target}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full ${
                        ach.unlocked ? 'bg-violet-500' : 'bg-slate-400 dark:bg-slate-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {ach.unlockedAt && (
                    <p className="text-[11px] text-violet-600 dark:text-violet-300">
                      Unlocked {new Date(ach.unlockedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Honest Feedback & Broken Game Reporting */}
      <section
        aria-labelledby="feedback-heading"
        className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 dark:border-white/10 dark:bg-[#12121b]"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
            <Bug className="h-5 w-5" />
          </div>
          <div>
            <h2 id="feedback-heading" className="text-lg font-bold text-slate-900 dark:text-white">
              Report an Issue or Suggest a Game
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Because DAKNUX runs on static GitHub Pages with no private telemetry backend, reports are formatted for direct submission via GitHub Issues or clipboard copy, and saved locally in your browser log.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'broken_game' as const, label: 'Report Broken Game' },
              { id: 'suggest_game' as const, label: 'Suggest a Game' },
              { id: 'general' as const, label: 'General Feedback' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setKind(tab.id)}
                className={`h-9 rounded-xl border px-3.5 text-xs font-semibold cursor-pointer ${
                  kind === tab.id
                    ? 'border-violet-500 bg-violet-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {kind === 'broken_game'
                  ? 'Game Title'
                  : kind === 'suggest_game'
                    ? 'Suggested Title'
                    : 'Topic (Optional)'}
              </span>
              <input
                type="text"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder={kind === 'broken_game' ? 'e.g., Slope or Moto X3M' : 'Title or topic...'}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/[0.04] dark:text-white"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Details
            </span>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what happened, what browser/device you used, or what feature you would like..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/[0.04] dark:text-white"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={buildGitHubIssueHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Open Pre-filled GitHub Issue</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              type="button"
              onClick={handleSaveAndCopy}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 cursor-pointer"
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              <span>Copy Diagnostic &amp; Save Draft</span>
            </button>
          </div>

          {feedbackLog.length > 0 && (
            <div className="mt-4 border-t border-slate-200/80 pt-3 dark:border-white/10">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Saved Drafts on This Device ({feedbackLog.length})
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                {feedbackLog.slice(0, 3).map((item, idx) => (
                  <li key={`${item.createdAt}-${idx}`} className="truncate">
                    <span className="font-semibold">
                      {item.zoneName ? `${item.zoneName}: ` : ''}
                    </span>
                    {item.details}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
