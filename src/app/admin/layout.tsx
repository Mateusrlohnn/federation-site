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
        <div className="p-4 mt-6 bg-[#2f2f2f] border border-[#454545] rounded-xl">
          Supabase não está configurado. Preencha o <code>.env.local</code> e reinicie o servidor.
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={maxwidth.maxWidthContainer}>
        <p className="p-4 mt-6 text-[#a9a9a9]">Carregando…</p>
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
      <div className="flex items-center justify-between gap-3 p-3 my-4 bg-[#2f2f2f] border border-[#454545] rounded-xl flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-bold mr-2">
            <Icon name="shield" className="text-yellow-500 mr-1" />
            Admin
          </span>
          {tabs.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active ? "bg-yellow-500 text-yellow-900" : "text-[#cfcfcf] hover:bg-[#1d1d1d]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {email && <span className="text-[#a9a9a9] hidden sm:inline">{email}</span>}
          <button
            onClick={logout}
            className="border border-[#454545] rounded-lg px-3 py-1.5 hover:bg-[#1d1d1d]"
          >
            Sair
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
