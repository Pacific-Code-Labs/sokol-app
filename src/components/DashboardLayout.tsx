import { useEffect } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Sparkles, LogOut, User, ShieldCheck, LifeBuoy, Menu, BookOpen } from "lucide-react";
import { AppShell, BrandLogo, type NavGroup, type NavItem } from "@pacific-code-labs/sokol-design-system";
import { getBrandingVM } from "@/services/branding.service";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { usePermissions } from "@/hooks/useRbac";
import { useMe } from "@/hooks/useMe";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppTutorial } from "@/components/AppTutorial";
import { NewProjectDrawer } from "@/components/NewProjectDrawer";
import { GlobalAssistant } from "@/components/GlobalAssistant";
import { PageTransition } from "@/components/PageTransition";
import { localizedPath, stripLangPrefix } from "@/lib/paths";
import { displayName } from "@/lib/display-name";

/** Persistent product shell. Only the outlet participates in route transitions. */
export function DashboardLayout() {
  const { lang, tr } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const permissions = usePermissions();
  const { tier } = useMe();
  const brand = getBrandingVM(lang);
  const rest = stripLangPrefix(location.pathname).rest;
  useRealtimeEvents(user?.userId);
  const visible = (module: string, submodule: string) => !permissions.isReady || permissions.can(module, "read", submodule);
  const item = (href: string, label: string, icon: NavItem["icon"], end = false): NavItem => ({ href: localizedPath(lang, href), label, icon, end });
  const topItems = visible("panel", "overview") ? [item("/dashboard", tr.nav_dashboard, LayoutDashboard, true)] : [];
  const groups: NavGroup[] = [
    { key: "workspace", label: tr.nav_workspace, icon: FolderKanban, items: visible("projects", "projects") ? [item("/projects", tr.nav_projects, FolderKanban)] : [] },
    { key: "tools", label: tr.nav_tools, icon: Sparkles, items: [...(visible("projects", "evaluator") ? [item("/dashboard/evaluator", tr.nav_evaluator, Sparkles)] : []), item("/assistant-guide", tr.guide_title, BookOpen), item("/support", tr.nav_support, LifeBuoy)] },
    { key: "admin", label: tr.nav_admin, icon: ShieldCheck, items: tier === "enterprise" && permissions.isReady && (permissions.isAdmin || permissions.isOwner) ? [item("/dashboard/roles", tr.nav_roles, ShieldCheck)] : [] },
  ].filter((group) => group.items.length > 0);
  const titleMap: Record<string, string> = { "/assistant-guide": tr.guide_title, "/dashboard": tr.nav_dashboard, "/dashboard/evaluator": tr.nav_evaluator, "/dashboard/roles": tr.nav_roles, "/dashboard/profile": tr.nav_profile, "/projects": tr.nav_projects, "/projects/new": tr.new_project, "/support": tr.nav_support, "/pricing": tr.pricing_title };
  const title = titleMap[rest] ?? (rest.startsWith("/projects/") ? tr.nav_projects : rest.startsWith("/support") ? tr.nav_support : tr.nav_dashboard);
  const name = displayName(profile, user);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  return <>
    <div className="premium-workspace"><AppShell location={location.pathname} topItems={topItems} groups={groups} onNavigate={navigate}
      navigationStyle="compact" sidebarStorageKey="sokol-app-sidebar-collapsed"
      labels={{ expand: tr.nav_show_sidebar, collapse: tr.nav_hide_sidebar, close: tr.nav_close_menu }}
      brand={() => <BrandLogo name={brand.companyName} logoUrl={brand.logoUrl} logoUrlDark={brand.logoUrlDark} markUrl={brand.markUrl} Icon={brand.LogoIcon} imgClassName="h-7" />}
      topbar={(openMenu) => <header className="workspace-topbar flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={openMenu} aria-label={tr.nav_show_sidebar} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted lg:hidden"><Menu className="h-5 w-5" /></button>
          <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-2">{user && <AppTutorial key={user.userId} userId={user.userId} ready={permissions.isReady} dashboard={visible("panel", "overview")} projects={visible("projects", "projects")} evaluator={visible("projects", "evaluator")} />}<ThemeToggle /><LanguageToggle /></div>
      </header>}
      footer={() => <div className="space-y-1">
        <button type="button" onClick={() => navigate(localizedPath(lang, "/dashboard/profile"))} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-sidebar-accent ${rest === "/dashboard/profile" ? "bg-primary/10 text-primary" : "text-sidebar-foreground"}`}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{name.slice(0, 2).toUpperCase() || <User className="h-4 w-4" />}</span>
          <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{name || tr.nav_profile}</span><span className="block text-xs text-muted-foreground">{tr.nav_profile}</span></span>
        </button>
        <button type="button" onClick={async () => { await signOut(); navigate(localizedPath(lang, "/login"), { replace: true }); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent"><LogOut className="h-4 w-4" />{tr.sign_out}</button>
      </div>}
    ><div className="mx-auto max-w-6xl"><PageTransition><Outlet /></PageTransition></div></AppShell></div>
    <GlobalAssistant />
    <NewProjectDrawer />
  </>;
}
