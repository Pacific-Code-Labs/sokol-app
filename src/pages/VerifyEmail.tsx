import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MailCheck, RefreshCw } from "lucide-react";
import { Button, FormField, OtpInput } from "@pacific-code-labs/sokol-design-system";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { postAuthPath } from "@/lib/demoDraft";
import { localizedPath } from "@/lib/paths";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmail() {
  const { confirmSignUp, signIn, resendCode } = useAuth();
  const { lang, tr } = useLang();
  const navigate = useNavigate();

  const verifyingRef = useRef(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Guard: require a stashed verification email, else bounce to register.
  useEffect(() => {
    const stored = sessionStorage.getItem("verificationEmail");
    if (stored) setEmail(stored);
    else navigate(localizedPath(lang, "/register"));
  }, [navigate, lang]);

  // Resend cooldown timer.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const handleVerify = async (completedCode: string) => {
    if (verifyingRef.current || !email) return;
    if (!/^\d{6}$/.test(completedCode)) {
      setError(tr.auth_verify_incorrect_code);
      return;
    }
    verifyingRef.current = true;
    setVerifying(true);
    setError(null);
    try {
      try {
        await confirmSignUp(email, completedCode);
      } catch (e: unknown) {
        // The PostConfirmation trigger (saves the user in the DB) runs after Cognito has
        // already confirmed the account; a trigger timeout surfaces as this error. The account
        // is confirmed and the API provisions on the first call, so carry on.
        if ((e as { name?: string })?.name !== "UserLambdaValidationException") throw e;
      }

      // Auto sign-in after verification. The user row + personal org were saved by the
      // PostConfirmation trigger (the API re-checks on the first authenticated call — FCR-008/021).
      const password = sessionStorage.getItem("verificationPassword");
      const redirectTo = postAuthPath(lang, sessionStorage.getItem("redirectAfterLogin") ?? localizedPath(lang, "/dashboard"));
      if (password) {
        await signIn(email, password);
      }

      sessionStorage.removeItem("verificationEmail");
      sessionStorage.removeItem("verificationPassword");
      sessionStorage.removeItem("redirectAfterLogin");

      navigate(password ? redirectTo : localizedPath(lang, "/login"), { replace: true });
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name ?? "";
      const message = e instanceof Error ? e.message : tr.auth_verify_error;
      if (name === "CodeMismatchException") setError(tr.auth_verify_incorrect_code);
      else if (name === "ExpiredCodeException") setError(tr.auth_verify_expired_code);
      else setError(message);
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      await resendCode(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setInfo(tr.auth_verify_resend_success);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : tr.auth_verify_error);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title={tr.auth_verify_title}
      subtitle={
        <>
          {tr.auth_verify_subtitle} <span className="font-medium text-primary">{email}</span>
        </>
      }
      icon={<MailCheck className="h-6 w-6" />}
      footer={
        <button type="button" className="text-primary font-medium hover:underline" onClick={() => navigate(localizedPath(lang, "/register"))}>
          {tr.auth_verify_back_to_register}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <FormField label={tr.auth_verify_code} error={error ?? undefined} className="items-center text-center">
          <OtpInput value={code} onChange={(next) => { setCode(next); setError(null); }}
            onComplete={(completed) => { void handleVerify(completed); }} aria-label={tr.auth_verify_code}
            className="justify-center" autoFocus disabled={verifying} invalid={!!error} />
        </FormField>

        {info && <p className="text-sm text-cat-actuation">{info}</p>}

        <Button variant="primary" size="lg" className="w-full" onClick={() => { void handleVerify(code); }} disabled={verifying || code.length !== 6}>
          {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
          {verifying ? tr.auth_verify_submitting : tr.auth_verify_submit}
        </Button>

        <div className="text-center flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{tr.auth_verify_didnt_receive}</p>
          <Button variant="outline" className="mx-auto" onClick={handleResend} disabled={resending || cooldown > 0}>
            <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
            {resending
              ? tr.auth_verify_resending
              : cooldown > 0
                ? tr.auth_verify_resend_cooldown.replace("{seconds}", String(cooldown))
                : tr.auth_verify_resend}
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
