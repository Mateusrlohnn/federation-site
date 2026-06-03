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
        className="w-full max-w-sm bg-[#2f2f2f] border border-[#454545] rounded-xl p-6 flex flex-col gap-4"
      >
        <h1 className="text-xl font-bold flex items-center">
          <Icon name="shield" className="text-yellow-500 mr-2" />
          Painel Admin
        </h1>
        <p className="text-xs text-[#a9a9a9]">Acesso restrito aos administradores da Federação Rebug.</p>

        <label className="flex flex-col gap-1 text-xs">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border border-[#8d8d8d68] bg-[#1d1d1d] p-2 rounded"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="border border-[#8d8d8d68] bg-[#1d1d1d] p-2 rounded"
          />
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-yellow-500 hover:bg-yellow-600 text-yellow-900 font-bold rounded-lg py-2 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
