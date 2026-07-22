"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { mapStoredAuth } from "@/lib/auth-mappers";
import { apiFetch } from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
};

type ApiValidationIssue = {
  loc?: Array<string | number>;
  msg?: string;
};

const contentByMode = {
  login: {
    title: "Sign in",
    description: "Use your YummyDoors account to continue.",
    submitLabel: "Continue",
    submittingLabel: "Signing in...",
    altCtaLabel: "New to YummyDoors?",
    altCtaAction: "Create account",
    altCtaHref: "/signup",
  },
  signup: {
    title: "Create account",
    description: "Set up your YummyDoors account and continue into the customer experience.",
    submitLabel: "Create account",
    submittingLabel: "Creating account...",
    altCtaLabel: "Already have an account?",
    altCtaAction: "Sign in",
    altCtaHref: "/login",
  },
} as const;

function formatFieldName(segment: string | number | undefined) {
  if (segment === undefined) {
    return "Field";
  }

  return String(segment)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function extractApiErrorMessage(payload: any) {
  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
    return payload.detail
      .map((issue: ApiValidationIssue) => {
        const field = issue.loc?.[issue.loc.length - 1];
        if (typeof issue.msg === "string" && issue.msg.trim()) {
          return field && field !== "body"
            ? `${formatFieldName(field)}: ${issue.msg}`
            : issue.msg;
        }
        return null;
      })
      .filter(Boolean)
      .join(" ");
  }

  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return "Authentication failed.";
}

function validateAuthForm(params: {
  mode: AuthMode;
  identifier: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
}) {
  const { mode, identifier, fullName, email, phone, password } = params;

  if (mode === "login") {
    if (identifier.trim().length < 3) {
      return "Email or phone must be at least 3 characters.";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    return null;
  }

  if (fullName.trim().length < 2) {
    return "Full name must be at least 2 characters.";
  }
  if (!email.trim() && !phone.trim()) {
    return "Either email or phone is required.";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [accountType, setAccountType] = useState<"customer" | "restaurant">("customer");
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const content = contentByMode[mode];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateAuthForm({
      mode,
      identifier,
      fullName,
      email,
      phone,
      password,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const response =
        mode === "login"
          ? await apiFetch("/auth/login", {
              method: "POST",
              body: JSON.stringify({ identifier, password }),
            })
          : await apiFetch("/auth/register", {
              method: "POST",
              body: JSON.stringify({
                full_name: fullName,
                email: email || null,
                phone: phone || null,
                password,
                link_existing_pos_account: false,
              }),
            });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload));
      }

      const data = mapStoredAuth(payload.data);
      setAuth(data, rememberMe);
      
      if (mode === "signup" && accountType === "restaurant") {
        router.replace("/merchant/onboarding");
      } else {
        router.replace("/");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-[460px] rounded-[2rem] border border-white/80 bg-white/88 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <CardContent className="p-8 sm:p-9">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 rounded-[1.75rem] bg-[#fff8f4] p-4">
            <Image
              src="/Yummy_Doors-Png.png"
              alt="YummyDoors"
              width={88}
              height={88}
              className="h-auto w-[78px]"
              priority
            />
          </div>
          <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-foreground">
            {content.title}
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-7 text-muted-foreground">
            {content.description}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <>
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium text-foreground">Account type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAccountType("customer")}
                    className={`flex items-center justify-center rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                      accountType === "customer"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType("restaurant")}
                    className={`flex items-center justify-center rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                      accountType === "restaurant"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    Restaurant
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Full name</label>
                <Input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder={accountType === "restaurant" ? "Owner Name" : "Ram Bahadur"}
                  autoComplete="name"
                  required
                />
              </div>
            </>
          ) : null}

          {mode === "login" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email or phone</label>
              <Input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="owner@restaurant.com"
                autoComplete="username"
                required
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="owner@restaurant.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Phone</label>
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+977 98XXXXXXXX"
                  autoComplete="tel"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-foreground">Password</label>
                {mode === "login" ? (
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    Forgot?
                  </Link>
                ) : null}
              </div>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "login" ? "Enter your password" : "Minimum 8 characters"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>

          {mode === "login" ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Remember me on this device
            </label>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-[#ffd8cc] bg-[#fff4ef] px-4 py-3 text-sm text-[#9a3412]">
              {error}
            </div>
          ) : null}

          <Button
            className="mt-1 h-12 w-full rounded-2xl text-sm font-semibold shadow-none"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? content.submittingLabel : content.submitLabel}
          </Button>
        </form>

        {mode === "login" ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-black/6" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                or
              </span>
              <div className="h-px flex-1 bg-black/6" />
            </div>
            <GoogleSignInButton />
          </div>
        ) : null}

        <div className="mt-6 border-t border-black/5 pt-5 text-center text-sm">
          <span className="text-muted-foreground">{content.altCtaLabel} </span>
          <Link className="font-medium text-foreground transition hover:text-primary" href={content.altCtaHref}>
            {content.altCtaAction}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
