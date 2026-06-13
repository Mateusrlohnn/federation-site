import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Lê/atualiza a sessão do Supabase a partir dos cookies da requisição (SSR).
 * Usado pelo proxy.ts para saber, no servidor, se há um usuário logado ANTES
 * de qualquer página /admin ser renderizada.
 *
 * Segue o padrão exigido pelo @supabase/ssr: getAll/setAll (os métodos antigos
 * get/set/remove estão deprecados e causam bugs de sessão).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalida o token no servidor do Supabase (não confia só no cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
