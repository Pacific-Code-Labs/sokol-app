import { RemainingUsagePanel } from "@/components/RemainingUsagePanel";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Lock, Pencil, User as UserIcon } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  FormField,
  Input,
} from "@pacific-code-labs/sokol-design-system";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { PasswordField } from "@/components/auth/PasswordField";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { passwordSchema, usernameSchema } from "@/lib/authSchemas";

const profileSchema = z.object({
  firstName: z.string().min(1, "val_first_name_required"),
  lastName: z.string().min(1, "val_last_name_required"),
  username: usernameSchema,
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "profile_current_password_required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "val_passwords_dont_match",
    path: ["confirmPassword"],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export default function ProfilePage() {
  const { profile, updateProfile, updatePassword } = useAuth();
  const { tr } = useLang();

  const [isEditing, setIsEditing] = useState(false);
  const [securityView, setSecurityView] = useState<"menu" | "changePassword">("menu");
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const tErr = (key?: string) => (key ? (tr as Record<string, string>)[key] ?? key : undefined);
  const placeholder = tr.profile_not_specified;

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      username: profile?.username ?? "",
    },
  });

  const pwForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const newPasswordValue = pwForm.watch("newPassword") || "";

  const startEdit = () => {
    profileForm.reset({
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      username: profile?.username ?? "",
    });
    setIsEditing(true);
  };

  const handleProfileSubmit = async (values: ProfileForm) => {
    setSavingProfile(true);
    try {
      await updateProfile(values); // writes Cognito attrs + syncs the cache live
      toast.success(tr.profile_updated);
      setIsEditing(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : tr.profile_update_error);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (values: ChangePasswordForm) => {
    setChangingPassword(true);
    try {
      await updatePassword(values.currentPassword, values.newPassword);
      toast.success(tr.profile_password_changed);
      pwForm.reset();
      setSecurityView("menu");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : tr.profile_password_change_error);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 border border-primary/30 text-primary">
            <UserIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{tr.profile_title}</h1>
            <p className="text-sm text-muted-foreground">{tr.profile_subtitle}</p>
          </div>
        </div>

        <RemainingUsagePanel />
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Personal info ───────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-primary" />
                  <CardTitle>{tr.profile_personal_info}</CardTitle>
                </div>
                {!isEditing && (
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    {tr.profile_edit}
                  </Button>
                )}
              </div>
              <CardDescription>{isEditing ? tr.profile_update_info : tr.profile_contact_info}</CardDescription>
            </CardHeader>
            <CardBody>
              {!isEditing ? (
                <div className="flex flex-col gap-4">
                  <Field label={tr.profile_first_name} value={profile?.firstName || placeholder} />
                  <Field label={tr.profile_last_name} value={profile?.lastName || placeholder} />
                  <Field label={tr.profile_email} value={profile?.email || placeholder} />
                  <Field label={tr.profile_username} value={profile?.username || placeholder} />
                </div>
              ) : (
                <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label={tr.profile_first_name} required error={tErr(profileForm.formState.errors.firstName?.message)}>
                      <Controller control={profileForm.control} name="firstName" render={({ field }) => <Input {...field} />} />
                    </FormField>
                    <FormField label={tr.profile_last_name} required error={tErr(profileForm.formState.errors.lastName?.message)}>
                      <Controller control={profileForm.control} name="lastName" render={({ field }) => <Input {...field} />} />
                    </FormField>
                  </div>

                  <FormField label={tr.profile_username} required error={tErr(profileForm.formState.errors.username?.message)}>
                    <Controller control={profileForm.control} name="username" render={({ field }) => <Input {...field} />} />
                  </FormField>

                  {/* Email is the Cognito sign-in identity — read-only, never sent. */}
                  <FormField label={tr.profile_email} hint={tr.profile_email_readonly}>
                    <Input value={profile?.email ?? ""} readOnly disabled />
                  </FormField>

                  <div className="flex gap-3 pt-1">
                    <Button type="submit" variant="primary" className="flex-1" disabled={savingProfile}>
                      {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                      {savingProfile ? tr.profile_saving : tr.profile_save}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={savingProfile}>
                      {tr.profile_cancel}
                    </Button>
                  </div>
                </form>
              )}
            </CardBody>
          </Card>

          {/* ── Security ────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <CardTitle>{tr.profile_security}</CardTitle>
              </div>
              <CardDescription>{tr.profile_security_desc}</CardDescription>
            </CardHeader>
            <CardBody>
              {securityView === "menu" ? (
                <button
                  type="button"
                  onClick={() => setSecurityView("changePassword")}
                  className="flex items-center gap-3 w-full text-left p-4 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Lock className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{tr.profile_change_password}</div>
                    <div className="text-xs text-muted-foreground">{tr.profile_change_password_desc}</div>
                  </div>
                </button>
              ) : (
                <div className="flex flex-col gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => {
                      pwForm.reset();
                      setSecurityView("menu");
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {tr.profile_back}
                  </Button>

                  <form onSubmit={pwForm.handleSubmit(handlePasswordSubmit)} className="flex flex-col gap-4">
                    <FormField
                      label={tr.profile_current_password}
                      required
                      error={tErr(pwForm.formState.errors.currentPassword?.message)}
                    >
                      <Controller
                        control={pwForm.control}
                        name="currentPassword"
                        render={({ field }) => <PasswordField {...field} />}
                      />
                    </FormField>

                    <FormField label={tr.profile_new_password} required error={tErr(pwForm.formState.errors.newPassword?.message)}>
                      <Controller control={pwForm.control} name="newPassword" render={({ field }) => <PasswordField {...field} />} />
                    </FormField>

                    {newPasswordValue && <PasswordStrengthIndicator password={newPasswordValue} />}

                    <FormField
                      label={tr.profile_confirm_password}
                      required
                      error={tErr(pwForm.formState.errors.confirmPassword?.message)}
                    >
                      <Controller
                        control={pwForm.control}
                        name="confirmPassword"
                        render={({ field }) => <PasswordField {...field} />}
                      />
                    </FormField>

                    <Button type="submit" variant="primary" className="w-full" disabled={changingPassword}>
                      {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                      {changingPassword ? tr.profile_saving : tr.profile_change_password}
                    </Button>
                  </form>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="t-label">{label}</div>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
