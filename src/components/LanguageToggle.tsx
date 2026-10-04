import { useLocation, useNavigate } from "react-router-dom";
import { CurrentLanguageToggle } from "@/components/ui/CurrentLanguageToggle";
import { useLang } from "@/contexts/LangContext";
import { localizedPath, runLangSwitch, stripLangPrefix } from "@/lib/paths";
import { tChrome } from "@/lib/chrome-i18n";

export function LanguageToggle() {
  const { lang, tr } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const next = lang === "es" ? "en" : "es";
  const labels = { es: tr.lang_toggle_spanish, en: tr.lang_toggle_english };
  const action = tChrome(lang).nav.languageToggle.replace("{current}", labels[lang]).replace("{next}", labels[next]);
  return <CurrentLanguageToggle value={lang} label={tr.lang_toggle_label} actionLabel={action}
    onChange={(target) => runLangSwitch(navigate, localizedPath(target, stripLangPrefix(location.pathname).rest) + location.search + location.hash)} />;
}
