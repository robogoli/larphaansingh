import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Gamepad2,
  Heart,
  Info,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import type { EnrichedZone } from '../types/zone';
import { assetPath } from '../utils/runtime';
import TouchGamepad from './TouchGamepad';

interface ZoneViewerProps {
  zone: EnrichedZone;
  hasProxy: boolean;
  isFavorite: boolean;
  cloakTitle: string;
  cloakFavicon: string;
  onToggleFavorite: (id: number) => void;
  onClose: () => void;
  onShowInfo: (zone: EnrichedZone) => void;
  onReportIssue: (zone: EnrichedZone) => void;
  onToast: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const TOUCH_BRIDGE_SCRIPT = `<script>
(function() {
  window.maeExportApis_ = window.maeExportApis_ || function(){};
  window.addEventListener('message', function(ev) {
    if (!ev || !ev.data || ev.data.type !== 'DAKNUX_KEY_EVENT') return;
    var d = ev.data;
    var type = d.action === 'up' ? 'keyup' : 'keydown';
    var opts = { key: d.key, code: d.code, keyCode: d.keyCode, which: d.keyCode, bubbles: true, cancelable: true };
    try {
      window.dispatchEvent(new KeyboardEvent(type, opts));
      document.dispatchEvent(new KeyboardEvent(type, opts));
      if (document.activeElement) document.activeElement.dispatchEvent(new KeyboardEvent(type, opts));
    } catch (e) {}
  });
})();
</script>`;

function prepareStaticHtml(rawText: string, sourceUrl: string): string {
  let html = rawText;
  if (html.trimStart().startsWith('<Module')) {
    const match = html.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
    if (match?.[1]) {
      html = match[1];
    }
  }

  let baseHref = sourceUrl;
  try {
    const u = new URL(sourceUrl);
    const dir = u.pathname.endsWith('/')
      ? u.pathname
      : u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1);
    baseHref = `${u.origin}${dir}`;
  } catch {
    baseHref = sourceUrl;
  }

  const hasBaseTag = /<base\b/i.test(html);
  const injection = `${hasBaseTag ? '' : `<base href="${baseHref}" />`}${TOUCH_BRIDGE_SCRIPT}`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${injection}`);
  }
  return `<!doctype html><html><head><meta charset="utf-8" />${injection}</head><body>${html}</body></html>`;
}

export default function ZoneViewer({
  zone,
  hasProxy,
  isFavorite,
  cloakTitle,
  cloakFavicon,
  onToggleFavorite,
  onClose,
  onShowInfo,
  onReportIssue,
  onToast,
}: ZoneViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingAssets, setDownloadingAssets] = useState(false);
  const [showGamepad, setShowGamepad] = useState(false);
  const [toolbarHidden, setToolbarHidden] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [inlineSrcDoc, setInlineSrcDoc] = useState<string | null>(null);
  const [showEmbedHelp, setShowEmbedHelp] = useState(false);

  const isSelfHosted = zone.url.startsWith('./');
  const isKrillionLive = zone.id === 631 && hasProxy;
  const useProxyFrame = (hasProxy && !isSelfHosted) || isKrillionLive;
  const proxyGameSrc = isKrillionLive
    ? `/krillion-live/?v=${reloadNonce}`
    : `/api/game/${zone.id}?v=${reloadNonce}`;
  const blockedFromEmbed = !useProxyFrame && (!zone.isValid || !zone.isEmbeddable);

  useEffect(() => {
    setLoading(!blockedFromEmbed);
    setDownloadingAssets(false);
    setInlineSrcDoc(null);
    setShowEmbedHelp(false);

    if (blockedFromEmbed) return;

    // Gentle non-blocking timeout hint if a third-party site refuses framing or takes unusually long
    const timer = window.setTimeout(() => {
      setShowEmbedHelp(true);
    }, 6500);

    return () => window.clearTimeout(timer);
  }, [zone.id, reloadNonce, blockedFromEmbed]);

  useEffect(() => {
    function onFrameMessage(ev: MessageEvent) {
      if (!ev?.data || ev.data.type !== 'DAKNUX_FRAME_PROGRESS') return;
      if (ev.source !== iframeRef.current?.contentWindow) return;
      const activeCount = Number(ev.data.activeCount || 0);
      const hasVisual = Boolean(ev.data.hasVisual);
      setDownloadingAssets(activeCount > 0 && !hasVisual);
    }
    window.addEventListener('message', onFrameMessage);
    return () => window.removeEventListener('message', onFrameMessage);
  }, []);

  function handleFullscreen() {
    const target = iframeRef.current || containerRef.current;
    if (!target) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (target.requestFullscreen) {
      target.requestFullscreen().catch(() => {});
    }
  }

  function handleOpenAboutBlank() {
    const win = window.open('about:blank', '_blank');
    if (!win) {
      onToast('Popup blocked', 'Allow popups for this site to open games in an about:blank tab.', 'warning');
      return;
    }
    const frameTarget = isKrillionLive
      ? `${window.location.origin}/krillion-live/`
      : useProxyFrame
        ? `${window.location.origin}/api/game/${zone.id}`
        : zone.rawSourceUrl;
    const safeTitle = (cloakTitle || zone.name).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeIcon = cloakFavicon || assetPath('assets/gmail-icon.svg');
    win.document.open();
    win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <link rel="icon" href="${safeIcon}" />
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
    iframe { border: none; width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <iframe src="${frameTarget}" allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write"></iframe>
</body>
</html>`);
    win.document.close();
  }

  async function handleTryInlineBridge() {
    if (hasProxy || !zone.isValid) return;
    setLoading(true);
    try {
      const res = await fetch(zone.rawSourceUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setInlineSrcDoc(prepareStaticHtml(text, zone.rawSourceUrl));
      setShowEmbedHelp(false);
    } catch {
      setLoading(false);
      onToast(
        'Inline bridge unavailable for this host',
        'Use "Open Source" to launch in a new tab directly.',
        'warning'
      );
    }
  }

  async function handleDownload() {
    if (hasProxy) {
      const a = document.createElement('a');
      a.href = `/api/game/${zone.id}?download=1`;
      a.download = `${zone.name.replace(/[^a-zA-Z0-9._ -]/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    try {
      let prepared = inlineSrcDoc;
      if (!prepared) {
        const res = await fetch(zone.rawSourceUrl);
        if (!res.ok) throw new Error('Download blocked by remote host');
        const rawText = await res.text();
        prepared = prepareStaticHtml(rawText, zone.rawSourceUrl);
      }
      const blob = new Blob([prepared], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${zone.name.replace(/[^a-zA-Z0-9._ -]/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast('HTML downloaded', `${zone.name} saved cleanly.`, 'success');
    } catch {
      onToast(
        'Download restricted by host',
        'This external provider does not allow direct file saving; use "Open Source" instead.',
        'warning'
      );
    }
  }

  function dispatchGamepadKey(key: string, code: string, keyCode: number, action: 'down' | 'up') {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: 'DAKNUX_KEY_EVENT',
        key,
        code,
        keyCode,
        action,
      },
      '*'
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-[#08080e] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${zone.name}`}
    >
      {!toolbarHidden ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#12121d] px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/15 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-sm sm:text-base font-bold leading-tight text-white">
                  {zone.name}
                </h2>
                <button
                  type="button"
                  onClick={() => onShowInfo(zone)}
                  title="Game info & controls"
                  aria-label="Game information"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              <p className="truncate text-xs text-slate-400">
                {zone.primaryCategoryLabel}
                {zone.author ? ` · ${zone.author}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(zone.id)}
              title={isFavorite ? 'Remove favorite' : 'Save favorite'}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border shrink-0 cursor-pointer ${
                isFavorite
                  ? 'border-pink-400/50 bg-pink-600/80 text-white'
                  : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/15'
              }`}
            >
              <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setShowGamepad((v) => !v)}
              title="Toggle on-screen touch controls"
              className={`flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                showGamepad
                  ? 'border-violet-400/60 bg-violet-600 text-white'
                  : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/15'
              }`}
            >
              <Gamepad2 className="h-4 w-4" />
              <span className="hidden md:inline">Touch Pad</span>
            </button>

            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              title="Reload game"
              aria-label="Reload game"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-200 hover:bg-white/15 shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleFullscreen}
              title="Fullscreen"
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2.5 text-xs font-semibold text-slate-200 hover:bg-white/15 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Maximize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Fullscreen</span>
            </button>

            {zone.isValid && (
              <a
                href={zone.rawSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open original game source in new tab"
                className="flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2.5 text-xs font-semibold text-slate-200 hover:bg-white/15 whitespace-nowrap shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden lg:inline">Open Source</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleOpenAboutBlank}
              title="Open in about:blank tab"
              className="hidden sm:flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2.5 text-xs font-semibold text-slate-200 hover:bg-white/15 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="text-[11px] font-mono">about:blank</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              title="Download offline HTML"
              aria-label="Download game HTML"
              className="hidden md:flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2.5 text-xs font-semibold text-slate-200 hover:bg-white/15 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span className="hidden xl:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={() => onReportIssue(zone)}
              title="Report broken game"
              aria-label="Report broken game"
              className="flex h-9 items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bug className="h-4 w-4" />
              <span className="hidden lg:inline">Report</span>
            </button>

            <button
              type="button"
              onClick={() => setToolbarHidden(true)}
              title="Minimize toolbar"
              aria-label="Hide toolbar"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-200 hover:bg-white/15 shrink-0 cursor-pointer"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setToolbarHidden(false)}
          className="fixed top-2 right-3 z-50 flex h-8 items-center gap-1 rounded-full border border-white/20 bg-black/75 px-3 text-xs font-medium text-white backdrop-blur-md hover:bg-violet-700 cursor-pointer"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          <span>Controls</span>
        </button>
      )}

      {/* Helpful Static Hosting Notice when slow or third-party frame might be restricted */}
      {showEmbedHelp && !blockedFromEmbed && !hasProxy && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-950/40 px-4 py-1.5 text-xs text-amber-200">
          <span>
            Blank screen? Some third-party hosts restrict embedding in static mode.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {!inlineSrcDoc && (
              <button
                type="button"
                onClick={handleTryInlineBridge}
                className="font-semibold underline hover:text-white cursor-pointer"
              >
                Try Inline Bridge
              </button>
            )}
            <a
              href={zone.rawSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline hover:text-white"
            >
              Open Direct Link
            </a>
            <button
              type="button"
              onClick={() => onReportIssue(zone)}
              className="font-semibold underline hover:text-white cursor-pointer"
            >
              Report Broken
            </button>
            <button
              type="button"
              onClick={() => setShowEmbedHelp(false)}
              className="text-amber-300/75 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="relative flex-1 w-full bg-black overflow-hidden">
        {(loading || downloadingAssets) && !blockedFromEmbed && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#09090f]/92 backdrop-blur-xs">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            <p className="text-sm font-medium text-slate-200">
              {loading
                ? `Loading ${zone.name}...`
                : `Downloading ${zone.name} assets...`}
            </p>
            {!loading && downloadingAssets && (
              <button
                type="button"
                onClick={() => setDownloadingAssets(false)}
                className="pointer-events-auto rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-white/20 cursor-pointer"
              >
                Show Game View
              </button>
            )}
          </div>
        )}

        {blockedFromEmbed ? (
          <div className="flex h-full w-full items-center justify-center bg-[#0b0b12] p-6">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141420] p-6 text-center shadow-2xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">
                {!zone.isValid ? 'Invalid Game URL' : 'External Embedding Restricted'}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {!zone.isValid
                  ? 'This catalog entry does not have a valid http/https game source URL.'
                  : 'This provider prohibits iframe embedding in static browser mode. You can open it directly in a new tab or report the link.'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                {zone.isValid && (
                  <a
                    href={zone.rawSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open Source in New Tab</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onReportIssue(zone)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer"
                >
                  <Bug className="h-3.5 w-3.5 text-amber-400" />
                  <span>Report Broken Game</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 items-center rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer"
                >
                  Back to Library
                </button>
              </div>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            key={`${zone.id}-${reloadNonce}-${inlineSrcDoc ? 'inline' : useProxyFrame ? 'proxy' : 'direct'}`}
            src={useProxyFrame ? proxyGameSrc : inlineSrcDoc ? undefined : zone.rawSourceUrl}
            srcDoc={!useProxyFrame && inlineSrcDoc ? inlineSrcDoc : undefined}
            title={zone.name}
            referrerPolicy="no-referrer"
            allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write"
            onLoad={() => {
              setLoading(false);
              try {
                iframeRef.current?.focus();
                iframeRef.current?.contentWindow?.focus();
              } catch {
                // Cross-origin frame focus restriction expected on static external URLs
              }
            }}
            onError={() => {
              setLoading(false);
              setShowEmbedHelp(true);
            }}
            className="h-full w-full border-0 bg-black"
          />
        )}

        {showGamepad && <TouchGamepad onKey={dispatchGamepadKey} />}
      </div>
    </div>
  );
}
