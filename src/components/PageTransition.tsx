import { useLocation } from "react-router-dom";
import { stripLangPrefix } from "@/lib/paths";

/**
 * Wraps page content and re-applies the ".page-enter" animation class on every
 * location.pathname change. Keying by the route without its language prefix preserves form/demo state
 * during language changes. Navigating to another page forces React
 * to remount it, which restarts the CSS animation. The animation itself is a
 * no-op under prefers-reduced-motion (see src/index.css).
 *
 * No framer-motion — pure CSS + a remount key.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={stripLangPrefix(pathname).rest} className="page-enter">
      {children}
    </div>
  );
}

export default PageTransition;
