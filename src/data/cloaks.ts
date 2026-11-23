import type { CloakPreset } from '../types/zone';
import { assetPath } from '../utils/runtime';

function svgIcon(svgBody: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${svgBody}</svg>`
  )}`;
}

export const CLOAK_PRESETS: CloakPreset[] = [
  {
    id: 'default',
    label: 'Gmail (Default)',
    title: 'Gmail',
    favicon: assetPath('assets/gmail-icon.svg'),
  },
  {
    id: 'classlink',
    label: 'ClassLink LaunchPad',
    title: 'My Apps - ClassLink',
    favicon: svgIcon(
      '<rect width="32" height="32" rx="6" fill="#0073cf"/><path d="M10 21a5 5 0 0 1 0-10 6 6 0 0 1 11.5-1.5A4.5 4.5 0 0 1 22 21H10z" fill="#ffffff"/>'
    ),
  },
  {
    id: 'itslearning',
    label: 'itslearning',
    title: 'itslearning',
    favicon: svgIcon(
      '<rect width="32" height="32" rx="6" fill="#f97316"/><circle cx="16" cy="10" r="3" fill="#fff"/><rect x="13" y="15" width="6" height="11" rx="2" fill="#fff"/>'
    ),
  },
  {
    id: 'canvas',
    label: 'Canvas LMS',
    title: 'Dashboard',
    favicon: svgIcon(
      '<rect width="32" height="32" rx="6" fill="#e13f2b"/><circle cx="16" cy="16" r="8" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="4 3"/>'
    ),
  },
  {
    id: 'gdocs',
    label: 'Google Docs',
    title: 'Untitled document - Google Docs',
    favicon: svgIcon(
      '<rect width="32" height="32" rx="6" fill="#2563eb"/><rect x="8" y="6" width="16" height="20" rx="2" fill="#fff"/><path d="M11 12h10M11 16h10M11 20h7" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>'
    ),
  },
  {
    id: 'khan',
    label: 'Khan Academy',
    title: 'Dashboard | Khan Academy',
    favicon: svgIcon(
      '<rect width="32" height="32" rx="6" fill="#0f766e"/><path d="M16 6l8 5v10l-8 5-8-5V11l8-5z" fill="#fff"/><circle cx="16" cy="15" r="3" fill="#0f766e"/>'
    ),
  },
];

export function applyTabCloak(title: string, faviconUrl: string): void {
  document.title = title || 'Gmail';
  const primary = document.getElementById('dynamic-favicon') as HTMLLinkElement | null;
  const alternate = document.getElementById('alternate-favicon') as HTMLLinkElement | null;
  if (primary && faviconUrl) {
    primary.href = faviconUrl;
  }
  if (alternate && faviconUrl) {
    alternate.href = faviconUrl;
  }
}
