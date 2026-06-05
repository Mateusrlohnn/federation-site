"use client";

import { timeAgo, youtubeEmbed, type MediaKind, type Post } from "@/lib/posts";

// identidade oficial da Federação (admin publica sempre como a Federação)
export const OFFICIAL_NAME = "Federação Rebug";
export const OFFICIAL_LOGO = "/rebug-dc.webp";

export const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// cor do avatar-inicial a partir do nome (determinístico)
const AVATAR_COLORS = ["#e0245e", "#1d9bf0", "#17bf63", "#f45d22", "#794bc4", "#ffad1f", "#e91e63"];
export function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Media({ url, kind }: { url: string; kind: MediaKind | null }) {
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
    return <video controls src={url} className="mt-3 max-h-[480px] w-full rounded-xl bg-black" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="mt-3 max-h-[480px] w-full rounded-xl bg-black/30 object-contain"
    />
  );
}

export type Vote = "like" | "dislike" | null;

export function PostCard({
  post,
  now,
  vote,
  onReact,
  onDelete,
}: {
  post: Post;
  now: number | null;
  /** estado do voto deste dispositivo; passe undefined para esconder as reações */
  vote?: Vote;
  onReact?: (kind: "like" | "dislike") => void;
  /** quando presente, mostra o botão de apagar (admin) */
  onDelete?: (id: string) => void;
}) {
  const official = post.authorType === "admin";
  const showReactions = onReact != null;

  return (
    <li className="rounded-xl border border-white/5 bg-card p-4">
      <div className="flex items-center gap-2.5">
        {official ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={OFFICIAL_LOGO}
            alt={OFFICIAL_NAME}
            className="h-9 w-9 shrink-0 rounded-full bg-white/5 object-cover"
          />
        ) : (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
            style={{ backgroundColor: colorFor(post.authorName || "?") }}
          >
            {(post.authorName || "?").trim().charAt(0).toUpperCase()}
          </span>
        )}
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
        {onDelete && (
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

      {showReactions && (
        <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
          <button
            onClick={() => onReact("like")}
            title="Curtir"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              vote === "like"
                ? "bg-win/20 text-win"
                : "text-faint hover:bg-panel hover:text-white"
            }`}
          >
            <span>👍</span>
            <span>{post.likes}</span>
          </button>
          <button
            onClick={() => onReact("dislike")}
            title="Não curtir"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              vote === "dislike"
                ? "bg-loss/20 text-loss"
                : "text-faint hover:bg-panel hover:text-white"
            }`}
          >
            <span>👎</span>
            <span>{post.dislikes}</span>
          </button>
        </div>
      )}
    </li>
  );
}
