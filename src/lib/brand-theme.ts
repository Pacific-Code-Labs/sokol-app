// Brand + theme applier (landing-dxp-builder §10) — integrates the DXP content
// (branding.json + themes.json) with the shared `@pacific-code-labs/sokol-design-system` theme
// engine (FCR-003).
//
// Reconciliation with the existing light/dark switch: `contexts/ThemeContext`
// stays the LIVE dark/light source (it toggles the `.dark` class +
// localStorage). This module owns BRAND identity: which named theme is active
// (mapped to a DS engine theme id) and the favicon/OG read from branding.
// `applyActiveTheme(isDark)` calls the DS `applyTheme(engineThemeId, isDark)`,
// which writes every Blue Book token onto :root and injects the theme's fonts —
// so selecting/activating a theme in the admin (or shipping a different active
// theme in themes.json) re-skins the whole site without hardcoded colours.
//
// `initBrand()` runs once at boot from main.tsx.
import { applyTheme, getTheme, DEFAULT_THEME_ID } from "@pacific-code-labs/sokol-design-system";
import { getBranding, getThemes, type ThemesContent } from "@/repositories/content.repository";
import { resolveAssetUrl } from "@/lib/media";

type ThemeEntry = ThemesContent["themes"][number];

/** The currently-active named theme from themes.json (falls back to the first). */
export function activeTheme(): ThemeEntry {
  const { themes } = getThemes();
  return themes.find((t) => t.isActive) ?? themes[0];
}

/** Map a content theme entry to a known DS engine theme id. */
function engineIdFor(entry: ThemeEntry | undefined): string {
  const id = entry?.engineThemeId || entry?.id || DEFAULT_THEME_ID;
  // getTheme() falls back to the default for an unknown id, so this is safe.
  return getTheme(id).id;
}

/**
 * Apply the active brand theme through the DS theme engine for the given mode.
 * Call on boot and whenever the dark/light mode flips (so the engine writes the
 * correct light or dark token map). The admin Site Identity page can also call
 * `applyThemeEntry(entry, isDark)` for a live preview of a non-active theme.
 */
export function applyActiveTheme(isDark: boolean): void {
  applyTheme(engineIdFor(activeTheme()), isDark);
}

/** Live-preview / apply a specific theme entry (used by the admin identity page). */
export function applyThemeEntry(entry: ThemeEntry | undefined, isDark: boolean): void {
  applyTheme(engineIdFor(entry), isDark);
}

/** Upsert the <link rel="icon"> from a branding favicon ref. */
export function applyFavicon(ref?: string | null): void {
  if (typeof document === "undefined") return;
  const href = resolveAssetUrl(ref);
  if (!href) return;
  let link = document.head.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = /^\/favicon\.(svg|ico)$/i.test(href) ? `${href}?v=sokol-20261003` : href;
  link.type = /\.svg(?:[?#]|$)/i.test(href) ? "image/svg+xml"
    : /\.ico(?:[?#]|$)/i.test(href) ? "image/x-icon" : "image/png";
  link.removeAttribute("sizes");
}

/** Upsert the iOS home-screen icon from branding (optional field). */
export function applyAppleTouchIcon(ref?: string | null): void {
  if (typeof document === "undefined") return;
  const href = resolveAssetUrl(ref);
  if (!href) return;
  let link = document.head.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "apple-touch-icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Boot-time brand init (called once from main.tsx). Applies the active theme in
 * the mode persisted by ThemeContext (default dark) and sets the favicon from
 * branding. Token VALUES that ThemeContext's `.dark`/`:root` blocks own still
 * win for the default theme (the engine writes the same values); a non-default
 * active theme overrides them at runtime.
 */
export function initBrand(): void {
  if (typeof document === "undefined") return;
  const stored = localStorage.getItem("sokol.theme");
  const isDark = stored ? stored === "dark" : document.documentElement.classList.contains("dark");
  applyActiveTheme(isDark);
  const branding = getBranding() as { faviconUrl?: string; appleTouchIconUrl?: string };
  applyFavicon(branding.faviconUrl);
  applyAppleTouchIcon(branding.appleTouchIconUrl);
}
