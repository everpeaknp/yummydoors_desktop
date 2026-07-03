import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignupPage() {
  return (
    <AuthShell
      badge="YummyDoors"
      title="Create your account."
      description="Start with a clean YummyDoors account. Restaurant access and POS links can be added after sign up."
      points={[
        "Email or phone based registration",
        "Optional POS matching intent",
        "Automatic sign-in after registration",
      ]}
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
