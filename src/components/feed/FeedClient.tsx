"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/storage";
import {
  postFromRow,
  detectMediaKind,
  youtubeEmbed,
  timeAgo,
  type Post,
  type MediaKind,
} from "@/lib/posts";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// cor do avatar-inicial a partir do nome (determinístico)
const AVATAR_COLORS = ["#e0245e", "#1d9bf0", "#17bf63", "#f45d22", "#794bc4", "#ffad1f", "#e91e63"];
function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function Media({ url, kind }: { url: string; kind: MediaKind | null }) {
  if (kind === "youtube") {
    const embed = youtubeEmbed(url);
    if (embed)
      return (
        <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe
            src={embed}
            title="vídeo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      );
  }
  if (kind === "video")
    return (
      <video
        controls
        src={url}
        className="mt-3 max-h-[480px] w-full rounded-xl bg-black"
      />
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="mt-3 max-h-[480px] w-full rounded-xl bg-black/30 object-contain"
    />
  );
}

function PostCard({
  post,
  now,
  isAdmin,
  onDelete,
}: {
  post: Post;
  now: number | null;
  isAdmin: boolean;
  onDelete: (id: string) => void;
}) {
  const official = post.authorType === "admin";
  return (
    <li className="rounded-xl border border-white/5 bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
          style={{ backgroundColor: colorFor(post.authorName || "?") }}
        >
          {(post.authorName || "?").trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold">{post.authorName}</span>
            {official && (
              <span className="shrink-0 rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold">
                ✅ Oficial
              </span>
            )}
          </div>
          {now != null && (
            <span className="text-[11px] text-faint">{timeAgo(post.createdAt, now)}</span>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => onDelete(post.id)}
            title="Apagar post"
            className="shrink-0 rounded-md px-2 py-1 text-xs text-loss hover:bg-loss/10"
          >
            🗑
          </button>
        )}
      </div>
      {post.body && (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{post.body}</p>
      )}
      {post.mediaUrl && <Media url={post.mediaUrl} kind={post.mediaKind} />}
    </li>
  );
}

export default function FeedClient({
  initialPosts,
  pageSize,
}: {
  initialPosts: Post[];
  pageSize: number;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [isAdmin, setIsAdmin] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hasMore, setHasMore] = useState(initialPosts.length >= pageSize);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    // init client-only (Date/localStorage não existem no SSR)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    setName(localStorage.getItem("feedAuthor") ?? "Organização");
    if (supabaseEnabled)
      createClient()
        .auth.getUser()
        .then(({ data }) => setIsAdmin(!!data.user));
  }, []);

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
    if (!isAdmin) return; // só admin publica
    if (!supabaseEnabled) return setErr("Supabase não configurado.");
    const text = body.trim();
    if (!text && !file && !videoLink.trim()) return setErr("Escreva algo ou anexe uma mídia.");
    const finalName = name.trim() || "Organização";

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

      const supabase = createClient();
      const { data, error } = await supabase
        .from("posts")
        .insert({
          author_type: isAdmin ? "admin" : "user",
          author_name: finalName,
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
      if (!isAdmin) localStorage.setItem("feedName", finalName);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao publicar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Apagar este post?")) return;
    const { error } = await createClient().from("posts").delete().eq("id", id);
    if (error) return setErr(error.message);
    setPosts((ps) => ps.filter((p) => p.id !== id));
  }

  async function loadMore() {
    const last = posts[posts.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const { data } = await createClient()
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .lt("created_at", last.createdAt)
      .limit(pageSize);
    if (data) {
      setPosts((ps) => [...ps, ...data.map(postFromRow)]);
      if (data.length < pageSize) setHasMore(false);
    }
    setLoadingMore(false);
  }

  const inputC =
    "w-full rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50";

  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">💬 Feed da Federação</h1>
        <p className="text-sm text-faint">Notícias oficiais e a voz da torcida.</p>
      </div>

      {/* COMPOSER — só admin publica; o público apenas visualiza */}
      {isAdmin && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-white/5 bg-card p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome de exibição (ex.: Organização)"
            maxLength={40}
            className={inputC}
          />
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
      )}

      {/* FEED */}
      {posts.length === 0 ? (
        <p className="text-center text-sm text-faint">
          {isAdmin ? "Nada por aqui ainda. Faça a primeira publicação!" : "Ainda não há publicações."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} now={now} isAdmin={isAdmin} onDelete={remove} />
          ))}
        </ul>
      )}

      {hasMore && posts.length > 0 && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-faint hover:bg-panel disabled:opacity-60"
          >
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}
