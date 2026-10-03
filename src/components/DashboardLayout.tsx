import { ReactNode, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LayoutDashboard, FolderKanban, Sparkles, LogOut, User, ShieldCheck, LifeBuoy } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { BrandLogo, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pacific-code-labs/sokol-design-system";
import { getBrandingVM } from "@/services/branding.service";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { usePermissions } from "@/hooks/useRbac";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GlobalAssistant } from "@/components/GlobalAssistant";
import { localizedPath, stripLangPrefix } from "@/lib/paths";

/** Sidebar nav identifiers (one per item). */
type NavId = "dashboard" | "projects" | "evaluator" | "electrical" | "roles" | "support";

/**
 * NAV_PERMISSION (FCR-061) — maps each sidebar item to the [module, submodule]
 * pair that gates its visibility. MIRRORS the seeded RBAC catalog 1:1 (the
 * rbac-org-modules §2 sidebar↔catalog rule): drift here silently hides items.
 *   dashboard  → panel/overview
 *   projects   → projects/projects
 *   evaluator  → projects/evaluator
 *   roles      → admin/roles   (the new RBAC management item)
 */
// `support` has no RBAC mapping: every signed-in user can ask for help.
const NAV_PERMISSION: Partial<Record<NavId, [string, string]>> = {
  dashboard: ["panel", "overview"],
  projects: ["projects", "projects"],
  evaluator: ["projects", "evaluator"],
  electrical: ["projects", "projects"],
  roles: ["admin", "roles"],
};

interface NavItem {
  id: NavId;
  titleKey: keyof ReturnType<typeof useLang>["tr"] & string;
  url: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

function AppSidebar() {
  const { lang, tr } = useLang();
  const brand = getBrandingVM(lang);
  const { can, isReady } = usePermissions();
  const location = useLocation();
  // The current route stripped of its /:lang prefix — for active-group detection.
  const currentRest = stripLangPrefix(location.pathname).rest;

  /**
   * itemVisible(id) — show when there's no permission mapping, OR permissions
   * haven't resolved yet (fail-open during the RBAC log rollout), OR the role
   * can READ the mapped module/submodule. Mirrors the POS gating rule.
   */
  const itemVisible = (id: NavId): boolean => {
    const perm = NAV_PERMISSION[id];
    if (!perm || !isReady) return true;
    return can(perm[0], "read", perm[1]);
  };

  const workspace: NavItem[] = [
    { id: "dashboard", titleKey: "nav_dashboard", url: "/dashboard", icon: LayoutDashboard, end: true },
    { id: "projects", titleKey: "nav_projects", url: "/projects", icon: FolderKanban },
  ];
  // FCR-118: the electrical preliminary-load study is no longer a standalone
  // nav tool — it's unified under the Projects module (reached from the Projects
  // page), since an electrical study persists as a `project_type: "electrical"`
  // project. This removes the "two repeated modules" overlap with Projects.
  const tools: NavItem[] = [
    { id: "evaluator", titleKey: "nav_evaluator", url: "/dashboard/evaluator", icon: Sparkles },
    { id: "support", titleKey: "nav_support", url: "/support", icon: LifeBuoy },
  ];
  const admin: NavItem[] = [
    { id: "roles", titleKey: "nav_roles", url: "/dashboard/roles", icon: ShieldCheck },
  ];

  const visibleWorkspace = workspace.filter((i) => itemVisible(i.id));
  const visibleTools = tools.filter((i) => itemVisible(i.id));
  const visibleAdmin = admin.filter((i) => itemVisible(i.id));

  const renderItem = (item: NavItem) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton asChild tooltip={tr[item.titleKey]}>
        <NavLink
          to={localizedPath(lang, item.url)}
          end={item.end}
          className="hover:bg-muted/50"
          activeClassName="bg-muted text-primary font-medium"
        >
          <item.icon className="h-4 w-4" />
          <span>{tr[item.titleKey]}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  // A group is open by default when the current route matches one of its items.
  const groupHasActive = (items: NavItem[]): boolean =>
    items.some((i) =>
      i.end ? currentRest === i.url : currentRest === i.url || currentRest.startsWith(i.url + "/"),
    );

  // Collapsible group: a CollapsibleTrigger on the SidebarGroupLabel (rotating
  // chevron) wrapping the menu in CollapsibleContent. Hidden in icon-collapsed
  // mode (the label itself is hidden), defaultOpen when it owns the active route.
  const renderGroup = (labelKey: keyof typeof tr & string, items: NavItem[]) => {
    if (items.length === 0) return null;
    return (
      <Collapsible defaultOpen={groupHasActive(items)} className="group/collapsible">
        <SidebarGroup>
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger className="flex w-full items-center justify-between">
              {tr[labelKey]}
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>{items.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarRail />
      <SidebarHeader>
        <Link to={localizedPath(lang, "/")} className="flex items-center gap-2 px-2 py-1">
          {/* Collapsed sidebar: the mark; expanded: the wordmark (or name) from branding. */}
          <BrandLogo name={brand.companyName} markUrl={brand.markUrl} Icon={brand.LogoIcon} variant="mark" className="hidden group-data-[collapsible=icon]:inline-flex" />
          <span className="group-data-[collapsible=icon]:hidden">
            {brand.logoUrl ? (
              <BrandLogo name={brand.companyName} logoUrl={brand.logoUrl} logoUrlDark={brand.logoUrlDark} imgClassName="h-7" />
            ) : (
              <span className="flex items-center gap-2">
                <BrandLogo name={brand.companyName} markUrl={brand.markUrl} Icon={brand.LogoIcon} variant="mark" />
                <span className="text-sm font-bold tracking-tight">
                  {brand.companyName} <span className="text-primary">{brand.companySuffix}</span>
                </span>
              </span>
            )}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {/* Each group is a collapsible section; a whole group is hidden when
            none of its items are visible. defaultOpen tracks the active route. */}
        {renderGroup("nav_workspace", visibleWorkspace)}
        {renderGroup("nav_tools", visibleTools)}
        {renderGroup("nav_admin", visibleAdmin)}
      </SidebarContent>
      <SidebarFooter>
        <UserBlock />
      </SidebarFooter>
    </Sidebar>
  );
}

function UserBlock() {
  const { user, signOut } = useAuth();
  const { lang, tr } = useLang();
  const navigate = useNavigate();
  const email = (user?.signInDetails?.loginId as string | undefined) ?? user?.username ?? "";

  return (
    <div className="px-2 py-2 space-y-2">
      <div className="text-xs text-muted-foreground truncate group-data-[collapsible=icon]:hidden" title={email}>
        {email}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={() => navigate(localizedPath(lang, "/dashboard/profile"))}
      >
        <User className="h-4 w-4" />
        <span className="group-data-[collapsible=icon]:hidden">{tr.nav_profile}</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={async () => {
          await signOut();
          navigate(localizedPath(lang, "/login"), { replace: true });
        }}
      >
        <LogOut className="h-4 w-4" />
        <span className="group-data-[collapsible=icon]:hidden">{tr.sign_out}</span>
      </Button>
    </div>
  );
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { lang, tr } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const { user } = useAuth();
  // Live support updates (AppSync Events) while any signed-in page is open.
  useRealtimeEvents(user?.userId);

  // Title + active route are computed off the path WITHOUT its /:lang prefix.
  const rest = stripLangPrefix(location.pathname).rest;

  const titleMap: Record<string, string> = {
    "/dashboard": tr.nav_dashboard,
    "/dashboard/evaluator": tr.nav_evaluator,
    "/dashboard/roles": tr.nav_roles,
    "/dashboard/profile": tr.nav_profile,
    "/projects": tr.nav_projects,
    "/projects/new": tr.new_project,
    "/support": tr.nav_support,
  };
  const title =
    titleMap[rest] ??
    (rest.startsWith("/projects/") ? tr.nav_projects : rest.startsWith("/support") ? tr.nav_support : tr.nav_dashboard);

  // Language toggle navigates to the same page under the other lang prefix
  // (wrapped in the lang animation); LangLayout's effect then syncs the context.

  // Scroll the main content back to the top on every route change.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <SidebarProvider>
      <div className="min-h-[100dvh] flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur px-3">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger />
              <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageToggle />
            </div>
          </header>
          <main ref={mainRef} className="flex-1 overflow-auto">
            <div className="container max-w-6xl py-6 px-4 sm:px-6">{children}</div>
          </main>
        </div>
        <GlobalAssistant />
      </div>
    </SidebarProvider>
  );
}
