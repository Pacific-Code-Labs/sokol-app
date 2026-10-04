import { ReactNode } from "react";
import { BrandLogo, Card, CardBody, CardHeader, CardTitle, CardDescription } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { getBrandingVM } from "@/services/branding.service";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * AuthShell — the shared frame for every unauthenticated auth screen
 * (Login / Register / VerifyEmail / ForgotPassword / ResetPassword).
 *
 * Adapts the POS `AuthLayout` to Sóköl: centered card, Sóköl brand
 * lockup, a theme toggle, and DS `Card` primitives. Copy is passed in by the
 * caller (bilingual via LangContext) — this shell hardcodes no user-facing text
 * beyond the brand name.
 */
export function AuthShell({
  title,
  subtitle,
  icon,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional icon node shown in a pill above the title (e.g. a lock). */
  icon?: ReactNode;
  children: ReactNode;
  /** Optional footer area below the card body (links, etc.). */
  footer?: ReactNode;
}) {
  const { lang } = useLang();
  const brand = getBrandingVM(lang);
  return (
    <div className="premium-auth min-h-[100dvh] grid place-items-center bg-background px-4 py-10 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle />
        <LanguageToggle />
      </div>
      <div className="w-full max-w-md">
        {/* Brand lockup only (not a link): "back" on each screen leads to the landing. */}
        <div className="flex items-center gap-3 justify-center mb-6">
          <BrandLogo
            name={brand.companyName}
            suffix={brand.companySuffix}
            logoUrl={brand.logoUrl}
            logoUrlDark={brand.logoUrlDark}
            markUrl={brand.markUrl}
            Icon={brand.LogoIcon}
            imgClassName="h-10"
          />
        </div>

        <Card className="premium-auth-card">
          <CardHeader className="text-center pb-2">
            {icon && (
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-primary/30 text-primary">
                {icon}
              </div>
            )}
            <CardTitle className="t-h3">{title}</CardTitle>
            {subtitle && <CardDescription>{subtitle}</CardDescription>}
          </CardHeader>
          <CardBody>{children}</CardBody>
        </Card>

        {footer && <div className="mt-5 text-center text-sm">{footer}</div>}
      </div>
    </div>
  );
}
