"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/storage";
import { postFromRow, detectMediaKind, type MediaKind, type Post } from "@/lib/posts";
import { PostCard, OFFICIAL_NAME, OFFICIAL_LOGO, MAX_BYTES } from "@/components/feed/shared";

const PAGE = 30;

export default function AdminFeedPage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<Post[]>([]);
  const [now, setNow] = useState<number | null>(null);

  const [body, setBody] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (data) setPosts(data.map(postFromRow));
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    load();
  }, [load]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_BYTES) {
      setErr("Arquivo muito grande (máx. 10MB).");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setErr("");
    setFile(f);
    if (f) setVideoLink(""); // arquivo e link são mutuamente exclusivos
  }

  async function submit() {
    const text = body.trim();
    if (!text && !file && !videoLink.trim()) return setErr("Escreva algo ou anexe uma mídia.");

    setBusy(true);
    setErr("");
    try {
      let media_url: string | null = null;
      let media_kind: MediaKind | null = null;
      if (file) {
        if (file.size > MAX_BYTES) throw new Error("Arquivo muito grande (máx. 10MB).");
        media_url = await uploadImage("feed", file);
        media_kind = file.type.startsWith("video") ? "video" : "image";
      } else if (videoLink.trim()) {
        media_url = videoLink.trim();
        media_kind = detectMediaKind(media_url);
      }

      const { data, error } = await supabase
        .from("posts")
        .insert({
          author_type: "admin",
          author_name: OFFICIAL_NAME, // admin sempre publica como a Federação
          body: text,
          media_url,
          media_kind,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Erro ao publicar.");

      setPosts((ps) => [postFromRow(data), ...ps]);
      setBody("");
      setVideoLink("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao publicar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Apagar este post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) return setErr(error.message);
    setPosts((ps) => ps.filter((p) => p.id !== id));
  }

  const inputC =
    "w-full rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 rounded-lg bg-card p-4">
        <h2 className="text-sm font-bold">Feed da Federação</h2>
        <p className="text-[11px] text-faint">
          Publicações aparecem em <b>/feed</b> (somente leitura para o público). Tudo é postado como{" "}
          <b>{OFFICIAL_NAME}</b>.
        </p>
      </div>

      {/* COMPOSER */}
      <div className="mb-6 flex flex-col gap-2 rounded-xl border border-white/5 bg-card p-4">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={OFFICIAL_LOGO}
            alt={OFFICIAL_NAME}
            className="h-9 w-9 shrink-0 rounded-full bg-white/5 object-cover"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold">{OFFICIAL_NAME}</span>
            <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold">
              ✅ Oficial
            </span>
          </div>
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva uma publicação oficial…"
          maxLength={2000}
          className={`${inputC} min-h-[80px] resize-y`}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-md bg-panel px-3 py-1.5 text-xs font-semibold hover:bg-panel/70"
          >
            📎 Anexar (imagem/vídeo)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            onChange={pickFile}
            className="hidden"
          />
          <span className="text-[11px] text-faint">ou</span>
          <input
            value={videoLink}
            onChange={(e) => {
              setVideoLink(e.target.value);
              if (e.target.value) setFile(null);
            }}
            placeholder="link do YouTube/vídeo"
            className={`${inputC} max-w-[220px] flex-1`}
          />
        </div>

        {file && (
          <div className="flex items-center gap-2 text-[11px] text-faint">
            <span className="truncate rounded bg-panel px-2 py-0.5">📎 {file.name}</span>
            <button
              onClick={() => {
                setFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="text-loss hover:underline"
            >
              remover
            </button>
          </div>
        )}

        {err && <p className="text-[11px] font-semibold text-loss">{err}</p>}

        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-faint">✅ Publicação oficial da Federação.</span>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-gold px-5 py-2 text-sm font-bold text-[#1a1a1e] hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </div>

      {/* LISTA / MODERAÇÃO */}
      {posts.length === 0 ? (
        <p className="text-center text-sm text-faint">
          Nada por aqui ainda. Faça a primeira publicação!
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} now={now} onDelete={remove} />
          ))}
        </ul>
      )}
    </div>
  );
}
