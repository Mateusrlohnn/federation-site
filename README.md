# Federação Rebug

Site da Federação Rebug — feito com **Next.js 16 + Tailwind v4 + Supabase**.

## Estrutura do projeto

```
federation-site/
├── data-source/              # Dados-fonte (planilha original)
│   └── Hall of Fame.xlsx
├── public/                   # Arquivos estáticos servidos como /
│   ├── rebug-dc.webp         #   logo da federação
│   ├── avatars/              #   avatares dos organizadores (home)
│   └── images/               #   banner da home (home.webp)
├── scripts/                  # Scripts utilitários (rodar com `node`)
│   ├── import-hall-of-fame.mjs  # planilha .xlsx  ->  src/data/hall-of-fame.json
│   ├── seed-supabase.mjs        # carrega os jogadores no banco Supabase
│   └── make-icons.mjs           # gera favicon/ícone do app a partir da logo
├── supabase/
│   └── schema.sql            # tabelas + regras de acesso (RLS) do banco
├── src/
│   ├── app/                  # Rotas (cada pasta = uma página)
│   │   ├── layout.tsx        #   layout raiz (header + footer + fontes)
│   │   ├── page.tsx          #   home (hero + organizadores)
│   │   ├── globals.css       #   estilos globais / tema
│   │   ├── icon.png          #   ícone do app (gerado da logo)
│   │   ├── teams/            #   /teams
│   │   ├── players/          #   /players  (Hall of Fame, lê do banco)
│   │   ├── tournaments/      #   /tournaments
│   │   ├── rules/            #   /rules
│   │   └── admin/            #   /admin e /admin/login (painel restrito)
│   ├── components/
│   │   ├── layout/           #   Header, Footer
│   │   ├── ui/               #   Icon (ícones FontAwesome inline)
│   │   ├── home/             #   SplineScene (fundo 3D)
│   │   └── players/          #   PlayersView (tabela do Hall of Fame)
│   ├── lib/
│   │   ├── hof.ts            #   tipos, pesos de pontuação e mapeamento dos dados
│   │   └── supabase/         #   clientes do Supabase (public + browser)
│   ├── data/
│   │   └── hall-of-fame.json #   dados importados (fallback quando offline)
│   └── styles/               #   CSS Modules compartilhados (maxwidth, hero)
└── .env.local               # chaves do Supabase (NÃO vai pro Git)
```

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:3000
```

Outros comandos: `npm run build` (produção) · `npm run start` (servir o build).

## Banco de dados (Supabase)

As variáveis ficam em `.env.local`:

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública (leitura no navegador) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secreta — só usada localmente pelo `seed-supabase.mjs` |

**Acesso:** todos podem **ler**; só e-mails na tabela `admins` podem **editar** (controlado por RLS).
O painel de edição fica em `/admin` (login em `/admin/login`).

### Atualizar os dados a partir da planilha
```bash
node scripts/import-hall-of-fame.mjs   # lê data-source/Hall of Fame.xlsx -> JSON
node scripts/seed-supabase.mjs         # envia para o Supabase
```

### Trocar a logo
Substitua `public/rebug-dc.webp` e rode:
```bash
node scripts/make-icons.mjs            # regenera o favicon/ícone do app
```
# federation-site
