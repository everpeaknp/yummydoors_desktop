"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Trash2, UserCircle2 } from "lucide-react";

import { SiteNavbar } from "@/components/layout/site-navbar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { mergeStoredUserWithProfile } from "@/lib/auth-mappers";
import { apiFetch } from "@/lib/http";
import { useAuthStore } from "@/stores/auth-store";

const PHONE_COUNTRIES = [
  { iso2: "NP", name: "Nepal", dialCode: "+977", flagEmoji: "🇳🇵" },
  { iso2: "IN", name: "India", dialCode: "+91", flagEmoji: "🇮🇳" },
  { iso2: "US", name: "United States", dialCode: "+1", flagEmoji: "🇺🇸" },
];

function splitPhoneFallback(phone: string | null | undefined) {
  const raw = phone?.trim() ?? "";
  const matched = PHONE_COUNTRIES.find((country) => raw.startsWith(country.dialCode));
  if (!matched) {
    return { countryCode: "+977", nationalNumber: raw.replace(/[^\d]/g, "") };
  }

  return {
    countryCode: matched.dialCode,
    nationalNumber: raw.slice(matched.dialCode.length).replace(/[^\d]/g, ""),
  };
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    const detail = payload?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail) && detail[0]?.msg) {
      return detail[0].msg;
    }
  } catch {
    // Ignore non-JSON error bodies.
  }
  return fallback;
}

export default function EditProfilePage() {
  const router = useRouter();
  const { hydrated, accessToken } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [fullName, setFullName] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+977");
  const [phoneNationalNumber, setPhoneNationalNumber] = useState("");
  const [phoneCanEdit, setPhoneCanEdit] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!accessToken) {
      router.replace("/login");
      return;
    }

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
          const fallbackPhone = splitPhoneFallback(payload.phone);
          setPhoneCountryCode(payload.phone_country_code ?? fallbackPhone.countryCode);
          setPhoneNationalNumber(payload.phone_national_number ?? fallbackPhone.nationalNumber);
          setPhoneCanEdit(payload.phone_can_edit !== false);
          setAvatarUrl(payload.avatar_url ?? null);
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

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setUploadingAvatar(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiFetch("/me/profile/avatar", {
        auth: true,
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to upload profile picture."));
      }

      const payload = await response.json();
      setAvatarUrl(payload.avatar_url ?? null);
      const storedUser = useAuthStore.getState().user;
      if (storedUser) {
        setUser(mergeStoredUserWithProfile(storedUser, payload));
      }
      setSuccess("Profile picture updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to upload profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  }

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
          phone_country_code: phoneCountryCode,
          phone_national_number: phoneNationalNumber.trim() || null,
          email: email.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to update profile."));
      }

      const payload = await response.json();
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

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "Delete this YummyDoors account? This will sign you out and deactivate the account.",
    );
    if (!confirmed) {
      return;
    }

    setDeletingAccount(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiFetch("/me/account", {
        auth: true,
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to delete account."));
      }

      clearAuth();
      router.replace("/signup");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete account.");
      setDeletingAccount(false);
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
                  <div className="flex flex-col items-center gap-3 border-b border-border pb-6 text-center">
                    <div className="relative">
                      <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-[#eff6ff] text-[#024abe] shadow-sm">
                        {avatarUrl ? (
                          <div className="relative h-full w-full">
                            <Image
                              fill
                              src={avatarUrl}
                              alt={fullName || "Profile picture"}
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <UserCircle2 className="h-14 w-14" />
                        )}
                      </div>
                      <label className="absolute bottom-1 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-panel transition hover:bg-[#dd451a]">
                        <Camera className="h-4 w-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={uploadingAvatar}
                          onChange={handleAvatarChange}
                        />
                      </label>
                    </div>
                    <p className="text-sm font-medium text-primary">
                      {uploadingAvatar ? "Uploading picture..." : "Edit Picture"}
                    </p>
                  </div>

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
                    <div className="grid gap-3 sm:grid-cols-[190px_1fr]">
                      <select
                        value={phoneCountryCode}
                        disabled={!phoneCanEdit}
                        onChange={(event) => setPhoneCountryCode(event.target.value)}
                        className="h-12 rounded-xl border border-input bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted"
                      >
                        {PHONE_COUNTRIES.map((country) => (
                          <option key={country.iso2} value={country.dialCode}>
                            {country.flagEmoji} {country.dialCode} {country.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        value={phoneNationalNumber}
                        disabled={!phoneCanEdit}
                        onChange={(event) => setPhoneNationalNumber(event.target.value.replace(/[^\d]/g, ""))}
                        placeholder="98XXXXXXXX"
                        autoComplete="tel-national"
                      />
                    </div>
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

                  <div className="border-t border-border pt-5">
                    <button
                      type="button"
                      disabled={deletingAccount}
                      onClick={handleDeleteAccount}
                      className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#ffd8cc] bg-[#fff4f2] px-4 py-4 text-sm font-semibold text-[#ef4444] transition hover:bg-[#ffe9e6] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingAccount ? "Deleting account..." : "Delete account"}
                    </button>
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
