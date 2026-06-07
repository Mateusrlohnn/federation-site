"use client";

import { useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { uploadImage } from "@/lib/storage";
import { focusStyle, parseFocus, withFocus, DEFAULT_FOCUS } from "@/lib/imageFocus";

/**
 * Admin-only image picker: choose a file from disk, upload it to Supabase
 * Storage, and report the resulting public URL through `onChange`.
 *
 * O enquadramento do ícone (posição + zoom) é editável e viaja embutido na
 * própria URL (ver `@/lib/imageFocus`) — por isso `value`/`onChange` continuam
 * sendo uma única string, sem precisar de campos extras no banco.
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

  const focus = parseFocus(value);
  const adjusted = value && (focus.x !== 50 || focus.y !== 50 || focus.zoom !== 1);
  const setFocus = (patch: Partial<typeof focus>) =>
    onChange(withFocus(value, { ...focus, ...patch }));

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
            <img
              src={value}
              alt={label}
              className="h-full w-full object-cover"
              style={focusStyle(value)}
            />
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

      {/* Ajuste de enquadramento do ícone (posição + zoom) */}
      {value && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-md bg-panel/50 p-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-faint">Enquadramento do ícone</span>
            {adjusted && (
              <button
                type="button"
                onClick={() => onChange(withFocus(value, DEFAULT_FOCUS))}
                className="text-[11px] text-gold hover:underline"
              >
                Centralizar
              </button>
            )}
          </div>
          <Slider
            label="Horizontal"
            min={0}
            max={100}
            value={focus.x}
            onChange={(x) => setFocus({ x })}
          />
          <Slider
            label="Vertical"
            min={0}
            max={100}
            value={focus.y}
            onChange={(y) => setFocus({ y })}
          />
          <Slider
            label="Zoom"
            min={1}
            max={3}
            step={0.05}
            value={focus.zoom}
            onChange={(zoom) => setFocus({ zoom })}
            format={(v) => `${v.toFixed(2)}×`}
          />
        </div>
      )}

      {err && <span className="text-loss">{err}</span>}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px]">
      <span className="w-16 shrink-0 text-faint">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer accent-gold"
      />
      <span className="w-10 shrink-0 text-right tabular-nums text-faint">
        {format ? format(value) : `${Math.round(value)}%`}
      </span>
    </label>
  );
}
