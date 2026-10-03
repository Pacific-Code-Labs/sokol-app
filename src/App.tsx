import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Toaster as Sonner, TooltipProvider } from "@pacific-code-labs/sokol-design-system";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import VerifyEmail from "./pages/VerifyEmail.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import RolesPage from "./pages/RolesPage.tsx";
import NewOrganization from "./pages/NewOrganization.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import DemoProject from "./pages/DemoProject.tsx";
import Projects from "./pages/Projects.tsx";
import NewProject from "./pages/NewProject.tsx";
import ProjectDetail from "./pages/ProjectDetail.tsx";
import ElectricalProject from "./pages/ElectricalProject.tsx";
import Pricing from "./pages/Pricing.tsx";
import NotFound from "./pages/NotFound.tsx";
import { LangProvider } from "@/contexts/LangContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { BillingProvider } from "@/contexts/BillingContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AssistantProvider } from "@/contexts/AssistantContext";
import { RequireAuth } from "@/components/RequireAuth";
import { LangLayout } from "@/components/LangLayout";
import { DEFAULT_LANG, isLang, localizedPath, persistedLang, stripLangPrefix } from "@/lib/paths";
import { landingHref } from "@/lib/site-links";
import Evaluator from "./pages/Evaluator.tsx";
import SupportList from "./pages/SupportList.tsx";
import SupportNew from "./pages/SupportNew.tsx";
import SupportDetail from "./pages/SupportDetail.tsx";

// sokol-app: the signed-in product at app.sokol.jcampos.dev. The marketing
// landing (sokol.jcampos.dev, repo sokol) and the private admin
// console (sokol-admin) are separate apps; this one has no landing page and no
// admin code. `/:lang` goes to the dashboard (RequireAuth sends guests to login).

const queryClient = new QueryClient();

/**
 * LegacyRedirect — catches any un-prefixed deep link (e.g. /dashboard, /projects)
 * and forwards it to the same path under the persisted/Default language prefix.
 * Bare "/" is handled by its own top-level redirect.
 */
function LegacyRedirect() {
  const location = useLocation();
  const { rest } = stripLangPrefix(location.pathname);
  return <Navigate to={localizedPath(persistedLang(), rest) + location.search + location.hash} replace />;
}

/** The public demo lives on the landing (sokol.jcampos.dev/<lang>/demo); old links go there. */
function DemoRedirect() {
  const { lang } = useParams();
  useEffect(() => {
    window.location.replace(landingHref(lang && isLang(lang) ? lang : DEFAULT_LANG, "demo"));
  }, [lang]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <BillingProvider>
        <LangProvider>
          <AssistantProvider>
          <TooltipProvider>
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/*
                 * ALL app routes are language-prefixed under /:lang (FCR-106).
                 * The URL drives i18n: LangLayout validates :lang, syncs
                 * LangContext to it, and renders the matched child via its
                 * <Outlet/> inside a <PageTransition>.
                 */}
                <Route path="/:lang" element={<LangLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="demo" element={<DemoRedirect />} />
                  <Route path="login" element={<Login />} />
                  <Route path="register" element={<Register />} />
                  <Route path="verify-email" element={<VerifyEmail />} />
                  <Route path="forgot-password" element={<ForgotPassword />} />
                  <Route path="reset-password" element={<ResetPassword />} />
                  <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
                  <Route path="dashboard/evaluator" element={<RequireAuth><Evaluator /></RequireAuth>} />
                  <Route path="dashboard/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
                  <Route path="dashboard/roles" element={<RequireAuth><RolesPage /></RequireAuth>} />
                  <Route path="organizations/new" element={<RequireAuth><NewOrganization /></RequireAuth>} />
                  <Route path="demo-project" element={<RequireAuth><DemoProject /></RequireAuth>} />
                  <Route path="projects" element={<RequireAuth><Projects /></RequireAuth>} />
                  <Route path="projects/new" element={<RequireAuth><NewProject /></RequireAuth>} />
                  <Route path="projects/electrical" element={<RequireAuth><ElectricalProject /></RequireAuth>} />
                  <Route path="projects/:id" element={<RequireAuth><ProjectDetail /></RequireAuth>} />
                  <Route path="support" element={<RequireAuth><SupportList /></RequireAuth>} />
                  <Route path="support/new" element={<RequireAuth><SupportNew /></RequireAuth>} />
                  <Route path="support/:id" element={<RequireAuth><SupportDetail /></RequireAuth>} />
                  <Route path="pricing" element={<Pricing />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Route>

                {/* Top-level: bare "/" → default language. */}
                <Route path="/" element={<Navigate to={"/" + DEFAULT_LANG} replace />} />
                {/* Any un-prefixed deep link → same path under the persisted lang. */}
                <Route path="*" element={<LegacyRedirect />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
          </AssistantProvider>
        </LangProvider>
        </BillingProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
