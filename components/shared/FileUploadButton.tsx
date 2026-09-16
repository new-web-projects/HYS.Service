"use client";

import { useRef, useState } from "react";

export function FileUploadButton({
  purpose,
  documentType,
  accept,
  label,
  onUploaded,
}: {
  purpose: "profile_photo" | "worker_document";
  documentType?: "AADHAAR" | "PAN" | "WORK_ID";
  accept: string;
  label: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("purpose", purpose);
      if (documentType) form.append("documentType", documentType);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      onUploaded(data.url);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-muted/30 px-3 py-1.5 text-xs font-medium hover:border-accent">
        {uploading ? "Uploading…" : label}
        <input ref={inputRef} type="file" accept={accept} onChange={handleChange} disabled={uploading} className="hidden" />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}