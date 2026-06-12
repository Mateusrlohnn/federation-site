import { avatarUrl, type HofPlayer } from "@/lib/hof";
import { POSITIONS, type Position } from "@/lib/teams";

/**
 * Card estilo FIFA / EA FC — moldura 100% CSS (classes em globals.css).
 * 6 categorias visuais escolhidas por overall + status:
 *   - card-icon        : auge de jogador APOSENTADO (lendária, creme + raios dourados)
 *   - card-fire-elite  : overall >= 98 (Elite de Fogo, vermelho + chamas)
 *   - card-pink-refined: overall 95–97 (FUT Birthday, magenta + brilho nas bordas)
 *   - card-blue        : overall 90–94 (TOTY/TOTS, azul cósmico)
 *   - card-gold        : overall 80–89 (ouro padrão)
 *   - card-silver      : overall <= 79 / sem overall (prata simples)
 */

export type CardVariant =
  | "card-silver"
  | "card-gold"
  | "card-blue"
  | "card-pink-refined"
  | "card-fire-elite"
  | "card-icon";

/** Lógica de categoria — espelha as regras de negócio do EA FC. */
export function cardVariant(
  overall: number | null,
  isAuge: boolean,
  aposentado: boolean,
): CardVariant {
  if (isAuge && aposentado) return "card-icon"; // Lendária só no auge de aposentado
  const o = overall ?? 0;
  if (o >= 98) return "card-fire-elite"; // 98–99 · Elite de Fogo
  if (o >= 95) return "card-pink-refined"; // 95–97 · Rosa Refinada
  if (o >= 90) return "card-blue";
  if (o >= 80) return "card-gold";
  return "card-silver"; // 70–79 e abaixo / sem overall
}

const VARIANT_TYPE: Record<CardVariant, string> = {
  "card-silver": "Prata",
  "card-gold": "Ouro",
  "card-blue": "TOTY",
  "card-pink-refined": "Birthday",
  "card-fire-elite": "GODLIKE",
  "card-icon": "Icon",
};

/** Selo de "sem clube" (free agent) — círculo de proibição. Herda currentColor. */
function FreeAgentBadge() {
  return (
    <span title="Sem clube (passe livre)" className="fut-card__freeagent mt-1.5 flex flex-col items-center" aria-label="Sem clube">
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="drop-shadow-[0_1px_2px_rgba(0,0,0,.25)]"
      >
        <circle cx="12" cy="12" r="9" />
        <line x1="5.64" y1="5.64" x2="18.36" y2="18.36" />
      </svg>
      <span className="mt-0.5 text-[8px] font-bold uppercase leading-none tracking-wide">Livre</span>
    </span>
  );
}

/**
 * Fogo de Inferno (98–99) — chama LIMPA em looping atrás do avatar, gerada por
 * turbulência fractal (feTurbulence + feDisplacementMap) animada de forma
 * contínua. A chama é transparente (some no topo/laterais), então o fundo
 * escuro do site aparece atrás dela — sem nenhum preenchimento preto.
 * `uid` garante ids SVG únicos quando há mais de uma carta de fogo na página.
 */
function FireLayer({ uid }: { uid: string }) {
  const g = `fut-fire-grad-${uid}`;
  const f = `fut-fire-distort-${uid}`;
  return (
    <svg
      className="fut-card__fire"
      viewBox="0 0 200 267"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* núcleo branco-amarelo → laranja → vermelho → TRANSPARENTE (sobe da base) */}
        <radialGradient id={g} cx="50%" cy="92%" r="82%">
          <stop offset="0%" stopColor="#fff6cc" />
          <stop offset="24%" stopColor="#ffce3a" />
          <stop offset="48%" stopColor="#ff8c1a" />
          <stop offset="70%" stopColor="#f5400a" />
          <stop offset="100%" stopColor="rgba(150,12,2,0)" />
        </radialGradient>
        {/* turbulência animada em loop contínuo (volta ao valor inicial) */}
        <filter id={f} x="-35%" y="-35%" width="170%" height="170%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.036" numOctaves="2" seed="8" result="t">
            <animate
              attributeName="baseFrequency"
              dur="5s"
              values="0.018 0.036;0.024 0.05;0.02 0.04;0.018 0.036"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="t" scale="34" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      {/* corpo da chama + núcleo mais quente, subindo da base atrás do avatar */}
      <g filter={`url(#${f})`}>
        <ellipse cx="100" cy="250" rx="90" ry="182" fill={`url(#${g})`} />
        <ellipse cx="100" cy="252" rx="54" ry="146" fill={`url(#${g})`} opacity="0.9" />
      </g>
    </svg>
  );
}

export default function FifaCard({
  player,
  overall,
  label,
  isAuge,
  teamLogo,
  teamName,
  position,
  size,
  showLabel = true,
}: {
  player: HofPlayer;
  overall: number | null;
  label: string; // "Auge" | "Atual"
  isAuge: boolean;
  teamLogo?: string;
  teamName?: string;
  position?: Position | null; // posição do card; cai na natural do jogador se ausente
  size?: number; // largura do card em px; sem isso, ocupa 100% (até 200px). Tudo escala junto.
  showLabel?: boolean; // mostra o rótulo "Auge/Atual" em cima (default true)
}) {
  const variant = cardVariant(overall, isAuge, player.aposentado);
  const cardPos = position ?? player.position;
  const sigla = POSITIONS.find((p) => p.key === cardPos)?.sigla ?? "—";
  const initials = teamName
    ? teamName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "";

  const card = (
    <div
      className={`fut-card ${variant}`}
      style={size != null ? { width: size, maxWidth: size } : undefined}
    >
      <div className="fut-card__inner" />

      {/* OVR 98–99: chama em looping atrás do avatar (fundo transparente).
          uid único por jogador+aba evita colisão de ids SVG quando há vários
          cards de fogo na mesma tela (ex.: escalação do draft). */}
      {variant === "card-fire-elite" && (
        <FireLayer
          uid={`${isAuge ? "auge" : "atual"}-${(player.nick || player.name).replace(/[^a-zA-Z0-9]/g, "")}`}
        />
      )}

      {/* Overall + posição + brasão do clube (canto superior esquerdo) */}
      <div className="fut-card__corner">
        <span className="fut-card__ovr">{overall ?? "—"}</span>
        <span className="fut-card__pos">{sigla}</span>
        <span className="fut-card__rule" aria-hidden />
        {teamLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="fut-card__crest" src={teamLogo} alt={teamName ?? "Time"} title={teamName} />
        ) : teamName ? (
          <span className="fut-card__initials" title={teamName}>
            {initials}
          </span>
        ) : (
          <FreeAgentBadge />
        )}
      </div>

      {/* Avatar do Hubbe centralizado, destacado por drop-shadow */}
      <div className="fut-card__avatar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl(player.nick || player.name)} alt={player.name} />
      </div>

      {/* Faixa inferior com nome + tipo da carta */}
      <div className="fut-card__strip">
        <span className="fut-card__name">{player.name}</span>
        <span className="fut-card__type">{VARIANT_TYPE[variant]}</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center">
      {showLabel && (
        <span className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-faint">
          {label}
        </span>
      )}

      {/* Todas as variantes são autossuficientes (efeitos via CSS/SVG internos). */}
      {card}
    </div>
  );
}
