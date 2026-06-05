"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Section = { id: string; title: string; content: string; sortOrder: number };

export default function AdminRulesPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Section[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("rules_sections")
      .select("id, title, content, sort_order")
      .order("sort_order", { ascending: true });
    if (!error && data)
      setItems(
        (data as { id: string; title: string; content: string; sort_order: number }[]).map((r) => ({
          id: r.id,
          title: r.title,
          content: r.content ?? "",
          sortOrder: r.sort_order,
        })),
      );
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function setField(id: string, field: "title" | "content", value: string) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  }

  async function save(s: Section) {
    setBusy(true);
    setErr("");
    setMsg("");
    const { error } = await supabase
      .from("rules_sections")
      .update({ title: s.title.trim() || "Sem título", content: s.content })
      .eq("id", s.id);
    setBusy(false);
    if (error) return setErr(error.message);
    setMsg(`Seção "${s.title}" salva.`);
  }

  async function add() {
    setBusy(true);
    setErr("");
    setMsg("");
    const nextOrder = items.length ? Math.max(...items.map((x) => x.sortOrder)) + 1 : 0;
    const { error } = await supabase
      .from("rules_sections")
      .insert({ title: "Nova seção", content: "", sort_order: nextOrder });
    setBusy(false);
    if (error) return setErr(error.message);
    await load();
  }

  async function remove(s: Section) {
    if (!confirm(`Remover a seção "${s.title}"?`)) return;
    setBusy(true);
    setErr("");
    setMsg("");
    const { error } = await supabase.from("rules_sections").delete().eq("id", s.id);
    setBusy(false);
    if (error) return setErr(error.message);
    await load();
  }

  // reordena trocando o sort_order com o vizinho (recarrega — salve edições antes)
  async function move(s: Section, dir: -1 | 1) {
    const idx = items.findIndex((x) => x.id === s.id);
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const other = items[j];
    setBusy(true);
    setErr("");
    setMsg("");
    await supabase.from("rules_sections").update({ sort_order: other.sortOrder }).eq("id", s.id);
    await supabase.from("rules_sections").update({ sort_order: s.sortOrder }).eq("id", other.id);
    setBusy(false);
    await load();
  }

  const inputC =
    "rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50";

  return (
    <>
      {(msg || err) && (
        <div
          className={`mb-4 rounded-md p-3 text-xs ${
            err ? "bg-loss/10 text-loss" : "bg-win/10 text-win"
          }`}
        >
          {err || msg}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-2 rounded-lg bg-card p-4">
        <div>
          <h2 className="text-sm font-bold">Regras do regulamento</h2>
          <p className="text-[11px] text-faint">
            Cada bloco é uma seção do acordeão em <b>/rules</b>. Use <b>R1.</b>, <b>R1.1.</b> no
            início das linhas para destacar o código. Salve antes de reordenar.
          </p>
        </div>
        <button
          onClick={add}
          disabled={busy}
          className="shrink-0 rounded-md bg-gold px-3 py-2 text-sm font-bold text-[#1a1a1e] hover:opacity-90 disabled:opacity-60"
        >
          + Nova seção
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {items.length === 0 && (
          <div className="rounded-lg bg-card p-4 text-sm text-faint">
            Nenhuma seção. Clique em <b>+ Nova seção</b> para começar.
          </div>
        )}
        {items.map((s, i) => (
          <div key={s.id} className="flex flex-col gap-2 rounded-lg bg-card p-4">
            <div className="flex items-center gap-2">
              <input
                value={s.title}
                onChange={(e) => setField(s.id, "title", e.target.value)}
                placeholder="Título da seção"
                className={`${inputC} flex-1 font-bold`}
              />
              <button
                onClick={() => move(s, -1)}
                disabled={busy || i === 0}
                title="Mover para cima"
                className="rounded-md bg-panel px-2 py-2 text-sm hover:bg-panel/70 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => move(s, 1)}
                disabled={busy || i === items.length - 1}
                title="Mover para baixo"
                className="rounded-md bg-panel px-2 py-2 text-sm hover:bg-panel/70 disabled:opacity-30"
              >
                ↓
              </button>
            </div>
            <textarea
              value={s.content}
              onChange={(e) => setField(s.id, "content", e.target.value)}
              placeholder="Conteúdo da seção (uma regra por linha)…"
              className={`${inputC} min-h-[140px] resize-y font-mono text-[13px] leading-relaxed`}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => remove(s)}
                disabled={busy}
                className="rounded-md border border-loss/40 px-3 py-1.5 text-xs text-loss hover:bg-loss/10 disabled:opacity-60"
              >
                Remover
              </button>
              <button
                onClick={() => save(s)}
                disabled={busy}
                className="rounded-md bg-gold px-4 py-1.5 text-sm font-bold text-[#1a1a1e] hover:opacity-90 disabled:opacity-60"
              >
                Salvar
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
