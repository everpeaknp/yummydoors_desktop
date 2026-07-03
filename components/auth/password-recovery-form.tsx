"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { apiFetch } from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PasswordRecoveryMode = "request" | "confirm";

type PasswordRecoveryFormProps = {
  mode: PasswordRecoveryMode;
};

const contentByMode = {
  request: {
    title: "Reset password",
    description: "Enter your email or phone and we will prepare a reset code.",
    submitLabel: "Send code",
    submittingLabel: "Preparing...",
  },
  confirm: {
    title: "Set new password",
    description: "Enter the reset code and choose a new password.",
    submitLabel: "Update password",
    submittingLabel: "Updating...",
  },
} as const;

export function PasswordRecoveryForm({ mode }: PasswordRecoveryFormProps) {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const content = contentByMode[mode];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setDebugCode(null);
    setIsLoading(true);

    try {
      const response =
        mode === "request"
          ? await apiFetch("/auth/password-reset/request", {
              method: "POST",
              body: JSON.stringify({ identifier }),
            })
          : await apiFetch("/auth/password-reset/confirm", {
              method: "POST",
              body: JSON.stringify({
                identifier,
                code,
                new_password: newPassword,
              }),
            });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? payload.message ?? "Request failed.");
      }

      if (mode === "request") {
        setSuccess("If the account exists, a reset code has been prepared.");
        setDebugCode(payload.data.reset_code ?? null);
      } else {
        setSuccess("Password updated. You can sign in now.");
        setCode("");
        setNewPassword("");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-[460px] rounded-[2rem] border border-white/80 bg-white/88 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <CardContent className="p-8 sm:p-10">
        <div className="mb-8 text-center">
          <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-foreground">
            {content.title}
          </h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {content.description}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
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

          {mode === "confirm" ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Reset code</label>
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="6 digit code"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">New password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
            </>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-[#ffd8cc] bg-[#fff4ef] px-4 py-3 text-sm text-[#9a3412]">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-[#dbead7] bg-[#f4fbf2] px-4 py-3 text-sm text-[#215732]">
              {success}
              {debugCode ? ` Local reset code: ${debugCode}` : ""}
            </div>
          ) : null}

          <Button className="mt-2 h-12 w-full rounded-2xl text-sm font-semibold shadow-none" disabled={isLoading} type="submit">
            {isLoading ? content.submittingLabel : content.submitLabel}
          </Button>
        </form>

        <div className="mt-6 border-t border-black/5 pt-5 text-center text-sm">
          <Link className="font-medium text-foreground transition hover:text-primary" href="/login">
            Back to sign in
          </Link>
          {mode === "request" ? (
            <>
              <span className="mx-2 text-muted-foreground">or</span>
              <Link className="font-medium text-foreground transition hover:text-primary" href="/reset-password">
                I already have a code
              </Link>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
