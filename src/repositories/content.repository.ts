// The ONLY importer of the app's content JSON. Editors change the documents online in the admin
// console (sokol-admin → public API, site "app"); the bundled files are the fallback so the
// app never depends on the content API to render (stale-while-revalidate, see main.tsx).
import branding from "@/content/branding.json";
import themes from "@/content/themes.json";
import seo from "@/content/seo.json";
import media from "@/content/media.json";
import support from "@/content/support.json";
import { cachedPublishedContent, loadPublishedContent } from "@pacific-code-labs/sokol-design-system";

const env = import.meta.env;
const PUBLIC_API =
  env.VITE_PUBLIC_API_URL && env.VITE_PUBLIC_IDENTITY_POOL_ID
    ? { url: env.VITE_PUBLIC_API_URL, identityPoolId: env.VITE_PUBLIC_IDENTITY_POOL_ID }
    : null;

const BUNDLED: Record<string, unknown> = { branding, themes, seo, media, support };

let published: Record<string, unknown> = {};
const doc = <T>(key: string, bundled: T): T => (published[key] as T | undefined) ?? bundled;

export function initContent(): void {
  published = cachedPublishedContent("app") ?? {};
}

export async function refreshContent(): Promise<boolean> {
  const fresh = await loadPublishedContent(PUBLIC_API, "app");
  if (!fresh) return false;
  const changed = Object.entries(fresh).some(
    ([key, value]) => JSON.stringify(value) !== JSON.stringify(published[key] ?? BUNDLED[key]),
  );
  published = fresh;
  return changed;
}

export type BrandingContent = typeof branding;
export type ThemesContent = typeof themes;
export type SeoContent = typeof seo;
export type MediaContent = typeof media;
export type SupportContent = typeof support;

/** Empty legacy CMS asset slots inherit the shipped identity; nonempty overrides win. */
export const getBranding = (): BrandingContent => {
  const current = doc("branding", branding);
  return {
    ...branding,
    ...current,
    logoUrl: current.logoUrl || branding.logoUrl,
    logoUrlDark: current.logoUrlDark || branding.logoUrlDark,
    markUrl: current.markUrl || branding.markUrl,
    faviconUrl: current.faviconUrl || branding.faviconUrl,
    appleTouchIconUrl: current.appleTouchIconUrl || branding.appleTouchIconUrl,
    ogImage: current.ogImage || branding.ogImage,
    socialCardUrl: {
      es: current.socialCardUrl?.es || branding.socialCardUrl.es,
      en: current.socialCardUrl?.en || branding.socialCardUrl.en,
    },
  };
};
export const getBundledBranding = (): BrandingContent => branding;
export const getThemes = (): ThemesContent => doc("themes", themes);
export const getSeo = (): SeoContent => doc("seo", seo);
export const getMedia = (): MediaContent => doc("media", media);
export const getSupport = (): SupportContent => doc("support", support);
