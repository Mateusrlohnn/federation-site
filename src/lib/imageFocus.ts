import type { CSSProperties } from "react";

/**
 * Enquadramento de uma imagem (foco + zoom) usado em logos/banners.
 *
 * O ajuste viaja DENTRO da própria URL, como um fragmento `#focus=x,y,z`.
 * O navegador ignora o fragmento ao baixar a imagem, então a URL continua
 * funcionando em qualquer `<img src>` — e o ajuste persiste junto com o
 * `logo_url`/`image_url` que já são gravados no banco, sem novas colunas.
 *
 *   x, y  → object-position em % (0–100). 50/50 = centro.
 *   zoom  → escala aplicada à imagem (1 = sem zoom).
 */
export type ImageFocus = { x: number; y: number; zoom: number };

export const DEFAULT_FOCUS: ImageFocus = { x: 50, y: 50, zoom: 1 };

const TAG = "#focus=";

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

/** Lê o enquadramento embutido numa URL (ou o padrão, se ausente). */
export function parseFocus(url: string | null | undefined): ImageFocus {
  if (!url) return { ...DEFAULT_FOCUS };
  const i = url.indexOf(TAG);
  if (i === -1) return { ...DEFAULT_FOCUS };
  const [x, y, z] = url.slice(i + TAG.length).split(",").map(Number);
  return {
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
    zoom: clamp(z, 1, 4),
  };
}

/** Regrava a URL com o enquadramento (sem fragmento quando for o padrão). */
export function withFocus(url: string, f: ImageFocus): string {
  const base = url.split(TAG)[0];
  const x = Math.round(clamp(f.x, 0, 100));
  const y = Math.round(clamp(f.y, 0, 100));
  const zoom = Math.round(clamp(f.zoom, 1, 4) * 100) / 100;
  if (x === 50 && y === 50 && zoom === 1) return base; // padrão → URL limpa
  return `${base}${TAG}${x},${y},${zoom}`;
}

/** Estilo CSS para um `<img className="object-cover">` aplicar o enquadramento. */
export function focusStyle(url: string | null | undefined): CSSProperties | undefined {
  const f = parseFocus(url);
  if (f.x === 50 && f.y === 50 && f.zoom === 1) return undefined;
  return {
    objectPosition: `${f.x}% ${f.y}%`,
    transformOrigin: `${f.x}% ${f.y}%`,
    transform: f.zoom !== 1 ? `scale(${f.zoom})` : undefined,
  };
}
