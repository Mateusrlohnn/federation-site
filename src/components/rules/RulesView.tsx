"use client";

import { Fragment, useState } from "react";
import Icon from "@/components/ui/Icon";
import maxwidth from "@/styles/maxwidth.module.css";

export type RuleSection = { title: string; content: string };

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
          line || " "
        )}
        {"\n"}
      </Fragment>
    );
  });
}

export default function RulesView({ sections }: { sections: RuleSection[] }) {
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

      {sections.length === 0 ? (
        <div className="rounded-lg bg-card p-5 text-sm text-faint">
          Nenhuma regra publicada ainda.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sections.map((section, i) => {
            const isOpen = open === i;
            return (
              <div
                key={`${section.title}-${i}`}
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
      )}
    </div>
  );
}
