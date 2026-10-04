// Static localized share metadata for known routes; dynamic deep links use the SPA fallback.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

const shell = readFileSync("dist/index.html", "utf8");
const branding = JSON.parse(readFileSync("src/content/branding.json", "utf8"));
const seo = JSON.parse(readFileSync("src/content/seo.json", "utf8"));
const routes = [...readFileSync("src/App.tsx", "utf8").matchAll(/<Route path="([^":*]+)"/g)]
  .map((m) => m[1]).filter((route) => !route.startsWith("/"));
for (const lang of ["es", "en"]) {
  const image = new URL(branding.socialCardUrl[lang], seo.siteUrl).href;
  const html = shell.replace(/<html[^>]*>/, `<html lang="${lang}" class="dark">`)
    .replace(/(<meta property="og:image" content=")[^"]*/, `$1${image}`)
    .replace(/(<meta name="twitter:image" content=")[^"]*/, `$1${image}`)
    .replace(/(<meta property="og:locale" content=")[^"]*/, `$1${lang === "en" ? "en_US" : "es_CR"}`)
    .replace(/<title>[^<]*<\/title>/, `<title>${seo.defaultTitle[lang]}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${seo.defaultDescription[lang]}`);
  for (const route of ["", ...routes]) {
    // Pages serves /path from path.html without a directory-slash redirect.
    const file = path.join("dist", `${lang}${route ? `/${route}` : ""}.html`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, html);
  }
}
copyFileSync("dist/index.html", "dist/404.html");
console.log("Localized app shells and noindex SPA fallback written.");
