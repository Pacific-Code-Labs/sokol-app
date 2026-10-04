import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { Button } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { localizedPath } from "@/lib/paths";

/**
 * NewOrganization — a thin informational placeholder at /organizations/new.
 *
 * Sóköl does NOT need an FE org-create form: the backend auto-provisions the
 * personal organization + owner role + Free subscription on the user's first
 * authenticated call (`get_current_context` in sokol-api, FCR-008/021). This
 * page just explains that and links back to the dashboard. A real org-management
 * surface (rename / invite members) is future RBAC UI work (FCR-061).
 */
export default function NewOrganization() {
  const { lang, tr } = useLang();
  const navigate = useNavigate();

  return (
    <>
      <div className="max-w-xl mx-auto text-center py-10">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/30 text-primary">
          <Building2 className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight mb-2">{tr.org_new_title}</h1>
        <p className="text-sm text-muted-foreground mb-2">{tr.org_new_subtitle}</p>
        <p className="text-sm text-muted-foreground mb-6">{tr.org_new_auto}</p>
        <Button variant="primary" onClick={() => navigate(localizedPath(lang, "/dashboard"))}>
          {tr.org_new_continue}
        </Button>
      </div>
    </>
  );
}
