"use client";

import { useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { uploadImage, MEDIA_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { focusStyle, parseFocus, withFocus, DEFAULT_FOCUS } from "@/lib/imageFocus";

type ExistingImage = {
  name: string;
  folder: string;
  path: string;
  publicUrl: string;
};

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

  // Estados para a Galeria de Imagens Existentes
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<ExistingImage[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [modalFolderFilter, setModalFolderFilter] = useState<string>("all");

  const supabase = createClient();

  const focus = parseFocus(value);
  const adjusted = value && (focus.x !== 50 || focus.y !== 50 || focus.zoom !== 1);
  const setFocus = (patch: Partial<typeof focus>) =>
    onChange(withFocus(value, { ...focus, ...patch }));

  // Upload de um arquivo novo
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

  // Busca imagens existentes copiando a lógica infalível da AdminImagesPage
  async function openGallery() {
    setShowGallery(true);
    setLoadingGallery(true);
    setModalFolderFilter("all"); // Inicializa mostrando tudo do filtro aplicado
    setErr("");

    try {
      // 1. Buscar todas as pastas na raiz do bucket 'media'
      const { data: rootItems, error: rootErr } = await supabase.storage.from(MEDIA_BUCKET).list();
      if (rootErr) throw rootErr;

      const allFiles: ExistingImage[] = [];
      const folders = rootItems?.filter((item) => !item.id) || [];

      // 2. Iterar sobre as pastas para pegar os arquivos reais de cada uma
      for (const fld of folders) {
        const { data: folderFiles, error: folderErr } = await supabase.storage
          .from(MEDIA_BUCKET)
          .list(fld.name);

        if (folderErr) continue;

        for (const file of folderFiles || []) {
          if (!file.id) continue; // Ignora subpastas

          const path = `${fld.name}/${file.name}`;
          const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);

          allFiles.push({
            name: file.name,
            folder: fld.name,
            path,
            publicUrl: urlData.publicUrl,
          });
        }
      }

      setGalleryImages(allFiles);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e: unknown) {
      setErr("Erro ao carregar biblioteca de mídia.");
    } finally {
      setLoadingGallery(false);
    }
  }

  const box = shape === "wide" ? "h-24 w-full" : "h-20 w-20";

  // 1. Determina o filtro alvo baseado na string do label
  const targetFolder = label.includes("Time")
    ? "teams"
    : label.includes("Torneio")
      ? "tournaments"
      : "all";

  // 2. Filtra o pool de imagens de acordo com a regra do label
  const labelFilteredImages = galleryImages.filter((img) => {
    if (targetFolder === "all") return true;
    return img.folder === targetFolder;
  });

  // 3. Extrai dinamicamente as pastas em uso (apenas as que possuem imagens de fato)
  const uniqueFolders = Array.from(new Set(labelFilteredImages.map((img) => img.folder)));

  // 4. Aplica o filtro da aba selecionada no modal
  const filteredGalleryImages = labelFilteredImages.filter(
    (img) => modalFolderFilter === "all" || img.folder === modalFolderFilter
  );

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
            <Icon name="image" className="text-faint text-lg" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-md bg-panel px-3 py-1.5 font-semibold hover:bg-panel/70 disabled:opacity-60 text-white"
            >
              {busy ? "Enviando…" : value ? "Trocar foto" : "Enviar nova"}
            </button>

            <button
              type="button"
              onClick={openGallery}
              disabled={busy}
              className="rounded-md bg-panel/40 border border-white/5 px-3 py-1.5 font-semibold hover:bg-panel/70 text-gold disabled:opacity-60"
            >
              Escolher existente
            </button>
          </div>

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

      {/* Ajuste de enquadramento do ícone */}
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

      {err && <span className="text-loss mt-1">{err}</span>}

      {/* Modal de Seleção da Biblioteca de Mídia */}
      {showGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex h-[480px] w-full max-w-2xl flex-col rounded-lg bg-card border border-white/10 p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Biblioteca de Mídia Global
              </h3>
              <button
                type="button"
                onClick={() => setShowGallery(false)}
                className="text-faint hover:text-white transition-colors"
              >
                Fechar ×
              </button>
            </div>

            {/* Abas de Pastas Baseadas no Supabase */}
            {!loadingGallery && uniqueFolders.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3 border-b border-white/5 pb-2">
                <button
                  type="button"
                  onClick={() => setModalFolderFilter("all")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${modalFolderFilter === "all" ? "bg-gold text-black" : "bg-panel text-faint hover:text-white"
                    }`}
                >
                  Todas as Imagens
                </button>
                {uniqueFolders.map((fld) => (
                  <button
                    key={fld}
                    type="button"
                    onClick={() => setModalFolderFilter(fld)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded uppercase tracking-wider transition-colors ${modalFolderFilter === fld ? "bg-gold text-black" : "bg-panel text-faint hover:text-white"
                      }`}
                  >
                    {fld}
                  </button>
                ))}
              </div>
            )}

            {/* Container das Imagens */}
            <div className="flex-1 overflow-y-auto py-4">
              {loadingGallery ? (
                <p className="text-center text-faint text-xs animate-pulse py-12">Carregando imagens do bucket...</p>
              ) : filteredGalleryImages.length === 0 ? (
                <p className="text-center text-faint italic text-xs py-12">Nenhuma imagem encontrada nesta seção.</p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {filteredGalleryImages.map((img) => {
                    const isSelected = value.split("?")[0].split("#")[0].includes(img.path);
                    return (
                      <button
                        key={img.path}
                        type="button"
                        onClick={() => {
                          onChange(img.publicUrl);
                          setShowGallery(false);
                        }}
                        className={`group relative aspect-square overflow-hidden rounded-md bg-base border transition-all ${isSelected ? "border-gold ring-1 ring-gold" : "border-white/5 hover:border-white/20"
                          }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.publicUrl}
                          alt={img.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/75 p-1 text-[9px] text-white/90 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {img.name}
                        </div>
                        <span className="absolute top-1 left-1 px-1 py-0.5 rounded text-[8px] uppercase font-bold bg-black/60 text-gold/90 border border-white/5">
                          {img.folder}
                        </span>
                        {isSelected && (
                          <span className="absolute top-1 right-1 bg-gold text-black rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-bold shadow-md">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGallery(false)}
                className="rounded bg-panel px-4 py-1.5 font-semibold text-white hover:bg-panel/80"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
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