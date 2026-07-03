import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      badge="YummyDoors"
      title="Recover access."
      description="Request a reset code for your YummyDoors account and continue securely."
      points={[
        "Works with email or phone",
        "One active reset code at a time",
        "Existing sessions are revoked after reset",
      ]}
    >
      <PasswordRecoveryForm mode="request" />
    </AuthShell>
  );
}
