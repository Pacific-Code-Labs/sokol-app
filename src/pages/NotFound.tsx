import { BrandLogo } from "@pacific-code-labs/sokol-design-system";
import { getBrandingVM } from "@/services/branding.service";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { tChrome } from "@/lib/chrome-i18n";
import { resolveSeo, useHeadTags } from "@/lib/seo";
import { localizedPath } from "@/lib/paths";

const NotFound = () => {
  const location = useLocation();
  const { lang } = useLang();
  const chrome = tChrome(lang);
  const brand = getBrandingVM(lang);

  // 404 → noindex (landing-dxp-builder seo-deploy.md).
  useHeadTags({ ...resolveSeo("home", lang), noindex: true }, lang);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted">
      <div className="px-6 text-center">
        <div className="mb-6 flex justify-center"><BrandLogo name={brand.companyName} logoUrl={brand.logoUrl} logoUrlDark={brand.logoUrlDark} markUrl={brand.markUrl} Icon={brand.LogoIcon} imgClassName="h-10" /></div>
        <h1 className="mb-4 text-4xl font-bold">{chrome.notFound.title}</h1>
        <p className="mb-4 text-xl text-muted-foreground">{chrome.notFound.message}</p>
        <Link to={localizedPath(lang, "/")} className="text-primary underline hover:text-primary/90">
          {chrome.notFound.backHome}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
