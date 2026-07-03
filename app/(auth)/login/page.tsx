import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell
      badge="YummyDoors"
      title="Restaurant delivery, kept simple."
      description="Sign in to manage your YummyDoors account and continue into the workspace."
      points={[
        "Fast sign in for owners and operations staff",
        "Clean account-first flow",
        "POS linking can stay separate from onboarding",
      ]}
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
