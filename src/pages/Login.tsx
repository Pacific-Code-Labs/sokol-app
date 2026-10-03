import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button, FormField, Input } from "@pacific-code-labs/sokol-design-system";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { emailSchema } from "@/lib/authSchemas";
import { postAuthPath } from "@/lib/demoDraft";
import { localizedPath } from "@/lib/paths";
import { landingHref } from "@/lib/site-links";

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "val_password_required"),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { user, signIn, loading: authLoading } = useAuth();
  const { lang, tr } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  // redirectAfterLogin: RequireAuth stores the intended (already lang-prefixed)
  // path in location.state.from; default to this lang's dashboard.
  const from = postAuthPath(lang, (location.state as { from?: string } | null)?.from ?? localizedPath(lang, "/dashboard"));

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Resolve zod error keys through the dictionary (fall back to the key).
  const tErr = (key?: string) => (key ? (tr as Record<string, string>)[key] ?? key : undefined);

  if (!authLoading && user) return <Navigate to={from} replace />;

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    setSubmitting(true);
    try {
      // signIn() force-clears any stale Cognito session before sign-in.
      const { needsConfirmation } = await signIn(data.email.trim(), data.password);
      if (needsConfirmation) {
        // Unconfirmed user — route to verification with the stashed creds.
        sessionStorage.setItem("verificationEmail", data.email.trim());
        sessionStorage.setItem("verificationPassword", data.password);
        sessionStorage.setItem("redirectAfterLogin", from);
        navigate(localizedPath(lang, "/verify-email"));
        return;
      }
      navigate(from, { replace: true });
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name ?? "";
      const message = e instanceof Error ? e.message : tr.auth_login_error;
      if (name === "UserNotConfirmedException" || message.includes("CONFIRM_SIGN_UP")) {
        sessionStorage.setItem("verificationEmail", data.email.trim());
        sessionStorage.setItem("verificationPassword", data.password);
        sessionStorage.setItem("redirectAfterLogin", from);
        navigate(localizedPath(lang, "/verify-email"));
        return;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = submitting || authLoading;

  return (
    <AuthShell
      title={tr.auth_login_title}
      subtitle={tr.auth_login_subtitle}
      footer={
        <div className="flex flex-col gap-2">
          <Link to={localizedPath(lang, "/forgot-password")} className="text-primary font-medium hover:underline mx-auto">
            {tr.auth_login_forgot}
          </Link>
          <div>
            <span className="text-muted-foreground">{tr.auth_login_no_account} </span>
            <Link to={localizedPath(lang, "/register")} className="text-primary font-medium hover:underline">
              {tr.auth_login_register}
            </Link>
          </div>
          {/* The marketing landing is a separate site (sokol.jcampos.dev). */}
          <a href={landingHref(lang)} className="text-muted-foreground hover:text-foreground mt-1">
            {tr.back_home}
          </a>
        </div>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField label={tr.auth_login_email} error={tErr(form.formState.errors.email?.message)}>
          <Controller
            control={form.control}
            name="email"
            render={({ field }) => (
              <Input type="email" placeholder={tr.auth_login_email_ph} autoFocus disabled={isBusy} {...field} />
            )}
          />
        </FormField>

        <FormField label={tr.auth_login_password} error={tErr(form.formState.errors.password?.message)}>
          <Controller
            control={form.control}
            name="password"
            render={({ field }) => (
              <PasswordField placeholder={tr.auth_login_password_ph} disabled={isBusy} {...field} />
            )}
          />
        </FormField>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" className="w-full mt-1" disabled={isBusy}>
          {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
          {isBusy ? tr.auth_login_submitting : tr.auth_login_submit}
        </Button>
      </form>
    </AuthShell>
  );
}
