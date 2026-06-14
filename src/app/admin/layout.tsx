"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import Icon from "@/components/ui/Icon";
import maxwidth from "@/styles/maxwidth.module.css";

const tabs = [
  { href: "/admin/players", label: "Jogadores" },
  { href: "/admin/teams", label: "Times" },
  { href: "/admin/tournaments", label: "Torneios" },
  { href: "/admin/rules", label: "Regras" },
  { href: "/admin/feed", label: "Feed" },
  { href: "/admin/draft", label: "Draft" },
  { href: "/admin/media", label: "Mídias" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isLogin || !supabaseEnabled) {
      setReady(true);
      return;
    }
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) {
          router.replace("/admin/login");
          return;
        }
        setEmail(data.user.email ?? null);
        setReady(true);
      });
  }, [isLogin, pathname, router]);

  if (isLogin) return <>{children}</>;

  if (!supabaseEnabled) {
    return (
      <div className={maxwidth.maxWidthContainer}>
        <div className="mt-6 rounded-lg bg-card p-4">
          Supabase não está configurado. Preencha o <code>.env.local</code> e reinicie o servidor.
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={maxwidth.maxWidthContainer}>
        <p className="mt-6 p-4 text-faint">Carregando…</p>
      </div>
    );
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className={maxwidth.maxWidthContainer} style={{ height: "auto", position: "static" }}>
      <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card p-3">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-2 flex items-center gap-1.5 font-bold">
            <Icon name="shield" className="text-gold" />
            Admin
          </span>
          {tabs.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  active ? "bg-gold text-[#1a1a1e]" : "text-faint hover:bg-panel"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {email && <span className="hidden text-faint sm:inline">{email}</span>}
          <button
            onClick={logout}
            className="rounded-md bg-panel px-3 py-1.5 hover:bg-panel/70"
          >
            Sair
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
