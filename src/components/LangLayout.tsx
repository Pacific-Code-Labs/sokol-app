import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useLang } from "@/contexts/LangContext";
import { DEFAULT_LANG, isLang, stripLangPrefix } from "@/lib/paths";
import { resolveSeo, useHeadTags } from "@/lib/seo";

/**
 * Shell for the /:lang/* routes. Validates the :lang segment, syncs the
 * LangContext to the URL's language (one-way: URL → context), and renders the
 * matched child route inside a <PageTransition>.
 *
 * Navigation is NOT done here on context change — LangContext.setLang stays a
 * pure state+localStorage update (admin-safe). Callers that want to switch the
 * URL language use useNavigate + localizedPath.
 */
export function LangLayout() {
  const { lang: urlLang } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.pathname.length > 1 && location.pathname.endsWith("/")) {
      navigate(location.pathname.replace(/\/+$/, "") + location.search + location.hash, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate]);
  const { lang: ctxLang, setLang } = useLang();
  const headLang = urlLang && isLang(urlLang) ? urlLang : DEFAULT_LANG;
  const route = stripLangPrefix(location.pathname).rest.split("/")[1] || "home";
  useHeadTags(resolveSeo(route, headLang), headLang);

  useEffect(() => {
    if (urlLang && isLang(urlLang) && urlLang !== ctxLang) {
      setLang(urlLang);
    }
    // Sync only when the URL language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLang]);

  if (!urlLang || !isLang(urlLang)) {
    return <Navigate to={"/" + DEFAULT_LANG + stripLangPrefix(location.pathname).rest} replace />;
  }

  return <Outlet />;
}

export default LangLayout;
