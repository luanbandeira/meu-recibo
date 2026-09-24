# MeuRecibo

Emissão de recibos profissionais: **configure uma vez, emita em poucos segundos.**

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Auth, Postgres com RLS, Storage) · Vercel.

Arquitetura e decisões: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Primeiros passos

Requer Node.js 22+.

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do projeto Supabase de DEV
npm run db:push              # aplica supabase/migrations no projeto
npm run admin:create -- --username admin --name "Seu Nome"
npm run dev
```

Acesse http://localhost:3000 e entre com o usuário e a senha temporária exibida pelo `admin:create`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run typecheck` / `npm run lint` | verificação de tipos / lint |
| `npm test` | testes unitários + testes de banco (RLS) em Postgres embutido — sem rede |
| `npm run test:integration` | isolamento entre usuários contra o projeto Supabase de **dev** (usa `.env.local`) |
| `npm run test:e2e` | ponta a ponta no navegador (Chrome instalado, tela de celular): emissão, correção, modo suporte, acessibilidade, CSP e limites. Usa o servidor local; `E2E_BASE_URL=https://...` testa um deploy |
| `npm run db:push` | aplica as migrations (`SUPABASE_DB_URL`) |
| `npm run db:types` | gera `src/types/database.ts` a partir do banco (requer Docker; ainda não usado) |
| `npm run admin:create` | cria o Super Admin (bootstrap) |

## Segurança

- A **RLS do Postgres** é a camada de segurança; o frontend nunca é.
- `SUPABASE_SECRET_KEY` e `SUPABASE_DB_URL` são **somente servidor/local**. Nunca use o prefixo `NEXT_PUBLIC_` nelas.
- Nunca use dados reais em desenvolvimento ou testes.
