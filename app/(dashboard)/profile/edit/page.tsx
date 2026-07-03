"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { mergeStoredUserWithProfile } from "@/lib/auth-mappers";
import { apiFetch } from "@/lib/http";
import { useAuthStore } from "@/stores/auth-store";

export default function EditProfilePage() {
  const router = useRouter();
  const { hydrated, accessToken } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!accessToken) {
      router.replace("/login");
      return;
    }

    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;

    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      try {
        const response = await apiFetch("/me/profile", { auth: true });
        if (!response.ok) {
          throw new Error("Failed to load your profile.");
        }
        const payload = await response.json();
        if (!cancelled) {
          setFullName(payload.full_name ?? "");
          setPhone(payload.phone ?? "");
          setEmail(payload.email ?? "");
          const storedUser = useAuthStore.getState().user;
          if (storedUser) {
            setUser(mergeStoredUserWithProfile(storedUser, payload));
          }
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load your profile.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken, router, setUser]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiFetch("/me/profile", {
        auth: true,
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail ?? "Failed to update profile.");
      }

      const storedUser = useAuthStore.getState().user;
      if (storedUser) {
        setUser(mergeStoredUserWithProfile(storedUser, payload));
      }
      setSuccess("Profile updated.");
      setTimeout(() => router.replace("/profile"), 600);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Preparing profile...</div>;
  }

  if (!accessToken) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd]">
      <SiteNavbar className="sticky top-0 z-40" />
      <main className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Edit profile</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Update the same account identity fields shown in the Flutter app: name, phone number, and email.
            </p>
          </div>

          <Card className="max-w-3xl">
            <CardContent className="space-y-6">
              {error ? (
                <div className="rounded-2xl border border-[#ffd8cc] bg-[#fff4ef] px-4 py-3 text-sm text-[#9a3412]">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-2xl border border-[#d8f3dc] bg-[#f3fff7] px-4 py-3 text-sm text-[#166534]">
                  {success}
                </div>
              ) : null}

              {loading ? (
                <p className="text-sm text-muted-foreground">Loading profile...</p>
              ) : (
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Name</label>
                    <Input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Sanya Sharma"
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Phone Number</label>
                    <Input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+977 98XXXXXXXX"
                      autoComplete="tel"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="sanyasharma@gmail.com"
                      autoComplete="email"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button disabled={saving} type="submit">
                      {saving ? "Saving..." : "Update Profile"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => router.replace("/profile")}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
