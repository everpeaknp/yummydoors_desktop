import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      badge="YummyDoors"
      title="Choose a new password."
      description="Enter your reset code and set a new password for your YummyDoors account."
      points={[
        "Reset codes expire automatically",
        "Password updates invalidate old sessions",
        "Sign in again after reset completes",
      ]}
    >
      <PasswordRecoveryForm mode="confirm" />
    </AuthShell>
  );
}
