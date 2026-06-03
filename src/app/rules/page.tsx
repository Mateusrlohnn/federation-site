"use client";

import { Fragment, useState } from "react";
import Icon from "@/components/ui/Icon";
import maxwidth from "@/styles/maxwidth.module.css";

const sections: { title: string; content: string }[] = [
  {
    title: "Regras de posição",
    content: `R1. Máximo de 3 jogadores em campo por equipe:
🧤 1 goleiro
🛡️ 1 zagueiro/atacante
🎯 1 meio-campista

R1.1. Ordem do nitro:
MID ataque - ATK ataque - MID defesa - ZAG defesa - GK ataque - GK defesa

R2. Substituições a qualquer momento desde que a troca seja no banco ao lado do campo que está defendendo.

R2.1. Jogador que entra antes do companheiro sair leva cartão amarelo.
Se interferir no jogo: pênalti.

R3. O jogo só começa quando todos os jogadores estiverem uniformizados.

R4. Se o árbitro esquecer de regular o nitro, o jogo deve ser reiniciado do meio campo com o cronômetro resetado.

R5. Se o nitro bugar, o árbitro poderá considerar gol em chances claras que foram interrompidas.
‣ Exemplo: bola a 1 ou 2 quadrados do gol, ou adversários longe da jogada.

R6. Todos devem estar com camiseta e calção.
Jogar sem uniforme completo = cartão amarelo.

R6.1. O único jogador autorizado a jogar de cueca é: RolaTuai 🩲`,
  },
  { title: "Goleiro", content: "" },
  { title: "Jogadores de Linha", content: "" },
  { title: "Regras gerais", content: "" },
  { title: "Parâmetros de avaliação", content: "" },
];

/** Realça o código da regra (R1, R1.1, …) no início de cada linha. */
function renderContent(content: string) {
  return content.split("\n").map((line, i) => {
    const match = line.match(/^(R[\d.]+\.)(\s+)(.*)$/);
    return (
      <Fragment key={i}>
        {match ? (
          <>
            <span className="font-bold text-gold">{match[1]}</span>
            {match[2]}
            {match[3]}
          </>
        ) : (
          line || " "
        )}
        {"\n"}
      </Fragment>
    );
  });
}

export default function RulesPage() {
  const [open, setOpen] = useState(0);

  return (
    <div className={maxwidth.maxWidthContainer} style={{ height: "auto", position: "static" }}>
      <div className="mb-4 flex w-full flex-col rounded-lg bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Icon name="book-open" className="text-gold" />
          Regras
        </h1>
        <span className="mt-1 text-faint">Regulamento oficial da Federação Rebug.</span>
      </div>

      <div className="flex flex-col gap-2">
        {sections.map((section, i) => {
          const isOpen = open === i;
          return (
            <div
              key={section.title}
              className="overflow-hidden rounded-lg bg-card"
              style={isOpen ? { boxShadow: "inset 3px 0 0 0 #ffb300" } : undefined}
            >
              <button
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="flex w-full items-center justify-between p-4 text-left font-bold"
              >
                <span className={isOpen ? "text-white" : "text-faint"}>{section.title}</span>
                <Icon
                  name="chevron-down"
                  className={`transition-transform ${isOpen ? "rotate-180 text-gold" : "text-faint"}`}
                />
              </button>
              {isOpen && section.content && (
                <div className="whitespace-pre-wrap p-4 pt-0 text-sm leading-relaxed text-[#d7d7db]">
                  {renderContent(section.content)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
