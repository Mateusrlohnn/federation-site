export type MediaKind = "image" | "video" | "youtube";

export type Post = {
  id: string;
  authorType: "admin" | "user";
  authorName: string;
  body: string;
  mediaUrl: string | null;
  mediaKind: MediaKind | null;
  likes: number;
  dislikes: number;
  createdAt: string;
};

export function postFromRow(r: Record<string, unknown>): Post {
  return {
    id: r.id as string,
    authorType: (r.author_type as "admin" | "user") ?? "user",
    authorName: String(r.author_name ?? ""),
    body: String(r.body ?? ""),
    mediaUrl: (r.media_url as string) ?? null,
    mediaKind: (r.media_kind as MediaKind) ?? null,
    likes: Number(r.likes ?? 0),
    dislikes: Number(r.dislikes ?? 0),
    createdAt: r.created_at as string,
  };
}

// youtube.com/watch?v=, youtu.be/, /embed/, /shorts/
const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

/** ID do vídeo do YouTube a partir da URL (ou null). */
export function youtubeId(url: string): string | null {
  const m = url.match(YT_RE);
  return m ? m[1] : null;
}

/** URL de embed do YouTube (ou null se o link não for do YouTube). */
export function youtubeEmbed(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

/** Detecta o tipo de mídia a partir da URL (fallback: imagem). */
export function detectMediaKind(url: string): MediaKind {
  if (youtubeId(url)) return "youtube";
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v)$/.test(clean)) return "video";
  return "image";
}

/** "há 5 min", "há 2 h", "há 3 d" — tempo relativo curto em pt-BR. */
export function timeAgo(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (s < 60) return "agora";
  const min = Math.floor(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `há ${w} sem`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `há ${mo} mês${mo > 1 ? "es" : ""}`;
  return `há ${Math.floor(d / 365)} ano(s)`;
}
