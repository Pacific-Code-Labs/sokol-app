import { BrandLogo } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { getBrandingVM } from "@/services/branding.service";
import { cn } from "@/lib/utils";

/** The approved Sóköl symbol beside messages, welcome and typing states. */
export function AssistantAvatar({ className }: { className?: string }) {
  const { lang } = useLang();
  const brand = getBrandingVM(lang);
  return (
    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center", className)} aria-hidden>
      <BrandLogo name={brand.companyName} markUrl={brand.markUrl} Icon={brand.LogoIcon} variant="mark" imgClassName="h-full w-full" className="h-full w-full" />
    </div>
  );
}
