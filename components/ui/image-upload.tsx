"use client";

import { ChangeEvent, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { extractApiErrorMessage, readJsonSafely } from "@/lib/api-utils";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folderType: "restaurant_covers" | "restaurant_logos" | "menu_items" | "categories" | "promos" | "avatars" | "restaurant_gallery";
  disabled?: boolean;
}

export function ImageUpload({ value, onChange, folderType, disabled }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder_type", folderType);

      const response = await apiFetch("/media/upload", {
        auth: true,
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await readJsonSafely(response);
        throw new Error(extractApiErrorMessage(payload, "Failed to upload image."));
      }

      const payload = await readJsonSafely(response);
      const uploadedUrl = payload && typeof payload === "object" ? payload.data?.url : null;
      if (uploadedUrl) {
        onChange(uploadedUrl);
      } else {
        throw new Error("Invalid response from server.");
      }
    } catch (error) {
      if (typeof window !== "undefined" && (window as any).toast) {
        (window as any).toast.error(error instanceof Error ? error.message : "Failed to upload image.");
      } else {
        alert(error instanceof Error ? error.message : "Failed to upload image.");
      }
    } finally {
      setUploading(false);
    }
  }

  if (value) {
    return (
      <div className="relative w-full overflow-hidden rounded-md border border-[#e5e5e5] bg-gray-50 flex items-center justify-center min-h-[160px] aspect-video">
        <Image fill src={value} alt="Uploaded image" className="object-cover" sizes="100vw" />
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => onChange(null)}
          className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white backdrop-blur-sm transition hover:bg-black"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex w-full flex-col items-center justify-center rounded-md border-2 border-dashed border-[#e5e5e5] bg-gray-50/50 p-6 text-center transition hover:border-[#ea580c]/50 hover:bg-[#fff5ef]/50">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={disabled || uploading}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <div className="flex flex-col items-center justify-center text-[#666]">
        {uploading ? (
          <>
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-[#ea580c]" />
            <p className="text-sm font-medium">Uploading...</p>
          </>
        ) : (
          <>
            <Upload className="mb-2 h-8 w-8 text-[#999]" />
            <p className="text-sm font-medium text-[#333]">Click or drag to upload</p>
            <p className="mt-1 text-xs text-[#888]">SVG, PNG, JPG or GIF</p>
          </>
        )}
      </div>
    </div>
  );
}
