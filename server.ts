import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import net from 'net';
import { Readable } from 'stream';
import type { ReadableStream as NodeWebReadableStream } from 'stream/web';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const DATA_DIR = path.resolve(__dirname, 'data');
const ZONES_LOCAL_PATH = path.join(DATA_DIR, 'zones.json');
const QUOTES_LOCAL_PATH = path.join(DATA_DIR, 'quotes.json');

const UPSTREAM_ZONES_URL = 'https://cdn.jsdelivr.net/gh/daknux/assets@latest/zones.json';
const UPSTREAM_COVERS_BASE = 'https://cdn.jsdelivr.net/gh/daknux/covers@main';
const UPSTREAM_HTML_BASE = 'https://cdn.jsdelivr.net/gh/daknux/html@main';

const BLOCKED_CLIENT_DOMAINS = [
  'deledao',
  'goguardian',
  'lightspeed',
  'linewize',
  'securly',
  'googletagmanager.com',
  'google-analytics.com',
  'doubleclick.net',
  'googlesyndication.com',
  'cloudflareinsights.com',
  'uca.cloud.unity3d.com',
  'cdp.cloud.unity3d.com',
  'perf-events.cloud.unity3d.com',
  'data-collect.unity3d.com',
  'analytics.unity3d.com',
  'adinplay.com',
  'cpmstar.com',
  'adnxs.com',
  'coi-serviceworker',
];

const JSON_TELEMETRY_DOMAINS = [
  'uca.cloud.unity3d.com',
  'cdp.cloud.unity3d.com',
  'perf-events.cloud.unity3d.com',
  'data-collect.unity3d.com',
  'analytics.unity3d.com',
];

const IMA_SDK_PATTERNS = ['imasdk.googleapis.com'];

interface ZoneEntry {
  id: number;
  name: string;
  cover: string;
  url: string;
  author?: string;
  authorLink?: string;
  featured?: boolean;
  special?: string[];
}

interface CacheItem {
  body: Buffer;
  contentType: string;
  status: number;
  timestamp: number;
}

// Bounded LRU cache for hot proxied assets (covers, JS, CSS, game HTMLs, Unity/WASM chunks)
const MAX_CACHE_BYTES = 256 * 1024 * 1024;
const MAX_SINGLE_CACHE_BYTES = 20 * 1024 * 1024;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const assetCache = new Map<string, CacheItem>();
let currentCacheBytes = 0;

function getCached(key: string): CacheItem | null {
  const item = assetCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    assetCache.delete(key);
    currentCacheBytes -= item.body.length;
    return null;
  }
  assetCache.delete(key);
  assetCache.set(key, item);
  return item;
}

function setCached(key: string, item: CacheItem): void {
  if (item.body.length > MAX_SINGLE_CACHE_BYTES) return;
  const existing = assetCache.get(key);
  if (existing) {
    currentCacheBytes -= existing.body.length;
    assetCache.delete(key);
  }
  while (currentCacheBytes + item.body.length > MAX_CACHE_BYTES && assetCache.size > 0) {
    const oldestKey = assetCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = assetCache.get(oldestKey);
    assetCache.delete(oldestKey);
    if (oldest) currentCacheBytes -= oldest.body.length;
  }
  assetCache.set(key, item);
  currentCacheBytes += item.body.length;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase();
    if (norm === '::1' || norm === '::') return true;
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true;
    if (norm.startsWith('fe80')) return true;
    if (norm.startsWith('::ffff:')) {
      return isPrivateIp(norm.slice(7));
    }
    return false;
  }
  return true;
}

async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Unsupported protocol');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.includes('metadata.google')
  ) {
    throw new Error('Forbidden host');
  }
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('Private IP forbidden');
    }
    return parsed;
  }
  const resolved = await dns.promises.lookup(hostname, { all: true });
  if (!resolved.length) {
    throw new Error('DNS resolution failed');
  }
  for (const entry of resolved) {
    if (isPrivateIp(entry.address)) {
      throw new Error('Private IP resolution forbidden');
    }
  }
  return parsed;
}

function toProxyPath(externalUrl: string): string {
  try {
    const u = new URL(externalUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return externalUrl;
    const proto = u.protocol.slice(0, -1);
    return `/api/ext/${proto}/${u.host}${u.pathname}${u.search}`;
  } catch {
    return externalUrl;
  }
}

function buildInjectedShim(): string {
  const blockedJson = JSON.stringify(BLOCKED_CLIENT_DOMAINS);
  const telemetryJson = JSON.stringify(JSON_TELEMETRY_DOMAINS);
  const imaJson = JSON.stringify(IMA_SDK_PATTERNS);
  return `<script data-daknux-shim="1">
(function() {
  if (window.__DAKNUX_SHIM__) return;
  window.__DAKNUX_SHIM__ = true;
  window.maeExportApis_ = window.maeExportApis_ || function(){};
  try {
    if (window.parent && window.parent !== window && !window.parent.maeExportApis_) {
      window.parent.maeExportApis_ = function(){};
    }
  } catch (e) {}

  var BLOCKED = ${blockedJson};
  var TELEMETRY = ${telemetryJson};
  var IMA_PATTERNS = ${imaJson};
  var ORIGIN = window.location.origin;

  function toStr(v) {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && typeof v.href === 'string') return v.href;
    return v;
  }

  function matchesList(u, list) {
    try {
      var s = String(toStr(u) || '').toLowerCase();
      for (var i = 0; i < list.length; i++) {
        if (s.indexOf(list[i]) !== -1) return true;
      }
    } catch (e) {}
    return false;
  }

  function isBlocked(u) { return matchesList(u, BLOCKED); }
  function isTelemetry(u) { return matchesList(u, TELEMETRY); }
  function isIma(u) { return matchesList(u, IMA_PATTERNS); }

  function rewriteUrl(raw) {
    var str = toStr(raw);
    if (!str || typeof str !== 'string') return raw;
    var trimmed = str.trim();
    if (
      !trimmed ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('about:') ||
      trimmed.startsWith('#')
    ) {
      return raw;
    }
    if (trimmed.startsWith('/api/ext/') || trimmed.startsWith(ORIGIN + '/api/ext/') || trimmed.startsWith('/api/stub/') || trimmed.startsWith(ORIGIN + '/api/stub/')) {
      return raw;
    }
    if (trimmed.startsWith('//')) {
      trimmed = 'https:' + trimmed;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        var u = new URL(trimmed);
        if (u.origin === ORIGIN) return raw;
        if (isIma(trimmed)) return ORIGIN + '/api/stub/ima.js';
        if (isTelemetry(trimmed)) return ORIGIN + '/api/stub/empty.json';
        if (isBlocked(trimmed)) return ORIGIN + '/api/stub/empty.js';
        var proto = u.protocol.slice(0, -1);
        return ORIGIN + '/api/ext/' + proto + '/' + u.host + u.pathname + u.search;
      } catch (e) {
        return raw;
      }
    }
    return raw;
  }

  // Track active downloads to keep ZoneViewer loading overlay accurate for heavy multi-part games
  var activeFetches = 0;
  function notifyHostProgress() {
    try {
      if (window.parent && window.parent !== window) {
        var hasVisual = Boolean(document.querySelector('canvas, ruffle-player, iframe, svg'));
        window.parent.postMessage({
          type: 'DAKNUX_FRAME_PROGRESS',
          activeCount: activeFetches,
          hasVisual: hasVisual
        }, '*');
      }
    } catch (e) {}
  }

  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function(input, init) {
      try {
        if (typeof input === 'string' || (input && typeof input === 'object' && typeof input.href === 'string')) {
          var sUrl = toStr(input);
          if (isTelemetry(sUrl)) {
            return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
          }
          if (isBlocked(sUrl)) {
            return Promise.resolve(new Response('', { status: 200 }));
          }
          input = rewriteUrl(sUrl);
        } else if (input && typeof input === 'object' && typeof input.url === 'string') {
          if (isTelemetry(input.url)) {
            return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
          }
          if (isBlocked(input.url)) {
            return Promise.resolve(new Response('', { status: 200 }));
          }
          var rewritten = rewriteUrl(input.url);
          if (rewritten !== input.url) {
            var reqInit = {
              method: input.method || 'GET',
              headers: input.headers,
              mode: input.mode === 'navigate' ? 'same-origin' : input.mode,
              credentials: input.credentials,
              cache: input.cache,
              redirect: input.redirect
            };
            if (reqInit.method !== 'GET' && reqInit.method !== 'HEAD' && input.body) {
              try { reqInit.body = input.clone().body; } catch (e) {}
            }
            input = new Request(rewritten, reqInit);
          }
        }
        if (init && typeof init === 'object' && 'integrity' in init) {
          init = Object.assign({}, init);
          delete init.integrity;
        }
      } catch (e) {}
      activeFetches++;
      notifyHostProgress();
      return origFetch.call(window, input, init).then(function(resp) {
        activeFetches = Math.max(0, activeFetches - 1);
        notifyHostProgress();
        return resp;
      }, function(err) {
        activeFetches = Math.max(0, activeFetches - 1);
        notifyHostProgress();
        throw err;
      });
    };
  }

  var origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    try {
      var sUrl = toStr(url);
      if (typeof sUrl === 'string') {
        if (isTelemetry(sUrl)) {
          sUrl = ORIGIN + '/api/stub/empty.json';
        } else if (isBlocked(sUrl)) {
          sUrl = ORIGIN + '/api/stub/empty.txt';
        } else {
          sUrl = rewriteUrl(sUrl);
        }
        var args = Array.prototype.slice.call(arguments);
        args[1] = sUrl;
        return origXhrOpen.apply(this, args);
      }
    } catch (e) {}
    return origXhrOpen.apply(this, arguments);
  };

  if (navigator && typeof navigator.sendBeacon === 'function') {
    var origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
      if (isBlocked(url) || isTelemetry(url)) return true;
      return origBeacon(rewriteUrl(url), data);
    };
  }

  var origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    try {
      var lower = String(name).toLowerCase();
      var tag = (this.tagName || '').toUpperCase();
      if (lower === 'integrity') return;
      if ((lower === 'src' || lower === 'data' || (lower === 'href' && tag !== 'A')) && typeof value === 'string') {
        if (isIma(value)) value = ORIGIN + '/api/stub/ima.js';
        else if (isBlocked(value)) value = ORIGIN + '/api/stub/empty.js';
        else value = rewriteUrl(value);
      }
    } catch (e) {}
    return origSetAttr.call(this, name, value);
  };

  function wrapProp(Proto, prop) {
    if (!Proto) return;
    var desc = Object.getOwnPropertyDescriptor(Proto, prop);
    if (!desc || !desc.set) return;
    Object.defineProperty(Proto, prop, {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function(val) {
        if (typeof val === 'string') {
          if (isIma(val)) val = ORIGIN + '/api/stub/ima.js';
          else if (isBlocked(val)) val = ORIGIN + '/api/stub/empty.js';
          else val = rewriteUrl(val);
        }
        return desc.set.call(this, val);
      }
    });
  }
  wrapProp(HTMLScriptElement.prototype, 'src');
  wrapProp(HTMLImageElement.prototype, 'src');
  if (typeof HTMLMediaElement !== 'undefined') wrapProp(HTMLMediaElement.prototype, 'src');
  wrapProp(HTMLSourceElement.prototype, 'src');
  wrapProp(HTMLIFrameElement.prototype, 'src');
  wrapProp(HTMLEmbedElement.prototype, 'src');
  wrapProp(HTMLObjectElement.prototype, 'data');
  wrapProp(HTMLLinkElement.prototype, 'href');
  wrapProp(HTMLBaseElement.prototype, 'href');

  if (window.Worker) {
    var OrigWorker = window.Worker;
    window.Worker = function(scriptURL, options) {
      var s = toStr(scriptURL);
      if (typeof s === 'string') {
        try {
          var abs = new URL(s, document.baseURI).href;
          s = rewriteUrl(abs);
        } catch (e) {
          s = rewriteUrl(s);
        }
      }
      return new OrigWorker(s, options);
    };
    window.Worker.prototype = OrigWorker.prototype;
  }

  if (window.FontFace) {
    var OrigFontFace = window.FontFace;
    window.FontFace = function(family, source, descriptors) {
      if (typeof source === 'string') {
        source = source.replace(/url\\((["']?)((?:https?:)?\\/\\/[^)"']+)\\1\\)/gi, function(_m, q, u) {
          var norm = u.startsWith('//') ? 'https:' + u : u;
          return 'url(' + q + rewriteUrl(norm) + q + ')';
        });
      }
      return new OrigFontFace(family, source, descriptors);
    };
    window.FontFace.prototype = OrigFontFace.prototype;
  }

  // Keep proxy shim & base rewriting alive if a game calls document.open(); document.write(html)
  var shimTagHtml = '';
  try {
    var selfScript = document.querySelector('script[data-daknux-shim="1"]');
    if (selfScript) shimTagHtml = selfScript.outerHTML;
  } catch (e) {}

  function patchWrittenHtml(chunk) {
    if (typeof chunk !== 'string') return chunk;
    if (chunk.indexOf('__DAKNUX_SHIM__') !== -1) return chunk;
    if (chunk.indexOf('<base') === -1 && chunk.indexOf('<head') === -1 && chunk.indexOf('http://') === -1 && chunk.indexOf('https://') === -1) {
      return chunk;
    }
    var out = chunk.replace(/<base\\b([^>]*?)href=(["'])([^"']+)\\2([^>]*)>/gi, function(m, pre, q, href, post) {
      var t = href.trim();
      if (t.startsWith('//')) t = 'https:' + t;
      if (t.startsWith('http://') || t.startsWith('https://')) {
        return '<base' + pre + 'href=' + q + rewriteUrl(t) + q + post + '>';
      }
      return m;
    });
    out = out.replace(/\\b(src|poster|data-src)=(["'])((?:https?:)?\\/\\/[^"']+)\\2/gi, function(m, attr, q, u) {
      var norm = u.startsWith('//') ? 'https:' + u : u;
      return attr + '=' + q + rewriteUrl(norm) + q;
    });
    out = out.replace(/<link\\b([^>]*?)href=(["'])((?:https?:)?\\/\\/[^"']+)\\2([^>]*)>/gi, function(m, pre, q, u, post) {
      var norm = u.startsWith('//') ? 'https:' + u : u;
      return '<link' + pre + 'href=' + q + rewriteUrl(norm) + q + post + '>';
    });
    if (shimTagHtml) {
      var baseM = out.match(/<base\\b[^>]*>/i);
      if (baseM && baseM.index !== undefined) {
        var idx = baseM.index + baseM[0].length;
        out = out.slice(0, idx) + shimTagHtml + out.slice(idx);
      } else if (/<head[^>]*>/i.test(out)) {
        out = out.replace(/<head[^>]*>/i, function(m) { return m + shimTagHtml; });
      }
    }
    return out;
  }

  var origWrite = Document.prototype.write;
  var origWriteln = Document.prototype.writeln;
  Document.prototype.write = function() {
    var args = Array.prototype.slice.call(arguments);
    if (args.length === 1 && typeof args[0] === 'string') {
      args[0] = patchWrittenHtml(args[0]);
    } else if (args.length > 1) {
      args = [patchWrittenHtml(args.join(''))];
    }
    return origWrite.apply(this, args);
  };
  Document.prototype.writeln = function() {
    var args = Array.prototype.slice.call(arguments);
    if (args.length >= 1) {
      args = [patchWrittenHtml(args.join(''))];
    }
    return origWriteln.apply(this, args);
  };

  window.addEventListener('load', function() {
    notifyHostProgress();
    setTimeout(notifyHostProgress, 800);
  });

  // Forward virtual gamepad events from parent shell
  window.addEventListener('message', function(ev) {
    if (!ev || !ev.data || ev.data.type !== 'DAKNUX_KEY_EVENT') return;
    var d = ev.data;
    var eventType = d.action === 'up' ? 'keyup' : 'keydown';
    var evt = new KeyboardEvent(eventType, {
      key: d.key,
      code: d.code,
      keyCode: d.keyCode || 0,
      which: d.keyCode || 0,
      bubbles: true,
      cancelable: true
    });
    try {
      Object.defineProperty(evt, 'keyCode', { get: function() { return d.keyCode || 0; } });
      Object.defineProperty(evt, 'which', { get: function() { return d.keyCode || 0; } });
    } catch (e) {}
    var target = document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : (document.querySelector('canvas') || document.body || window);
    target.dispatchEvent(evt);
    window.dispatchEvent(evt);
  });

  window.addEventListener('pointerdown', function() {
    try { window.focus(); } catch (e) {}
  }, { passive: true });
})();
</script>`;
}

function rewriteHtmlForProxy(html: string, sourceUrl?: string): string {
  let out = html;

  // Unwrap Google Gadget XML (<Module>...<Content type="html"><![CDATA[...]]></Content></Module>)
  if (/<Module\b/i.test(out)) {
    const cdataStart = out.indexOf('<![CDATA[');
    if (cdataStart !== -1) {
      out = out.slice(cdataStart + 9);
    } else {
      out = out.replace(/^(?:[\s\S]*?)<Module\b[^>]*>(?:\s*<!--[\s\S]*?-->\s*)*(?:<Module\b[^>]*>)?/i, '');
    }
    out = out.replace(/(?:\]\]>)?\s*(?:<\/Content>\s*)?(?:<\/Module>\s*)+$/i, '').trim();
  }

  // Auto-fix broken Flash/Ruffle templates that left player.load("$1") while embedding a .swf URL
  if (out.includes('player.load("$1")') || out.includes("player.load('$1')")) {
    const swfMatch = out.match(/(?:src|value)=(["'])(https?:\/\/[^"']+\.swf(?:\?[^"']*)?)\1/i);
    if (swfMatch && swfMatch[2]) {
      const proxiedSwf = toProxyPath(swfMatch[2]);
      out = out
        .replace(/player\.load\((["'])\$1\1\)/g, `player.load(${JSON.stringify(proxiedSwf)})`);
    }
  }

  // Rewrite <base href="..."> tags
  let hasBaseTag = false;
  out = out.replace(/<base\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi, (match, pre, q, href, post) => {
    hasBaseTag = true;
    let target = href.trim();
    if (target.startsWith('//')) target = 'https:' + target;
    if (target.startsWith('http://') || target.startsWith('https://')) {
      const proxied = toProxyPath(target);
      return `<base${pre}href=${q}${proxied}${q}${post}>`;
    }
    return match;
  });

  // If a proxied sub-page (/api/ext/...) has no <base> tag, inject one from sourceUrl directory
  // so Blob/iframe/relative asset paths resolve properly
  if (!hasBaseTag && sourceUrl && !sourceUrl.startsWith(UPSTREAM_HTML_BASE)) {
    try {
      const u = new URL(sourceUrl);
      const dirPath = u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1);
      const baseProxy = `/api/ext/${u.protocol.slice(0, -1)}/${u.host}${dirPath}`;
      const baseTag = `<base href="${baseProxy}">`;
      if (/<head[^>]*>/i.test(out)) {
        out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}`);
        hasBaseTag = true;
      }
    } catch {
      // Ignore
    }
  }

  // Rewrite protocol-relative or external http(s) URLs in HTML resource attributes
  out = out.replace(
    /\b(src|poster|data-src|data)=(["'])((?:https?:)?\/\/[^"']+)\2/gi,
    (_match, attr, q, rawUrl) => {
      const normalized = rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl;
      const lower = normalized.toLowerCase();
      if (IMA_SDK_PATTERNS.some((p) => lower.includes(p))) {
        return `${attr}=${q}/api/stub/ima.js${q}`;
      }
      if (BLOCKED_CLIENT_DOMAINS.some((b) => lower.includes(b))) {
        return `${attr}=${q}/api/stub/empty.js${q}`;
      }
      if (lower.includes('google.com/jsapi')) {
        return `${attr}=${q}/api/stub/empty.js${q}`;
      }
      return `${attr}=${q}${toProxyPath(normalized)}${q}`;
    }
  );

  // Rewrite <link ... href="http(s)://..."> for stylesheets/icons/preloads (skip canonical/preconnect/<a>)
  out = out.replace(
    /<link\b([^>]*?)href=(["'])((?:https?:)?\/\/[^"']+)\2([^>]*)>/gi,
    (match, pre, q, rawUrl, post) => {
      const attrs = `${pre} ${post}`.toLowerCase();
      if (/\brel=(["'])(?:canonical|alternate|preconnect|dns-prefetch|author|license)\1/i.test(attrs)) {
        return match;
      }
      const normalized = rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl;
      const lower = normalized.toLowerCase();
      if (BLOCKED_CLIENT_DOMAINS.some((b) => lower.includes(b))) {
        return `<link${pre}href=${q}/api/stub/empty.css${q}${post}>`;
      }
      return `<link${pre}href=${q}${toProxyPath(normalized)}${q}${post}>`;
    }
  );

  // Strip integrity attributes on <script> / <link> tags pointing to our proxy/stubs
  out = out.replace(
    /(<(?:script|link)\b[^>]*\/api\/(?:ext|stub)\/[^>]*?)\s+integrity=(["'])[^"']*\2([^>]*>)/gi,
    '$1$3'
  );
  out = out.replace(
    /(<(?:script|link)\b[^>]*?)\s+integrity=(["'])[^"']*\2([^>]*\/api\/(?:ext|stub)\/[^>]*>)/gi,
    '$1$3'
  );

  // Rewrite inline CSS url(https://...)
  out = out.replace(/url\((["']?)((?:https?:)?\/\/[^)"']+)\1\)/gi, (_m, q, rawUrl) => {
    const normalized = rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl;
    return `url(${q}${toProxyPath(normalized)}${q})`;
  });

  // Avoid injecting twice if already injected
  if (!out.includes('__DAKNUX_SHIM__')) {
    const shim = buildInjectedShim();
    const baseMatch = out.match(/<base\b[^>]*>/i);
    if (baseMatch && baseMatch.index !== undefined) {
      const insertAt = baseMatch.index + baseMatch[0].length;
      out = out.slice(0, insertAt) + '\n' + shim + out.slice(insertAt);
    } else if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${shim}`);
    } else {
      out = `${shim}\n${out}`;
    }
  }

  return out;
}

function loadLocalZones(): ZoneEntry[] {
  try {
    const raw = fs.readFileSync(ZONES_LOCAL_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read local zones.json:', err);
    return [];
  }
}

function loadLocalQuotes(): string[] {
  try {
    const raw = fs.readFileSync(QUOTES_LOCAL_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((q) => (typeof q === 'string' ? q : q.text || q.quote || q.message || String(q)));
    }
  } catch (err) {
    console.error('Failed to read local quotes.json:', err);
  }
  return ['WELCOME TO DAKNUX', 'FAST SAME-ORIGIN PROXY ACTIVE', 'PRESS TAB CLOAK IN SETTINGS FOR STEALTH'];
}

let cachedZones: ZoneEntry[] = loadLocalZones();
let lastZonesSync = Date.now();
let cachedStats: Record<string, Record<string, number>> = {};
let lastStatsFetch = 0;

async function fetchStatsPeriod(period: 'year' | 'month' | 'week' | 'day'): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  try {
    const resp = await fetch(
      `https://data.jsdelivr.com/v1/stats/packages/gh/daknux/html@main/files?period=${period}&page=1&limit=100`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!resp.ok) return result;
    const data = (await resp.json()) as Array<{ name?: string; hits?: { total?: number } }>;
    if (!Array.isArray(data)) return result;
    for (const item of data) {
      if (!item?.name) continue;
      const match = item.name.match(/^\/(\d+)([.-])/);
      if (!match) continue;
      const id = match[1];
      result[id] = (result[id] || 0) + (item.hits?.total ?? 0);
    }
  } catch {
    // Silent fallback
  }
  return result;
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/stub/empty.js', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send('/* daknux-stub */');
  });

  app.get('/api/stub/ima.js', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(`window.google = window.google || {};
window.google.ima = window.google.ima || {
  AdDisplayContainer: function() { return { initialize: function(){} }; },
  AdsLoader: function() {
    var listeners = {};
    return {
      addEventListener: function(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
      requestAds: function() {},
      contentComplete: function() {},
      destroy: function() {}
    };
  },
  AdsRequest: function() {},
  AdsRenderingSettings: function() {},
  ViewMode: { NORMAL: 'normal', FULLSCREEN: 'fullscreen' },
  AdEvent: { Type: { ALL_ADS_COMPLETED: 'allAdsCompleted', CONTENT_PAUSE_REQUESTED: 'contentPauseRequested', CONTENT_RESUME_REQUESTED: 'contentResumeRequested', COMPLETE: 'complete' } },
  AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: 'adsManagerLoaded' } },
  AdErrorEvent: { Type: { AD_ERROR: 'adError' } }
};`);
  });

  app.all('/api/stub/empty.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send('{}');
  });

  app.get('/api/stub/empty.css', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send('/* daknux-stub */');
  });

  app.all('/api/stub/empty.txt', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send('');
  });

  app.get('/js/main.js', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send('/* daknux-compat */');
  });

  app.get('/api/zones', async (req: Request, res: Response) => {
    const forceRefresh = req.query.refresh === '1';
    if (forceRefresh || Date.now() - lastZonesSync > 1000 * 60 * 60 * 6) {
      try {
        const resp = await fetch(`${UPSTREAM_ZONES_URL}?t=${Date.now()}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) {
          const json = await resp.json();
          const list = Array.isArray(json) ? json : Array.isArray(json?.zones) ? json.zones : [];
          if (list.length > 100) {
            const upstreamIds = new Set(list.map((z: ZoneEntry) => z.id));
            const localAdditions = loadLocalZones().filter((z) => !upstreamIds.has(z.id));
            cachedZones = [...list, ...localAdditions];
            lastZonesSync = Date.now();
          }
        }
      } catch {
        // Keep local bundled zones.json
      }
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Daknux-Proxy', '1');
    res.json(cachedZones);
  });

  app.get('/api/quotes', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(loadLocalQuotes());
  });

  app.get('/api/stats', async (_req: Request, res: Response) => {
    if (Date.now() - lastStatsFetch > 1000 * 60 * 30 || Object.keys(cachedStats).length === 0) {
      const [year, month, week, day] = await Promise.all([
        fetchStatsPeriod('year'),
        fetchStatsPeriod('month'),
        fetchStatsPeriod('week'),
        fetchStatsPeriod('day'),
      ]);
      cachedStats = { year, month, week, day };
      lastStatsFetch = Date.now();
    }
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json(cachedStats);
  });

  app.get('/api/zone-info/:id', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const zone = cachedZones.find((z) => z.id === id);
    if (!zone) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }
    const plays = cachedStats.year?.[String(id)] ?? 0;
    res.json({
      id: zone.id,
      name: zone.name,
      author: zone.author || 'Community',
      authorLink: zone.authorLink || null,
      tags: zone.special || [],
      featured: Boolean(zone.featured),
      plays,
    });
  });

  app.get('/api/cover', async (req: Request, res: Response) => {
    const rawCover = typeof req.query.src === 'string' ? req.query.src.trim() : '';
    if (!rawCover) {
      res.status(400).send('Missing cover');
      return;
    }
    const targetUrl = rawCover
      .replace('{COVER_URL}', UPSTREAM_COVERS_BASE)
      .replace('{HTML_URL}', UPSTREAM_HTML_BASE);

    const cacheKey = `cover:${targetUrl}`;
    const cached = getCached(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(cached.status).send(cached.body);
      return;
    }

    try {
      const parsed = await assertSafeExternalUrl(targetUrl);
      const upstream = await fetch(parsed.toString(), { signal: AbortSignal.timeout(10000) });
      if (!upstream.ok) {
        res.status(upstream.status).send('Cover unavailable');
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      const contentType = upstream.headers.get('content-type') || 'image/png';
      setCached(cacheKey, { body: buf, contentType, status: 200, timestamp: Date.now() });
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buf);
    } catch {
      res.status(502).send('Cover proxy failed');
    }
  });

  app.get('/api/game/:id', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const zone = cachedZones.find((z) => z.id === id);
    if (!zone) {
      res.status(404).send('Zone not found');
      return;
    }
    if (zone.id < 0 || !zone.url || zone.url.includes('discord.gg')) {
      res.status(400).send('External link zone');
      return;
    }

    const targetUrl = zone.url
      .replace('{HTML_URL}', UPSTREAM_HTML_BASE)
      .replace('{COVER_URL}', UPSTREAM_COVERS_BASE);

    const isDownload = req.query.download === '1';
    const cacheKey = `game:${targetUrl}`;
    let htmlText = '';
    const cached = getCached(cacheKey);

    if (cached && !isDownload) {
      htmlText = cached.body.toString('utf-8');
    } else {
      try {
        const parsed = await assertSafeExternalUrl(targetUrl);
        const upstream = await fetch(parsed.toString(), {
          signal: AbortSignal.timeout(20000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (!upstream.ok) {
          res.status(upstream.status).send(`Failed to load game (${upstream.status})`);
          return;
        }
        const rawBuf = Buffer.from(await upstream.arrayBuffer());
        htmlText = rawBuf.toString('utf-8');
        if (!isDownload) {
          setCached(cacheKey, {
            body: rawBuf,
            contentType: 'text/html; charset=utf-8',
            status: 200,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        console.error('Game fetch error:', err);
        res.status(502).send('Could not fetch game from upstream source.');
        return;
      }
    }

    if (isDownload) {
      const safeFilename = zone.name.replace(/[^a-zA-Z0-9._ -]/g, '_') + '.html';
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.send(htmlText);
      return;
    }

    const rewritten = rewriteHtmlForProxy(htmlText, targetUrl);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(rewritten);
  });

  // Streaming + caching reverse proxy for game assets (supports GET, HEAD, POST, OPTIONS + jsDelivr >50MB fallback)
  app.all('/api/ext/:proto/:host/*', async (req: Request, res: Response) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.status(204).end();
      return;
    }

    const proto = String(req.params.proto || '').toLowerCase();
    const host = String(req.params.host || '');
    const restPath = String((req.params as Record<string, string>)[0] || '');

    if (proto !== 'http' && proto !== 'https') {
      res.status(400).send('Invalid protocol');
      return;
    }
    if (!/^[a-zA-Z0-9.-]+(?::\d+)?$/.test(host)) {
      res.status(400).send('Invalid host');
      return;
    }

    const rawOriginal = req.originalUrl;
    const prefix = `/api/ext/${proto}/${host}/`;
    const idx = rawOriginal.indexOf(prefix);
    const tailWithQuery = idx >= 0 ? rawOriginal.slice(idx + prefix.length) : restPath;
    const targetUrl = `${proto}://${host}/${tailWithQuery}`;
    const lowerUrl = targetUrl.toLowerCase();

    if (IMA_SDK_PATTERNS.some((p) => lowerUrl.includes(p))) {
      res.redirect(302, '/api/stub/ima.js');
      return;
    }
    if (JSON_TELEMETRY_DOMAINS.some((b) => lowerUrl.includes(b))) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(200).send('{}');
      return;
    }
    if (BLOCKED_CLIENT_DOMAINS.some((b) => lowerUrl.includes(b))) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(200).send('/* blocked */');
      return;
    }

    const isCacheableGet = req.method === 'GET';
    const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const cacheKey = `ext:${targetUrl}`;
    if (isCacheableGet && !rangeHeader) {
      const cached = getCached(cacheKey);
      if (cached) {
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(cached.status).send(cached.body);
        return;
      }
    }

    const controller = new AbortController();
    const connectTimer = setTimeout(() => controller.abort(), 20000);
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    try {
      const parsed = await assertSafeExternalUrl(targetUrl);
      const reqHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      };
      if (rangeHeader) reqHeaders['Range'] = rangeHeader;
      if (typeof req.headers['content-type'] === 'string' && req.method !== 'GET' && req.method !== 'HEAD') {
        reqHeaders['Content-Type'] = req.headers['content-type'];
      }

      const fetchInit: RequestInit = {
        method: req.method,
        signal: controller.signal,
        headers: reqHeaders,
      };
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
        fetchInit.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      let upstream = await fetch(parsed.toString(), fetchInit);

      // Automatic raw.githubusercontent.com fallback when jsDelivr rejects >50 MB packages (403)
      if (upstream.status === 403 && host === 'cdn.jsdelivr.net' && parsed.pathname.startsWith('/gh/')) {
        const ghMatch = parsed.pathname.match(/^\/gh\/([^/]+)\/([^/@]+)(?:@([^/]+))?\/(.+)$/);
        if (ghMatch) {
          const [, owner, repo, ref, filePath] = ghMatch;
          const refsToTry = ref && ref !== 'latest' ? [ref] : ['main', 'master'];
          for (const branch of refsToTry) {
            const rawGhUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}${parsed.search}`;
            const safeGh = await assertSafeExternalUrl(rawGhUrl);
            const fallbackResp = await fetch(safeGh.toString(), {
              signal: controller.signal,
              headers: reqHeaders,
            });
            if (fallbackResp.ok || fallbackResp.status === 206) {
              upstream = fallbackResp;
              break;
            }
          }
        }
      }

      clearTimeout(connectTimer);

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).send(`Upstream error ${upstream.status}`);
        return;
      }

      let contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      const lowerPath = parsed.pathname.toLowerCase();
      if (lowerPath.endsWith('.wasm')) contentType = 'application/wasm';
      else if (lowerPath.endsWith('.js') || lowerPath.endsWith('.mjs')) contentType = 'application/javascript; charset=utf-8';
      else if (lowerPath.endsWith('.css')) contentType = 'text/css; charset=utf-8';
      else if (lowerPath.endsWith('.json')) contentType = 'application/json; charset=utf-8';
      else if (lowerPath.endsWith('.svg')) contentType = 'image/svg+xml';
      else if (lowerPath.endsWith('.html') || lowerPath.endsWith('.htm')) contentType = 'text/html; charset=utf-8';

      const isHtml =
        (contentType.includes('text/html') || lowerPath.endsWith('.html') || lowerPath.endsWith('.htm')) &&
        req.query.raw !== '1';
      const isCss = contentType.includes('text/css') || lowerPath.endsWith('.css');

      const contentLengthHeader = upstream.headers.get('content-length');
      const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
      const shouldBufferAndCache =
        isCacheableGet &&
        !rangeHeader &&
        (isHtml || isCss || (!Number.isNaN(contentLength) && contentLength <= MAX_SINGLE_CACHE_BYTES));

      if (shouldBufferAndCache) {
        let buf = Buffer.from(await upstream.arrayBuffer());
        if (isHtml) {
          const rewritten = rewriteHtmlForProxy(buf.toString('utf-8'), targetUrl);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.send(rewritten);
          return;
        }
        if (isCss) {
          const cssText = buf
            .toString('utf-8')
            .replace(/url\((["']?)((?:https?:)?\/\/[^)"']+)\1\)/gi, (_m, q, rawUrl) => {
              const norm = rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl;
              return `url(${q}${toProxyPath(norm)}${q})`;
            })
            .replace(/@import\s+(["'])((?:https?:)?\/\/[^"']+)\1/gi, (_m, q, rawUrl) => {
              const norm = rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl;
              return `@import ${q}${toProxyPath(norm)}${q}`;
            });
          buf = Buffer.from(cssText, 'utf-8');
        }
        setCached(cacheKey, {
          body: buf,
          contentType,
          status: upstream.status,
          timestamp: Date.now(),
        });
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(upstream.status).send(buf);
        return;
      }

      // Stream large payloads (.data, .wasm, .pck, .bin, .zip, audio/video) directly to browser
      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      const acceptRanges = upstream.headers.get('accept-ranges');
      const contentRange = upstream.headers.get('content-range');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      if (contentLengthHeader && !upstream.headers.get('content-encoding')) {
        res.setHeader('Content-Length', contentLengthHeader);
      }

      if (!upstream.body || req.method === 'HEAD') {
        res.end();
        return;
      }

      const nodeStream = Readable.fromWeb(upstream.body as unknown as NodeWebReadableStream);
      nodeStream.on('error', (err) => {
        console.error('Stream pipe error for', targetUrl, err);
        if (!res.headersSent) res.status(502);
        res.end();
      });
      nodeStream.pipe(res);
    } catch (err) {
      clearTimeout(connectTimer);
      console.error('Ext proxy error for', targetUrl, err);
      if (!res.headersSent) {
        res.status(502).send('Proxy fetch failed');
      }
    }
  });

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use('/larphaansingh', express.static(distDir, { maxAge: '1d' }));
    app.use(express.static(distDir, { maxAge: '1d' }));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DAKNUX server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
