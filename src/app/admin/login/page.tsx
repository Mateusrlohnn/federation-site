"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import Icon from "@/components/ui/Icon";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!supabaseEnabled) {
      setError("Supabase não configurado (.env.local).");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-center px-5 py-20">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-card p-6"
      >
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Icon name="shield" className="text-gold" />
          Painel Admin
        </h1>
        <p className="text-xs text-faint">Acesso restrito aos administradores da Federação Rebug.</p>

        <label className="flex flex-col gap-1 text-xs">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-md bg-panel p-2 text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-md bg-panel p-2 text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
        </label>

        {error && <p className="text-xs text-loss">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-gold py-2 font-bold text-[#1a1a1e] hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
