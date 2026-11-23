import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Gamepad2,
  Info,
  Maximize2,
  RotateCcw,
  X,
} from 'lucide-react';
import type { Zone } from '../types/zone';
import TouchGamepad from './TouchGamepad';

interface ZoneViewerProps {
  zone: Zone;
  cloakTitle: string;
  cloakFavicon: string;
  onClose: () => void;
  onShowInfo: (zone: Zone) => void;
}

export default function ZoneViewer({
  zone,
  cloakTitle,
  cloakFavicon,
  onClose,
  onShowInfo,
}: ZoneViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingAssets, setDownloadingAssets] = useState(false);
  const [showGamepad, setShowGamepad] = useState(false);
  const [toolbarHidden, setToolbarHidden] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const gameSrc = `/api/game/${zone.id}?v=${reloadNonce}`;

  useEffect(() => {
    setLoading(true);
    setDownloadingAssets(false);
  }, [zone.id, reloadNonce]);

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
    if (!win) return;
    const absoluteGameUrl = `${window.location.origin}/api/game/${zone.id}`;
    const safeTitle = (cloakTitle || zone.name).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeIcon = cloakFavicon || '/assets/daknux/fav.png';
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
  <script>window.maeExportApis_ = window.maeExportApis_ || function(){};</script>
</head>
<body>
  <iframe src="${absoluteGameUrl}" allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write"></iframe>
</body>
</html>`);
    win.document.close();
  }

  function handleDownload() {
    const a = document.createElement('a');
    a.href = `/api/game/${zone.id}?download=1`;
    a.download = `${zone.name.replace(/[^a-zA-Z0-9._ -]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      className="fixed inset-0 z-50 flex flex-col bg-[#080510] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${zone.name}`}
    >
      {!toolbarHidden ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/25 bg-gradient-to-r from-[#4c1d95] via-[#6b21a8] to-[#7e22ce] px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-sm sm:text-base font-bold leading-tight text-white">
                  {zone.name}
                </h2>
                <button
                  type="button"
                  onClick={() => onShowInfo(zone)}
                  title="Zone info & controls"
                  aria-label="Zone information"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-white/15 hover:text-white cursor-pointer"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              {zone.author && (
                <p className="truncate text-xs text-purple-100/80">
                  by {zone.author}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowGamepad((v) => !v)}
              title="Toggle on-screen touch controls"
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                showGamepad
                  ? 'border-pink-300/60 bg-pink-500/75 text-white'
                  : 'border-white/25 bg-white/10 text-white hover:bg-white/20'
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20 shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleFullscreen}
              title="Fullscreen"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2.5 text-xs font-semibold text-white hover:bg-white/20 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Maximize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Fullscreen</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAboutBlank}
              title="Open cloaked in about:blank tab"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2.5 text-xs font-semibold text-white hover:bg-white/20 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden lg:inline">about:blank</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              title="Download offline HTML"
              aria-label="Download game HTML"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2.5 text-xs font-semibold text-white hover:bg-white/20 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span className="hidden lg:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={() => setToolbarHidden(true)}
              title="Minimize toolbar"
              aria-label="Hide toolbar"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20 shrink-0 cursor-pointer"
            >
              <ChevronUp className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close zone"
              className="flex h-9 items-center gap-1 rounded-lg border border-red-300/40 bg-red-500/75 px-3 text-xs font-semibold text-white hover:bg-red-500 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="h-4 w-4" />
              <span>Close</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setToolbarHidden(false)}
          className="fixed top-2 right-3 z-50 flex h-8 items-center gap-1 rounded-full border border-white/25 bg-black/70 px-3 text-xs font-medium text-white backdrop-blur-md hover:bg-purple-700 cursor-pointer"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          <span>Controls</span>
        </button>
      )}

      <div className="relative flex-1 w-full bg-black overflow-hidden">
        {(loading || downloadingAssets) && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#080510]/90 backdrop-blur-xs">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <p className="text-sm font-medium text-purple-200">
              {loading
                ? `Loading ${zone.name}...`
                : `Downloading ${zone.name} assets...`}
            </p>
            {!loading && downloadingAssets && (
              <button
                type="button"
                onClick={() => setDownloadingAssets(false)}
                className="pointer-events-auto rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-purple-100 hover:bg-white/20 cursor-pointer"
              >
                Show Game View
              </button>
            )}
          </div>
        )}

        <iframe
          ref={iframeRef}
          key={`${zone.id}-${reloadNonce}`}
          src={gameSrc}
          title={zone.name}
          allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write"
          onLoad={() => {
            setLoading(false);
            try {
              iframeRef.current?.focus();
              iframeRef.current?.contentWindow?.focus();
            } catch {
              // Ignore
            }
          }}
          className="h-full w-full border-0 bg-black"
        />

        {showGamepad && <TouchGamepad onKey={dispatchGamepadKey} />}
      </div>
    </div>
  );
}
