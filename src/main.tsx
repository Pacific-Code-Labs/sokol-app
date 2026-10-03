import "./config/amplify";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { captureDemoDraft } from "./lib/demoDraft";
// FCR-003: the shared design-system's token defaults. Imported BEFORE
// index.css so Sóköl's index.css (the SOURCE of these same token names)
// wins the cascade and stays the live light/dark values. Both files define
// :root + .dark with equal specificity, so import order is what decides —
// keep this line above index.css. The DS stylesheet only fills in any token
// the app does not redefine.
import "@pacific-code-labs/sokol-design-system/styles";
import "./index.css";
// FCR-080: apply the active DXP brand theme (themes.json → DS theme engine) +
// favicon (branding.json) once at boot, BEFORE first paint of <App/>. The
// dark/light mode itself is still owned by contexts/ThemeContext, which
// re-applies the theme in the correct mode on toggle.
import { initBrand } from "./lib/brand-theme";
import { initContent, refreshContent } from "./repositories/content.repository";

// Stale-while-revalidate: render at once from the last published copy this browser saw (or the
// bundled JSON), then fetch the published documents in the background and re-render only when
// they changed. A cold content API never delays the first paint.
captureDemoDraft();
initContent();
initBrand();
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
void refreshContent().then((changed) => {
  if (!changed) return;
  initBrand();
  root.render(<App key="published" />);
});
