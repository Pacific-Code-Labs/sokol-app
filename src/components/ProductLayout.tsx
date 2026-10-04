import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageTransition } from "@/components/PageTransition";
import { stripLangPrefix } from "@/lib/paths";

/** One stable parent for every product section, including signed-in pricing. */
export function ProductLayout() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (!user && !loading && stripLangPrefix(pathname).rest === "/pricing") {
    return <PageTransition><Outlet /></PageTransition>;
  }
  return <RequireAuth><DashboardLayout /></RequireAuth>;
}
