# Segurança — Federação Rebug

O painel `/admin` é protegido em **3 camadas**. As camadas 1 e 3 já estão no
código; a **camada 2 (RLS) você precisa aplicar no Supabase** — sem ela, dá pra
atacar o banco direto pela API pública, ignorando o site.

## Camada 1 — Proxy server-side (já implementado)

`src/proxy.ts` roda no servidor **antes** de qualquer página `/admin` renderizar.
Quem não está logado é redirecionado para `/admin/login` e **a página de admin
nunca é enviada ao navegador**. (No Next 16 o antigo "middleware" chama-se `proxy`.)

## Camada 2 — RLS no Supabase (VOCÊ precisa fazer)

A tranca real dos **dados**. Passos:

1. Supabase Dashboard → **SQL Editor** → cole e rode `supabase/security.sql`.
2. Pegue o UID de cada admin em **Authentication → Users** e cadastre:
   ```sql
   insert into public.admins (id, email)
   values ('UID-DO-USUARIO', 'email@dele.com')
   on conflict (id) do nothing;
   ```
3. **Authentication → Providers → Email → desligue "Enable signups".**
   Assim ninguém cria conta sozinho — só você cria os admins.
4. Confira que deu certo:
   ```sql
   select tablename, rowsecurity from pg_tables where schemaname = 'public';
   ```
   Todas devem estar com `rowsecurity = true`.

> **Por que isso é o item mais importante:** as gravações do admin saem do
> navegador usando a chave `anon`, que é **pública** (vai no código do site).
> Sem RLS, qualquer pessoa usa essa chave para inserir/editar/apagar dados sem
> nunca passar pelo `/admin`. O RLS faz o banco recusar escrita de quem não está
> na tabela `admins`.

## Camada 3 — Multiusuário (já suportado)

Cada admin = uma conta no Supabase Auth + uma linha em `public.admins`.
Para adicionar alguém: crie o usuário em Authentication → Users e rode o
`insert` do passo 2. Para remover acesso: `delete from public.admins where id = '...'`.

## Segredos

- `.env.local` está no `.gitignore` e **nunca** deve ser commitado.
- `SUPABASE_SERVICE_ROLE_KEY` (acesso total, ignora RLS) é usada **apenas** pelo
  script local `scripts/seed-supabase.mjs`. Nunca a prefixe com `NEXT_PUBLIC_`
  nem a importe em componentes — senão ela vaza pro navegador.
- A chave `anon` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) é pública por design; isso é
  normal no Supabase e seguro **desde que o RLS esteja ativo**.

## Headers de segurança

Definidos em `next.config.ts`: `X-Frame-Options` (anti-clickjacking),
`X-Content-Type-Options` (anti MIME-sniffing) e `Referrer-Policy`.
