"use client";

import { useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { uploadImage } from "@/lib/storage";

/**
 * Admin-only image picker: choose a file from disk, upload it to Supabase
 * Storage, and report the resulting public URL through `onChange`.
 * Purely additive — it does not touch any existing data flow.
 */
export default function ImageUpload({
  value,
  onChange,
  folder,
  label,
  shape = "square",
}: {
  value: string;
  onChange: (url: string) => void;
  folder: string;
  label: string;
  shape?: "square" | "wide";
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const url = await uploadImage(folder, file);
      onChange(url);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Falha no upload.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const box = shape === "wide" ? "h-24 w-full" : "h-20 w-20";

  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="text-faint">{label}</span>
      <div className="flex items-center gap-3">
        <div
          className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-panel ${box}`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="h-full w-full object-cover" />
          ) : (
            <Icon name="shield" className="text-faint" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-md bg-panel px-3 py-1.5 font-semibold hover:bg-panel/70 disabled:opacity-60"
          >
            {busy ? "Enviando…" : value ? "Trocar foto" : "Enviar foto"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={busy}
              className="text-left text-loss hover:underline disabled:opacity-60"
            >
              Remover foto
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
        />
      </div>
      {err && <span className="text-loss">{err}</span>}
    </div>
  );
}
