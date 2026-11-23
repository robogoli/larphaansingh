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

const TOUCH_BRIDGE_SCRIPT = `<script data-daknux-static-shim="1">
(function() {
  window.maeExportApis_ = window.maeExportApis_ || function(){};
  window.gadgets = window.gadgets || {
    util: { getUrlParameters: function() { return { exp_rpc_js: 1 }; } },
    rpc: { setRelayUrl: function(){}, call: function(){}, register: function(){} },
    io: { makeRequest: function(){} }
  };
  try {
    if (window.parent && window.parent !== window && !window.parent.maeExportApis_) {
      window.parent.maeExportApis_ = function(){};
    }
  } catch (e) {}
  function notifyReady() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'DAKNUX_FRAME_READY' }, '*');
      }
    } catch (e) {}
  }
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    notifyReady();
  } else {
    document.addEventListener('DOMContentLoaded', notifyReady);
  }
  window.addEventListener('load', notifyReady);
  window.addEventListener('message', function(ev) {
    if (!ev || !ev.data || ev.data.type !== 'DAKNUX_KEY_EVENT') return;
    var d = ev.data;
    var type = d.action === 'up' ? 'keyup' : 'keydown';
    var opts = { key: d.key, code: d.code, keyCode: d.keyCode, which: d.keyCode, bubbles: true, cancelable: true };
    try {
      var target = document.activeElement && document.activeElement !== document.body
        ? document.activeElement
        : (document.querySelector('canvas') || document.body || window);
      target.dispatchEvent(new KeyboardEvent(type, opts));
      window.dispatchEvent(new KeyboardEvent(type, opts));
    } catch (e) {}
  });
  window.addEventListener('pointerdown', function() {
    try { window.focus(); } catch (e) {}
  }, { passive: true });
})();
</script>`;

const EMPTY_JS_DATA = 'data:application/javascript;charset=utf-8,/*stub*/';
const EMPTY_CSS_DATA = 'data:text/css;charset=utf-8,/*stub*/';

function isRawCdnHtmlZone(zone: EnrichedZone): boolean {
  if (zone.url.startsWith('./')) return false;
  if (zone.url.startsWith('{HTML_URL}') || zone.url.startsWith('{COVER_URL}')) return true;
  try {
    const u = new URL(zone.rawSourceUrl);
    const h = u.hostname.toLowerCase();
    return (
      h === 'cdn.jsdelivr.net' ||
      h === 'fastly.jsdelivr.net' ||
      h === 'gcore.jsdelivr.net' ||
      h === 'raw.githubusercontent.com'
    );
  } catch {
    return false;
  }
}

function prepareStaticHtml(rawText: string, sourceUrl: string): string {
  let html = rawText;

  // Unwrap Google Gadget XML (<Module>...<Content type="html"><![CDATA[...]]></Content></Module>)
  if (/<Module\b/i.test(html)) {
    const cdataStart = html.indexOf('<![CDATA[');
    if (cdataStart !== -1) {
      html = html.slice(cdataStart + 9);
    } else {
      html = html.replace(/^(?:[\s\S]*?)<Module\b[^>]*>(?:\s*<!--[\s\S]*?-->\s*)*(?:<Module\b[^>]*>)?/i, '');
    }
    html = html.replace(/(?:\]\]>)?\s*(?:<\/Content>\s*)?(?:<\/Module>\s*)+$/i, '').trim();
  }

  // Fix Ruffle Flash templates with unresolved "$1" placeholder
  if (html.includes('player.load("$1")') || html.includes("player.load('$1')")) {
    const swfMatch = html.match(/(?:src|value)=(["'])(https?:\/\/[^"']+\.swf(?:\?[^"']*)?)\1/i);
    if (swfMatch && swfMatch[2]) {
      html = html.replace(/player\.load\((["'])\$1\1\)/g, `player.load(${JSON.stringify(swfMatch[2])})`);
    }
  }

  // Stub dead root-relative boilerplate and school-blocked trackers/ad pixels in static srcDoc mode
  html = html
    .replace(/\bsrc=(["'])\/(?:assets\/js\.js|js\/main\.js)\1/gi, `src=$1${EMPTY_JS_DATA}$1`)
    .replace(/\bhref=(["'])\/assets\/css\.css\1/gi, `href=$1${EMPTY_CSS_DATA}$1`)
    .replace(
      /\bsrc=(["'])(?:https?:)?\/\/[^"']*(?:google\.com\/jsapi|googletagmanager\.com|google-analytics\.com|googlesyndication\.com|doubleclick\.net|cloudflareinsights\.com|mediavine\.com|coi-serviceworker)[^"']*\1/gi,
      `src=$1${EMPTY_JS_DATA}$1`
    );

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

  const baseMatch = html.match(/<base\b[^>]*>/i);
  if (baseMatch && baseMatch.index !== undefined) {
    const insertAt = baseMatch.index + baseMatch[0].length;
    return `${html.slice(0, insertAt)}\n${TOUCH_BRIDGE_SCRIPT}\n${html.slice(insertAt)}`;
  }

  const injection = `<base href="${baseHref}" />\n${TOUCH_BRIDGE_SCRIPT}`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n${injection}`);
  }
  return `<!doctype html><html><head><meta charset="utf-8" />\n${injection}</head><body>${html}</body></html>`;
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
  const [allowEarlyReveal, setAllowEarlyReveal] = useState(false);
  const [showGamepad, setShowGamepad] = useState(false);
  const [toolbarHidden, setToolbarHidden] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [inlineHtml, setInlineHtml] = useState<string | null>(null);
  const [inlineBlobUrl, setInlineBlobUrl] = useState<string | null>(null);
  const [autoBridgeFailed, setAutoBridgeFailed] = useState(false);
  const [showEmbedHelp, setShowEmbedHelp] = useState(false);

  const isSelfHosted = zone.url.startsWith('./');
  const isKrillionLive = zone.id === 631 && hasProxy;
  const useProxyFrame = (hasProxy && !isSelfHosted) || isKrillionLive;
  const proxyGameSrc = isKrillionLive
    ? `/krillion-live/?v=${reloadNonce}`
    : `/api/game/${zone.id}?v=${reloadNonce}`;
  const blockedFromEmbed = !useProxyFrame && (!zone.isValid || !zone.isEmbeddable);
  const needsAutoStaticBridge = !useProxyFrame && !blockedFromEmbed && !isSelfHosted && isRawCdnHtmlZone(zone);

  useEffect(() => {
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    setLoading(!blockedFromEmbed);
    setDownloadingAssets(false);
    setAllowEarlyReveal(false);
    setInlineHtml(null);
    setInlineBlobUrl(null);
    setAutoBridgeFailed(false);
    setShowEmbedHelp(false);

    if (blockedFromEmbed) return;

    // Auto-bridge CDN raw text/plain HTML games via same-origin Blob URL on first entry in static mode
    if (needsAutoStaticBridge) {
      fetch(zone.rawSourceUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((raw) => {
          if (cancelled) return;
          const prepared = prepareStaticHtml(raw, zone.rawSourceUrl);
          createdBlobUrl = URL.createObjectURL(new Blob([prepared], { type: 'text/html;charset=utf-8' }));
          setInlineHtml(prepared);
          setInlineBlobUrl(createdBlobUrl);
        })
        .catch(() => {
          if (cancelled) return;
          setAutoBridgeFailed(true);
          setShowEmbedHelp(true);
        });
    }

    const revealBtnTimer = window.setTimeout(() => {
      if (!cancelled) setAllowEarlyReveal(true);
    }, 2000);

    // Safety fallback: never keep user trapped behind loading veil if a background subresource stalls
    const safetyRevealTimer = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5500);

    // Non-blocking tip only for third-party non-self-hosted pages in static mode if slow
    const helpTimer = !isSelfHosted
      ? window.setTimeout(() => {
          if (!cancelled) setShowEmbedHelp(true);
        }, 6500)
      : undefined;

    return () => {
      cancelled = true;
      window.clearTimeout(revealBtnTimer);
      window.clearTimeout(safetyRevealTimer);
      if (helpTimer !== undefined) window.clearTimeout(helpTimer);
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [zone.id, zone.rawSourceUrl, reloadNonce, blockedFromEmbed, needsAutoStaticBridge, isSelfHosted]);

  useEffect(() => {
    function onFrameMessage(ev: MessageEvent) {
      if (!ev?.data) return;
      if (ev.source !== iframeRef.current?.contentWindow) return;
      if (ev.data.type === 'DAKNUX_FRAME_READY') {
        setLoading(false);
        return;
      }
      if (ev.data.type === 'DAKNUX_FRAME_PROGRESS') {
        const activeCount = Number(ev.data.activeCount || 0);
        const hasVisual = Boolean(ev.data.hasVisual);
        if (hasVisual) setLoading(false);
        setDownloadingAssets(activeCount > 0 && !hasVisual);
      }
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
    const safeTitle = (cloakTitle || zone.name).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeIcon = cloakFavicon || assetPath('assets/gmail-icon.svg');

    if (!useProxyFrame && inlineHtml) {
      const titleTag = `<title>${safeTitle}</title><link rel="icon" href="${safeIcon}" />`;
      const docHtml = /<head[^>]*>/i.test(inlineHtml)
        ? inlineHtml.replace(/<head[^>]*>/i, (m) => `${m}${titleTag}`)
        : `${titleTag}${inlineHtml}`;
      win.document.open();
      win.document.write(docHtml);
      win.document.close();
      return;
    }

    const frameTarget = isKrillionLive
      ? `${window.location.origin}/krillion-live/`
      : useProxyFrame
        ? `${window.location.origin}/api/game/${zone.id}`
        : isSelfHosted
          ? new URL(zone.rawSourceUrl, window.location.href).href
          : zone.rawSourceUrl;

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
      const prepared = prepareStaticHtml(text, zone.rawSourceUrl);
      const blobUrl = URL.createObjectURL(new Blob([prepared], { type: 'text/html;charset=utf-8' }));
      setInlineHtml(prepared);
      setInlineBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return blobUrl;
      });
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
      let prepared = inlineHtml;
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
      {showEmbedHelp && !blockedFromEmbed && !hasProxy && !isSelfHosted && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-950/40 px-4 py-1.5 text-xs text-amber-200">
          <span>
            Blank screen? Some third-party hosts restrict embedding in static mode.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {!inlineBlobUrl && (
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
            {(allowEarlyReveal || (!loading && downloadingAssets)) && (
              <button
                type="button"
                onClick={() => {
                  setLoading(false);
                  setDownloadingAssets(false);
                }}
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
        ) : !useProxyFrame && needsAutoStaticBridge && !inlineBlobUrl && !autoBridgeFailed ? null : (
          <iframe
            ref={iframeRef}
            key={`${zone.id}-${reloadNonce}-${inlineBlobUrl ? 'inline' : useProxyFrame ? 'proxy' : 'direct'}`}
            src={useProxyFrame ? proxyGameSrc : inlineBlobUrl || zone.rawSourceUrl}
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
              if (!isSelfHosted) setShowEmbedHelp(true);
            }}
            className="h-full w-full border-0 bg-black"
          />
        )}

        {showGamepad && <TouchGamepad onKey={dispatchGamepadKey} />}
      </div>
    </div>
  );
}
