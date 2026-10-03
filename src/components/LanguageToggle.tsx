import { useLocation, useNavigate } from "react-router-dom";
import { LanguageToggle as FlagLanguageToggle } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { localizedPath, runLangSwitch, stripLangPrefix } from "@/lib/paths";

export function LanguageToggle() {
  const { lang, tr } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  return <FlagLanguageToggle value={lang} label={tr.lang_toggle_label}
    labels={{ es: tr.lang_toggle_spanish, en: tr.lang_toggle_english }}
    onChange={(next) => runLangSwitch(navigate,
      localizedPath(next, stripLangPrefix(location.pathname).rest) + location.search + location.hash)} />;
}
