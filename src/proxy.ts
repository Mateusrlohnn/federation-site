import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy (Next 16 — antigo "middleware"). Roda no servidor ANTES de renderizar
 * qualquer rota /admin. Protege o painel de verdade: quem não estiver logado
 * é redirecionado e a página /admin nunca chega ao navegador dele.
 *
 * IMPORTANTE: esta é a primeira camada (nível de página). A tranca dos DADOS é
 * o RLS no Supabase (ver supabase/security.sql) — sem ele, dá pra atacar o
 * banco direto pela API, sem passar por aqui.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Se o Supabase não estiver configurado (ex.: ambiente local sem .env),
  // não bloqueia — deixa a tela de aviso do próprio app aparecer.
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!configured) return NextResponse.next();

  const { response, user } = await updateSession(request);

  const isLoginPage = pathname === "/admin/login";

  // Não logado tentando acessar qualquer página do admin (menos o login) -> login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // Já logado abrindo a tela de login -> manda direto pro painel
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Roda apenas nas rotas do painel administrativo.
  matcher: ["/admin/:path*"],
};
