// Runtime SEO head tags (landing-dxp-builder seo-deploy.md, Layer 2).
//
// `seo.json` is the single editable SEO entity (siteUrl, default + per-route
// title/description, ogImage, optional GA id). `resolveSeo(route, lang)` reads
// it; `useHeadTags(...)` updates document.title + meta description + canonical +
// hreflang as the SPA navigates, from the SAME content. Public-bundle safe.
//
// NOTE on URLs: this app IS language-path-prefixed (FCR-106): every route lives
// under /:lang/... and the URL drives i18n. So the canonical is the real
// /<lang>/<slug> URL (via localizedPath), matching the prerendered Layer-1 HTML;
// hreflang alternates point at each language's prefixed URL.
import { useEffect } from "react";
import { getBranding, getBundledBranding, getSeo, type SeoContent } from "@/repositories/content.repository";
import type { Lang } from "@/lib/i18n";
import { absoluteAssetUrl } from "@/lib/media";
import { localizedPath } from "@/lib/paths";

export type { SeoContent };
export type SeoRoute = keyof SeoContent["pages"];

export const SEO_LANGS: Lang[] = ["es", "en"];

export interface ResolvedSeo {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  noindex?: boolean;
}

const siteUrl = (): string => (getSeo().siteUrl ?? "").replace(/\/$/, "");

/** Path on the public site for a route (home → "/", others → "/<route>"). */
export function routePath(route: string): string {
  return route === "home" ? "/" : `/${route}`;
}

/** Resolve the head metadata for a route + language from seo.json. */
export function resolveSeo(route: string, lang: Lang, noindex = true): ResolvedSeo {
  const seo = getSeo();
  const page = (seo.pages as Record<string, Record<Lang, { title: string; description: string }>>)[route];
  const meta = page?.[lang] ?? page?.es;
  return {
    title: meta?.title ?? seo.defaultTitle[lang] ?? seo.defaultTitle.es,
    description: meta?.description ?? seo.defaultDescription[lang] ?? seo.defaultDescription.es,
    // Language-prefixed canonical so it matches the real /:lang route + the
    // Layer-1 prerendered URL.
    canonical: siteUrl() + localizedPath(lang, routePath(route)),
    // Per-language social card from branding (uploaded in the admin), else the seo default.
    ogImage: absoluteAssetUrl(getBranding().socialCardUrl?.[lang] || getBundledBranding().socialCardUrl[lang] || seo.ogImage),
    noindex,
  };
}

function upsertMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string, hreflang?: string) {
  const sel = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector<HTMLLinkElement>(sel);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (hreflang) el.hreflang = hreflang;
    document.head.appendChild(el);
  }
  el.href = href;
}

/**
 * Update document head tags for the active route + language on SPA navigation.
 * Drives title, description, canonical, hreflang alternates, OG/Twitter, and a
 * robots noindex on 404.
 */
export function useHeadTags(resolved: ResolvedSeo, lang: Lang, route?: string): void {
  useEffect(() => {
    document.title = resolved.title;
    document.documentElement.lang = lang;
    upsertMeta('meta[name="description"]', "name", "description", resolved.description);
    upsertLink("canonical", resolved.canonical);
    upsertMeta('meta[property="og:title"]', "property", "og:title", resolved.title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", resolved.description);
    upsertMeta('meta[property="og:image"]', "property", "og:image", resolved.ogImage);
    upsertMeta('meta[property="og:url"]', "property", "og:url", resolved.canonical);
    upsertMeta('meta[property="og:locale"]', "property", "og:locale", lang === "en" ? "en_US" : "es_CR");
    upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", resolved.ogImage);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", resolved.title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", resolved.description);

    // hreflang alternates (one per language + x-default) when we know the route.
    if (route) {
      const base = siteUrl();
      for (const l of SEO_LANGS) upsertLink("alternate", `${base}/${l}${route === "home" ? "" : `/${route}`}`, l);
      upsertLink("alternate", base + routePath(route), "x-default");
    }

    // The signed-in app stays private to search engines on every route.
    upsertMeta('meta[name="robots"]', "name", "robots", "noindex,nofollow");
  }, [resolved.title, resolved.description, resolved.canonical, resolved.ogImage, resolved.noindex, lang, route]);
}
