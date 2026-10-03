import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button, FormField, Input } from "@pacific-code-labs/sokol-design-system";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import {
  registerInfoSchema,
  registerPasswordSchema,
  type RegisterInfoForm,
  type RegisterPasswordForm,
} from "@/lib/authSchemas";
import { postAuthPath, pendingDemoDraft, clearDemoDraft } from "@/lib/demoDraft";
import { localizedPath } from "@/lib/paths";

type Step = "info" | "password";

export default function Register() {
  const navigate = useNavigate();
  const { signUp, user, loading: authLoading } = useAuth();
  const { lang, tr } = useLang();

  const [pendingDraft, setPendingDraft] = useState(pendingDemoDraft);
  const [step, setStep] = useState<Step>("info");
  const [infoData, setInfoData] = useState<RegisterInfoForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tErr = (key?: string) => (key ? (tr as Record<string, string>)[key] ?? key : undefined);

  const infoForm = useForm<RegisterInfoForm>({
    resolver: zodResolver(registerInfoSchema),
    defaultValues: { firstName: "", lastName: "", username: "", email: "" },
  });

  const pwForm = useForm<RegisterPasswordForm>({
    resolver: zodResolver(registerPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const currentPassword = pwForm.watch("password") || "";

  // Restore step-1 values when the user navigates back.
  useEffect(() => {
    if (infoData && step === "info") infoForm.reset(infoData);
  }, [infoData, step, infoForm]);

  const handleInfoSubmit = (values: RegisterInfoForm) => {
    setInfoData(values);
    setError(null);
    setStep("password");
  };

  const handlePasswordSubmit = async (values: RegisterPasswordForm) => {
    if (!infoData) {
      setError(tr.auth_register_complete_step1);
      setStep("info");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { needsConfirmation } = await signUp({
        username: infoData.email.trim(),
        password: values.password,
        firstName: infoData.firstName,
        lastName: infoData.lastName,
        preferredUsername: infoData.username,
        email: infoData.email.trim(),
        locale: lang,
      });

      if (needsConfirmation) {
        // Stash everything VerifyEmail needs to auto sign-in after confirmation.
        sessionStorage.setItem("verificationEmail", infoData.email.trim());
        sessionStorage.setItem("verificationPassword", values.password);
        navigate(localizedPath(lang, "/verify-email"));
      } else {
        navigate(postAuthPath(lang), { replace: true });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : tr.auth_register_error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!authLoading && user) return <Navigate to={postAuthPath(lang)} replace />;

  return (
    <AuthShell
      title={tr.auth_register_title}
      subtitle={tr.auth_register_subtitle}
      footer={
        <div>
          <span className="text-muted-foreground">{tr.auth_register_has_account} </span>
          <Link to={localizedPath(lang, "/login")} className="text-primary font-medium hover:underline">
            {tr.auth_register_sign_in}
          </Link>
        </div>
      }
    >
      {pendingDraft && <div className="mb-4 space-y-2 text-sm text-muted-foreground">
        <p>{tr.demo_draft_pending}</p>
        <Button variant="ghost" size="sm" onClick={() => {
          clearDemoDraft(pendingDraft.draftId); setPendingDraft(null);
        }}>{tr.demo_draft_discard}</Button>
      </div>}
      {step === "info" ? (
        <form onSubmit={infoForm.handleSubmit(handleInfoSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={tr.auth_register_first_name} required error={tErr(infoForm.formState.errors.firstName?.message)}>
              <Controller
                control={infoForm.control}
                name="firstName"
                render={({ field }) => <Input placeholder={tr.auth_register_first_name_ph} autoFocus {...field} />}
              />
            </FormField>
            <FormField label={tr.auth_register_last_name} required error={tErr(infoForm.formState.errors.lastName?.message)}>
              <Controller
                control={infoForm.control}
                name="lastName"
                render={({ field }) => <Input placeholder={tr.auth_register_last_name_ph} {...field} />}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
            <FormField label={tr.auth_register_email} required error={tErr(infoForm.formState.errors.email?.message)}>
              <Controller
                control={infoForm.control}
                name="email"
                render={({ field }) => <Input type="email" placeholder={tr.auth_register_email_ph} {...field} />}
              />
            </FormField>
            <FormField label={tr.auth_register_username} required error={tErr(infoForm.formState.errors.username?.message)}>
              <Controller
                control={infoForm.control}
                name="username"
                render={({ field }) => <Input placeholder={tr.auth_register_username_ph} {...field} />}
              />
            </FormField>
          </div>

          <Button type="submit" variant="primary" className="w-full mt-1">
            {tr.auth_register_continue}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <form onSubmit={pwForm.handleSubmit(handlePasswordSubmit)} className="flex flex-col gap-4">
          <FormField label={tr.auth_register_password} required error={tErr(pwForm.formState.errors.password?.message)}>
            <Controller
              control={pwForm.control}
              name="password"
              render={({ field }) => <PasswordField placeholder={tr.auth_register_password_ph} autoFocus {...field} />}
            />
          </FormField>

          {currentPassword && <PasswordStrengthIndicator password={currentPassword} />}

          <FormField
            label={tr.auth_register_confirm_password}
            required
            error={tErr(pwForm.formState.errors.confirmPassword?.message)}
          >
            <Controller
              control={pwForm.control}
              name="confirmPassword"
              render={({ field }) => <PasswordField placeholder={tr.auth_register_confirm_password_ph} {...field} />}
            />
          </FormField>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-3 mt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("info")} disabled={submitting}>
              <ArrowLeft className="h-4 w-4" />
              {tr.auth_register_back}
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? tr.auth_register_creating : tr.auth_register_create}
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
