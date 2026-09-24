# MeuRecibo — Arquitetura (Fase de Planejamento)

> Documento vivo. Registra as decisões de fundação antes da implementação.
> Decisões marcadas com **[CONFIRMADO]** foram validadas pelo responsável pelo produto em 23/09/2026.

---

## 1. Visão geral

```
┌──────────────────────────── Navegador (mobile first) ────────────────────────────┐
│ Next.js (App Router) — React Server Components + Client Components               │
│  • Login direto no Supabase Auth (username → e-mail sintético, ver §5)           │
│  • Editor TipTap (modelos) • Formulário dinâmico (emissão) • pdf.js (preview)    │
│  • Recorte + remoção de fundo da assinatura em <canvas> (100% local)            │
│  • Web Share API (compartilhar arquivo) com fallback para download               │
└───────────────┬──────────────────────────────────────────────┬───────────────────┘
                │ cookies de sessão (httpOnly via @supabase/ssr)│
┌───────────────▼──────────────── Vercel (Node runtime) ───────▼───────────────────┐
│ Server Components / Server Actions / Route Handlers                               │
│  • Autorização server-side (sessão + papel + modo suporte)                        │
│  • Validação com Zod de TUDO que entra (conteúdo do editor, valores, uploads)     │
│  • Geração de PDF com @react-pdf/renderer (mesmo código p/ preview e final)       │
│  • Cliente "admin" (secret/service key) SOMENTE em módulos `server-only`          │
└───────────────┬───────────────────────────────────────────────────────────────────┘
                │ supabase-js (JWT do usuário → RLS aplicada)
┌───────────────▼──────────────── Supabase (região sa-east-1 / São Paulo) ──────────┐
│ Auth (usuários criados só pelo admin) • Postgres + RLS em todas as tabelas        │
│ Storage privado: buckets `logos`, `signatures`, `receipts`                        │
│ Funções SQL (RPC) para operações atômicas: emitir recibo, numeração, correção     │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Princípios:

- **O banco é a camada de segurança.** Toda query de usuário roda com o JWT dele; RLS decide. O frontend só melhora a experiência.
- **Conteúdo do editor é JSON estruturado, nunca HTML.** Renderizamos por whitelist de nós → elimina a principal superfície de XSS.
- **Um único renderizador de documento** (`renderReceiptDocument`) alimenta preview e PDF final → o preview é literalmente o PDF.
- **Recibo emitido é imutável.** Correção = nova versão vinculada.

---

## 2. Stack e dependências

| Necessidade | Escolha | Por quê |
|---|---|---|
| Framework | Next.js (versão estável atual), TypeScript, App Router | Pedido na spec; deploy nativo na Vercel |
| Estilo | Tailwind CSS v4 | Pedido na spec |
| Componentes base | Radix primitives via shadcn/ui (código copiado, não dependência opaca) | Acessibilidade pronta (foco, teclado, aria); visual 100% nosso |
| Supabase | `@supabase/supabase-js` + `@supabase/ssr` | Padrão oficial para cookies/SSR no Next |
| Validação | `zod` | Mesmo schema no cliente e no servidor |
| Editor | TipTap v3 (ProseMirror) — **apenas extensões MIT** | Maduro, headless, nós customizados (variáveis, cabeçalho, assinatura) |
| PDF | `@react-pdf/renderer` | PDF vetorial (texto nítido e selecionável), roda em Node na Vercel sem Chromium |
| Exibir PDF (preview) | `pdfjs-dist` | iOS Safari não exibe PDF multipágina em `<iframe>`; pdf.js renderiza em canvas em qualquer lugar |
| Recorte de imagem | `react-image-crop` | Recorte livre (assinatura + carimbo não têm proporção fixa), touch, MIT |
| Remoção de fundo | **Algoritmo próprio em canvas** (sem dependência) | Ver §11 |
| Máscaras (CPF/CNPJ/tel/moeda) | Utilitários próprios | ~100 linhas; evita dependência |
| Testes | Vitest (unidade + integração RLS contra projeto de dev) ; Playwright (E2E, fase 10) | |

Rejeitados: Puppeteer/Chromium na Vercel (cold start, tamanho, fragilidade), `@imgly/background-removal` (licença **AGPL** + modelos de segmentação são feitos para pessoas/objetos, não tinta sobre papel), editores estilo canvas (Fabric/Konva — contrariam a spec).

---

## 3. Estrutura de rotas

```
PÚBLICO
/login                         username + senha
/primeiro-acesso               troca obrigatória da senha temporária

USUÁRIO  (layout com bottom-nav no mobile / sidebar no desktop)
/onboarding                    assistente de configuração (perfil → logo → assinatura)
/dashboard                     CTA "Emitir recibo", recibos do mês, últimos recibos
/emitir                        escolher modelo
/emitir/[templateId]           formulário gerado pelas variáveis do modelo
/emitir/[templateId]/preview   PDF real renderizado (pdf.js) → "Voltar e corrigir" | "Gerar PDF"
/modelos                       lista (criar, duplicar, renomear, arquivar)
/modelos/novo
/modelos/[id]/editar           editor A4 + toolbar + autosave
/recibos                       histórico com busca/filtros/ordenação
/recibos/[id]                  visualizar, compartilhar, baixar, duplicar, "Corrigir recibo"
/perfil                        perfil profissional, logo, assinatura
/configuracoes                 senha, campos personalizados, preferências

ADMIN  (layout próprio, sem acesso ao app do usuário exceto em modo suporte)
/admin                         contadores: ativos, desativados, total
/admin/usuarios                lista + busca
/admin/usuarios/novo
/admin/usuarios/[id]           detalhes + ações (suporte, redefinir acesso, desativar/reativar)
/admin/auditoria               log filtrável

API (Route Handlers — só o que não cabe em Server Action)
POST /api/recibos/preview          → bytes do PDF (não salva)
GET  /api/recibos/[id]/pdf?v=&download=1  → stream do PDF do Storage após checagem de acesso
```

`proxy.ts` (antigo `middleware.ts` no Next 16) apenas **renova a sessão** e redireciona não-autenticados. Regras de negócio (papel, `must_change_password`, onboarding, modo suporte) ficam nos **layouts de servidor**, que carregam o perfil uma vez por request (`React.cache`).

---

## 4. Estrutura de pastas

```
meu-recibo/
├─ docs/                         ARQUITETURA.md, decisões (ADRs curtos)
├─ public/
├─ assets/fonts/                 TTF (OFL) usados no editor E no PDF
├─ scripts/
│  └─ create-admin.ts            bootstrap do Super Admin (usa secret key local)
├─ supabase/
│  ├─ migrations/                SQL versionado (schema, RLS, funções, storage)
│  └─ seed.sql                   dados FICTÍCIOS para dev
├─ src/
│  ├─ app/
│  │  ├─ (public)/login, primeiro-acesso
│  │  ├─ (app)/layout.tsx        guarda de sessão/onboarding/suporte + navegação
│  │  │   dashboard, emitir, modelos, recibos, perfil, configuracoes, onboarding
│  │  ├─ admin/                  layout com guarda de papel
│  │  └─ api/recibos/...
│  ├─ features/                  módulos de domínio (UI + actions + queries + schemas)
│  │  ├─ auth/  admin/  support/  audit/
│  │  ├─ profile/  assets/       (upload, recorte, remoção de fundo)
│  │  ├─ templates/  editor/     (extensões TipTap, toolbar, autosave)
│  │  ├─ fields/                 catálogo de variáveis + campos personalizados
│  │  ├─ receipts/               emissão, histórico, versões
│  │  ├─ pdf/                    renderReceiptDocument + fontes + formatação
│  │  └─ sharing/
│  ├─ components/ui/             botões, inputs, sheet, toast… (base acessível)
│  ├─ lib/
│  │  ├─ supabase/ browser.ts server.ts admin.ts(server-only) proxy.ts
│  │  ├─ format/                 BRL, CPF/CNPJ, telefone, datas pt-BR, valor por extenso
│  │  └─ env.ts                  validação das variáveis de ambiente (zod)
│  └─ types/database.ts          tipos gerados do schema
└─ tests/
   ├─ unit/                      variáveis, máscaras, validação, numeração
   └─ integration/               RLS e isolamento (Usuário A × Usuário B)
```

---

## 5. Autenticação por username + senha

**Problema:** Supabase Auth identifica usuários por e-mail ou telefone; a spec quer só username.

**Solução:** e-mail sintético determinístico, invisível ao usuário.

```
username "luciane"  →  luciane@login.meurecibo.internal
```

- `.internal` é TLD reservado pela ICANN para uso privado — nunca vai rotear e-mail.
- Domínio configurável em `AUTH_EMAIL_DOMAIN` (definido UMA vez; mudar depois exige migração).
- Username normalizado: minúsculas, `^[a-z0-9][a-z0-9._-]{2,31}$`, único (constraint no banco).
- Cadastro público **desligado** no painel do Supabase. Usuários só nascem pela Admin API (`email_confirm: true`, nenhum e-mail é enviado).
- **Login feito no navegador** (`signInWithPassword` via `@supabase/ssr`, sessão em cookie). Motivo: o rate limit do Supabase Auth é por IP; se o login passasse pelo servidor, todos os usuários compartilhariam os IPs da Vercel e um ataque bloquearia todos. No navegador, cada usuário tem seu próprio limite. Montar o e-mail sintético no cliente não revela segredo algum.

**Fluxo de criação e primeiro acesso**

```
Admin preenche nome + username
  → Server Action (verifica papel admin) → Admin API createUser(e-mail sintético, senha temporária forte)
  → trigger cria `profiles` (role=user, status=active, must_change_password=true)
  → senha temporária exibida UMA vez ao admin (nunca salva, nunca logada)
  → audit_log: admin.user.create
Usuário entra → layout detecta must_change_password → /primeiro-acesso
  → updateUser({password}) com a sessão do próprio usuário
  → servidor zera must_change_password → /onboarding
```

**Recuperação de acesso [CONFIRMADO]:** sem e-mail real não há "esqueci minha senha" automático. Proposta v1: o link "Esqueci minha senha" orienta a falar com o administrador; o admin usa **Redefinir acesso** (nova senha temporária + `must_change_password=true` + revogação das sessões ativas + auditoria). Futuro opcional: e-mail de recuperação cadastrado pelo próprio usuário.

**Desativação:** `status=disabled` + `ban` na Admin API (bloqueia login e refresh) + as policies RLS exigem usuário ativo (cobre o JWT ainda válido até expirar) + expiração do JWT reduzida para 15–30 min.

**Senha:** mínimo 10 caracteres com letras e números (configurado no Supabase Auth e validado no formulário).

---

## 6. Autorização

Três camadas, cada uma suficiente por si só para o caso crítico:

1. **RLS no Postgres** — a verdade final. Nenhuma tabela exposta sem RLS.
2. **Guardas server-side** — layouts e Server Actions verificam sessão, papel, status e modo suporte antes de qualquer coisa.
3. **UI** — só esconde o que não faz sentido mostrar.

Papel e status ficam em `profiles` (o usuário **não** pode alterar essas colunas: sem policy de UPDATE para o próprio usuário em `profiles`; mudanças só por admin via servidor). Não usamos `user_metadata` para nada de segurança (é editável pelo usuário).

Funções auxiliares (schema `private`, `security definer`, `stable`, `search_path` fixo):

```sql
private.is_active_user()        -- auth.uid() existe e status = 'active'
private.is_super_admin()        -- role = 'super_admin' e ativo
private.support_target_id()     -- alvo da support_session ativa do admin atual (ou null)
```

Nas policies, chamadas envoltas em `(select ...)` para o Postgres avaliar uma vez por query, não por linha.

---

## 7. Modelo de dados

Convenções: UUID v4 (`gen_random_uuid()`), `timestamptz`, `created_at`/`updated_at` com trigger, `user_id` explícito em toda entidade do usuário (inclusive tabelas-filhas, para RLS simples e indexada).

```
auth.users (Supabase)
   │ 1:1
profiles ─────────────── 1:1 ── professional_profiles
   │                                 │ logo_asset_id / signature_asset_id
   │ 1:N                             ▼
   ├── user_assets (original + processado, imutáveis)
   ├── fields (campos: padrão + personalizados)
   ├── receipt_templates
   │        │ 0:N (template pode ser arquivado depois)
   ├── receipts ── 1:N ── receipt_versions (imutáveis, com snapshots)
   ├── receipt_counters (uso interno)
   └── support_sessions / audit_logs (lado admin)
```

### profiles
| coluna | tipo | notas |
|---|---|---|
| id | uuid PK | = auth.users.id |
| username | citext UNIQUE | normalizado |
| display_name | text | nome para o admin/listas |
| role | enum `user_role` (`user`,`super_admin`) | |
| status | enum `account_status` (`active`,`disabled`) | |
| must_change_password | bool | |
| onboarding_completed_at | timestamptz null | |
| created_by | uuid null → profiles | |
| created_at, updated_at | | |

### professional_profiles
`user_id` PK/FK, `full_name`, `company_name` (razão social, opc.), `profession`, `council` (ex.: `COREN-PE`, texto livre com sugestões), `registration_number` (ex.: `123456-F`), `document_type` (`cpf`/`cnpj`), `document_number` (só dígitos), `phone` (só dígitos), `city`, `state` (UF, check de 27 valores), `timezone` (default `America/Sao_Paulo`), `logo_asset_id`, `signature_asset_id`.

### user_assets
`id`, `user_id`, `kind` (`logo`,`signature`), `variant` (`original`,`processed`), `source_asset_id` (processado → original), `bucket`, `storage_path`, `mime_type`, `size_bytes`, `width`, `height`, `processing` jsonb (parâmetros de recorte/limiar — permite reprocessar), `created_at`.
Arquivos nunca são sobrescritos: novo upload = novo caminho. Assim recibos antigos continuam renderizáveis e "voltar ao original" é trivial.

### fields  (campos de emissão)
`id`, `user_id`, `key` (identificador da variável), `label`, `type` (enum: `short_text`,`long_text`,`currency`,`number`,`date`,`document`,`phone`), `required`, `default_value`, `is_system` (campo padrão semeado), `sort_order`, `archived_at`.
`UNIQUE (user_id, key)`; `key` validada por regex e contra lista de chaves reservadas.

**Decisão [CONFIRMADO]:** campos pertencem ao **usuário**, não ao modelo. `{{cirurgiao}}` criado uma vez fica disponível em todos os modelos dele. Os campos padrão (`valor`, `pagador`, `cpf_pagador`, `paciente`, …) são semeados nessa mesma tabela no primeiro acesso, com rótulo/obrigatoriedade editáveis — um único mecanismo para padrão e personalizado.

### receipt_templates
`id`, `user_id`, `name`, `content` jsonb (documento TipTap validado), `settings` jsonb (fonte base, tamanho, entrelinha, margens), `used_variables` text[] (extraído do `content` no servidor a cada save), `status` (`active`,`archived`), `is_default`, `revision` int (controle otimista do autosave), `created_at`, `updated_at`.

### receipts  (recibo lógico — o que aparece no histórico)
`id`, `user_id`, `template_id` null, `number` text (`REC-2026-000001`), `year`, `sequence`, `current_version_id`, `current_version_no`, `status` (`issued`,`cancelled`), resumo para listagem/busca: `payer_name`, `amount_cents`, `template_name`, `service_date`, `issued_at`, `search_text` (texto normalizado sem acento, índice trigram), `created_at`, `updated_at`.
A chave de idempotência fica em `receipt_versions` (`UNIQUE (user_id, idempotency_key)`), cobrindo emissão e correção contra duplo toque.
`UNIQUE (user_id, number)`.

### receipt_versions  (imutável)
`id`, `receipt_id`, `user_id`, `version_no`, `template_snapshot` jsonb (content + settings), `profile_snapshot` jsonb (dados profissionais + caminhos das imagens), `values` jsonb (valores normalizados: centavos, só dígitos, datas ISO), `pdf_path`, `pdf_sha256`, `file_name`, `correction_note`, `created_at`.
`UNIQUE (receipt_id, version_no)`. Sem UPDATE/DELETE para usuários; `pdf_path` só é preenchido uma vez (null → valor) por função dedicada.

**Por que `values` em JSONB e não uma tabela `receipt_values`:** o conjunto de chaves é definido pelo usuário e muda por modelo; os valores nunca são consultados individualmente por SQL, só lidos em bloco para renderizar. O que precisa de busca/ordenação/filtro (pagador, valor, datas, modelo) é **promovido para colunas** em `receipts`. Com o snapshot, cada versão é autossuficiente para regenerar o PDF idêntico.

### receipt_counters
`user_id`, `year`, `last_value` — PK composta. Acessada só pela função de emissão:
```sql
insert into receipt_counters(user_id, year, last_value) values (uid, y, 1)
on conflict (user_id, year) do update set last_value = receipt_counters.last_value + 1
returning last_value;
```
A linha fica travada até o fim da transação → **sem colisão sob concorrência**, sem buracos (a emissão é uma transação única).

**Numeração [CONFIRMADO]:** sequência **por usuário e por ano** (`REC-2026-000001` reinicia em 2027).

### support_sessions
`id`, `admin_id`, `target_user_id`, `reason`, `started_at`, `expires_at` (padrão 30 min), `ended_at`.

### audit_logs
`id`, `actor_id`, `action` (ex.: `admin.user.create`, `admin.user.reset_access`, `admin.user.disable`, `admin.user.enable`, `admin.support.start`, `admin.support.end`, `admin.support.view_pdf`), `target_user_id`, `entity_type`, `entity_id`, `metadata` jsonb (**sem senha, sem CPF, sem nome de paciente**), `ip_hash`, `created_at`. Insert apenas pelo servidor; leitura apenas por super admin; nunca UPDATE/DELETE.

---

## 8. Políticas RLS

Regra fundamental: **Usuário A nunca lê, cria, altera ou apaga linhas do Usuário B.** Uma policy por operação, sem `for all`.

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | próprio **ou** super admin | ninguém (trigger/servidor) | ninguém (servidor com secret key) | ninguém |
| professional_profiles | próprio **ou** suporte ativo | próprio | próprio | ninguém |
| user_assets | próprio **ou** suporte ativo | próprio | ninguém (imutável) | próprio, se não referenciado |
| fields | próprio **ou** suporte ativo | próprio | próprio | ninguém (arquivar) |
| receipt_templates | próprio **ou** suporte ativo | próprio | próprio | próprio |
| receipts | próprio **ou** suporte ativo | via RPC `issue_receipt` | via RPC (status/versão atual) | ninguém |
| receipt_versions | próprio **ou** suporte ativo | via RPC | ninguém | ninguém |
| receipt_counters | ninguém | ninguém | ninguém | ninguém |
| support_sessions | super admin (as próprias) | servidor | servidor (encerrar) | ninguém |
| audit_logs | super admin | servidor | ninguém | ninguém |

Padrão das policies de dono:
```sql
create policy templates_select on receipt_templates for select to authenticated
using (
  (user_id = (select auth.uid()) and (select private.is_active_user()))
  or user_id = (select private.support_target_id())
);
create policy templates_update on receipt_templates for update to authenticated
using      (user_id = (select auth.uid()) and (select private.is_active_user()))
with check (user_id = (select auth.uid()));   -- impede "doar" linha a outro usuário
```

RPCs `security definer` (`issue_receipt`, `correct_receipt`, `attach_receipt_pdf`) validam `auth.uid()` internamente, usam `search_path = ''` e só são executáveis por `authenticated`.

**Storage** (`storage.objects`), caminho sempre `<user_id>/...`:
- SELECT: `(storage.foldername(name))[1] = auth.uid()::text` ou suporte ativo.
- INSERT: mesma regra de pasta; buckets com `file_size_limit` e `allowed_mime_types`.
- UPDATE: ninguém (imutável). DELETE: próprio, só `logos`/`signatures`.

Suporte admin é **somente leitura** por construção: as policies de escrita exigem `user_id = auth.uid()`.

---

## 9. Storage

| Bucket | Privado | Limite | MIME | Caminho |
|---|---|---|---|---|
| `logos` | sim | 2 MB | png, jpeg, webp | `{uid}/{assetId}.{ext}` |
| `signatures` | sim | 5 MB | png, jpeg, webp | `{uid}/{assetId}.{ext}` |
| `receipts` | sim | 5 MB | application/pdf | `{uid}/{receiptId}/v{n}.pdf` |

- Nenhum bucket público, nenhuma URL permanente.
- O PDF é entregue por `GET /api/recibos/[id]/pdf`: o servidor baixa com a sessão do usuário (RLS decide), responde com `Content-Disposition` e nome amigável. Mesma origem → o `fetch` para compartilhar funciona sem CORS; e é o ponto único para auditar visualização em modo suporte.
- Upload de imagem (implementado na Fase 3): o navegador envia **direto ao Storage** (evita o limite de 4,5 MB das funções da Vercel; RLS + limites do bucket valem), depois a Server Action `registerAsset` baixa os arquivos, confere bytes mágicos, dimensões, tamanho e dono, e só então registra — arquivos inválidos são apagados.
- Normalização: o cliente valida e normaliza (redimensiona para no máx. 1600px, exporta PNG); o servidor revalida tipo pelos **bytes mágicos** (não pela extensão), tamanho e dimensões lendo o cabeçalho. PNG como formato de renderização porque o react-pdf não aceita WEBP e a assinatura precisa de transparência.

---

## 10. Editor de modelos (estilo Word)

**TipTap v3** com documento em **JSON** (esquema ProseMirror). Nós e marcas permitidos:

- Blocos: `paragraph`, `heading` (1–3), `bulletList`/`orderedList`/`listItem`, `horizontalRule`, `pageBreak`
- Blocos especiais (atômicos, com atributos simples, sem posicionamento livre):
  - `professionalHeader` — cabeçalho do perfil; `layout`: logo à esquerda | centralizado | sem logo
  - `logo` — `size` (P/M/G), `align`
  - `signature` — `size`, `align`, `showName` (nome/registro abaixo)
- Inline: `text`, `hardBreak`, `variable` (átomo `{key}` exibido como "chip" colorido; apagado/movido como um caractere)
- Marcas: `bold`, `italic`, `underline`, `textStyle` (`fontFamily` ∈ lista fixa, `fontSize` ∈ faixa fixa)
- Atributos de parágrafo: `textAlign` (esq/centro/dir/justificado), `lineHeight`, espaçamento

Toolbar horizontal (scroll horizontal no celular): Desfazer/Refazer · Fonte · Tamanho · N/I/S · Alinhamentos · Lista · Espaçamento · **Inserir variável** (busca no catálogo + "Criar campo") · Logo · Assinatura · Separador.

Página: elemento A4 (210 × 297 mm) em unidades `pt`, com as mesmas fontes e margens do PDF, escalado com CSS `zoom` para caber na tela. Botão "Visualizar PDF" mostra o resultado exato.

**Fontes:** conjunto fixo de TTF com licença OFL, servidas ao editor (web font) e registradas no react-pdf: *Arimo* (métrica do Arial), *Tinos* (métrica do Times New Roman), *Lora* (serifa elegante), *Inter* (sans moderna) — regular/negrito/itálico/negrito-itálico.

**Segurança do conteúdo:** o servidor valida o JSON com um schema Zod recursivo (tipos de nó, marcas e atributos em whitelist; cores/tamanhos/fontes em listas fechadas; limite de tamanho). Renderização por mapeamento nó → componente React/react-pdf. **Nenhum `dangerouslySetInnerHTML`.** Colagem de HTML externo passa pelo schema do ProseMirror, que descarta o desconhecido.

**Autosave:** debounce de ~1,5 s → Server Action com `revision` (se outra aba salvou antes, avisa em vez de sobrescrever); cópia local de segurança em `localStorage` até o servidor confirmar; indicador "Salvando… / Salvo"; aviso `beforeunload` com alterações pendentes; undo/redo nativo.

### Catálogo de variáveis

| Grupo | Variáveis | Origem |
|---|---|---|
| Emissão (tabela `fields`) | `valor`, `pagador`, `cpf_pagador`, `paciente`, `cpf_paciente`, `cirurgia`, `hospital`, `data_procedimento`, `descricao_servico`, `cidade` (padrão = cidade do perfil), `data_emissao` (padrão = hoje) + personalizados | formulário |
| Automáticas | `numero_recibo`, `valor_extenso` ("quinhentos reais") **[CONFIRMADO]** | sistema |
| Perfil | `profissional_nome`, `profissional_cpf_cnpj`, `profissional_telefone`, `profissional_profissao`, `profissional_registro`, `profissional_razao_social`, `profissional_cidade`, `profissional_estado` | perfil |
| Especiais | `logo`, `assinatura` | nós de bloco |

**Formulário de emissão** = `used_variables` do modelo ∩ campos de emissão, na ordem de `sort_order`. Perfil e automáticas nunca viram campo.

---

## 11. Remoção de fundo da assinatura/carimbo

Assinatura + carimbo são **tinta sobre papel** — um problema de limiarização, não de segmentação por IA. Algoritmo local em `<canvas>` (Web Worker para não travar a UI):

1. **Correção de iluminação** (fotos de celular têm sombra/gradiente): estima o fundo com um desfoque grande e divide a imagem por ele ("flat-field").
2. **Limiar automático** (Otsu) sobre a luminância corrigida.
3. **Alfa suave** entre dois limiares → bordas sem serrilhado.
4. **Preserva a cor da tinta** (azul da caneta, cor do carimbo); opção "escurecer tinta".
5. Controle deslizante "Intensidade" para ajuste fino, com preview instantâneo.

Fluxo: upload → recorte livre/rotação (`react-image-crop`) → "Remover fundo" (opcional) → salvar. Guardamos o **original** e o **processado** (com os parâmetros usados). "Usar original" volta a qualquer momento. Tudo roda no aparelho: nenhuma imagem vai para serviço externo, zero custo.

---

## 12. Geração do PDF

- `renderReceiptDocument({ template, values, profile, images })` — componente `@react-pdf/renderer` compartilhado.
- **Preview** (`POST /api/recibos/preview`): gera o PDF em memória com os dados do formulário (não salva, não consome número) e o cliente exibe com pdf.js. Preview = PDF real → fidelidade por definição.
- **Emissão** (Server Action `issueReceipt`):
  1. valida valores contra os campos (Zod gerado dinamicamente a partir de `fields`);
  2. RPC `issue_receipt` numa transação: aloca número, cria `receipts` + `receipt_versions` v1 com snapshots; `idempotency_key` impede duplicata;
  3. renderiza o PDF e envia para `receipts/{uid}/{id}/v1.pdf`;
  4. RPC `attach_receipt_pdf` grava caminho + SHA-256.
  Se 3–4 falharem, o recibo existe e o PDF é regenerável a partir do snapshot (botão "Tentar novamente").
- Detalhes de fidelidade: fontes embutidas; `wrap={false}` no bloco de assinatura (nunca fica sozinha no topo da página); **hifenização desativada** (o padrão do react-pdf é inglês); formatação pt-BR via `Intl`.
- Nome do arquivo: `recibo-{pagador}-{dd-mm-aaaa}.pdf`, sem acentos, só `[a-z0-9-]`, até 80 caracteres.

### Correção / versionamento
"Corrigir recibo" abre o formulário preenchido com a versão atual → nova emissão pela RPC `correct_receipt`: mesma numeração, `version_no + 1`, PDF novo em `v2.pdf`, `current_version_id` atualizado. A v1 continua intacta e acessível ("Versões anteriores"). **Duplicar** = novo recibo, novo número, formulário pré-preenchido.

---

## 13. Compartilhamento mobile

```
Recibo gerado → /recibos/[id]?novo=1
  ao abrir: fetch('/api/recibos/[id]/pdf') → Blob → File (em memória)
  [Compartilhar]  navigator.canShare({ files: [file] }) ? navigator.share({ files: [file], title })
                  (chamado direto no toque — iOS exige gesto do usuário, por isso o arquivo é pré-carregado)
  [Baixar]        link com ?download=1 (Content-Disposition: attachment)
  [Visualizar]    pdf.js na própria página
fallback: sem suporte a arquivo → botão Compartilhar vira Baixar
```
`AbortError` (usuário cancelou) não é tratado como erro.

---

## 14. Modo suporte (impersonação administrativa)

Não trocamos de sessão nem de `user_id`: o admin continua logado como admin.

```
/admin/usuarios/[id] → "Acessar ambiente para suporte" (motivo opcional)
  → RPC start_support_session: verifica super admin, fecha sessão anterior,
    cria support_session (30 min) e grava audit admin.support.start NA MESMA transação
  → redireciona para /dashboard
Layout do app: consulta a sessão aberta do admin no banco (ativa, não expirada)
  → "usuário efetivo" = alvo; RLS libera SELECT via private.support_target_id()
  → faixa fixa no topo: "Modo de suporte: Mariana Souza — somente leitura [Sair do modo de suporte]"
  → ações de escrita desabilitadas na UI e bloqueadas no servidor (e na RLS)
  → visualização/baixa de PDF registra admin.support.view_pdf
Sair → RPC end_support_session (ended_at + audit admin.support.end). Expirar → acesso cessa sozinho.
```

A sessão aberta no banco **é** o estado do modo suporte — não há cookie a forjar nem `user_id` vindo do cliente. No máximo uma sessão aberta por admin (índice único parcial).

**[CONFIRMADO]** Suporte somente leitura. Permitir edição em nome do usuário é possível depois, mas aumenta muito o risco; recomendo não fazer na v1.

---

## 15. Segurança (resumo)

RLS em tudo · autorização server-side · Zod em toda entrada · uploads validados por bytes mágicos · storage privado · conteúdo do editor em JSON com whitelist · sem `dangerouslySetInnerHTML` · secret key só em `server-only` (build falha se importada no cliente) · headers (CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`) · rate limit do Supabase Auth no login + limite simples nas ações admin e no preview de PDF · JWT curto · auditoria admin · nomes de arquivo sanitizados · `.env*` fora do git.

## 16. LGPD

- **Atenção:** nome do paciente + tipo de cirurgia é **dado pessoal sensível (saúde, art. 11)**. Tratamos como tal: acesso mínimo, sem esses dados em logs/auditoria/URLs, região de dados no Brasil (sa-east-1).
- Minimização: só campos que o modelo usa são coletados.
- Rascunho do formulário em `sessionStorage` do próprio aparelho (sobrevive à ida ao preview), apagado após emitir e no logout.
- Base para retenção/exclusão: `user_id` em todas as tabelas + prefixo `{uid}/` no storage → exclusão completa de um titular é uma operação única; política de retenção pode ser um job futuro.
- Dev/teste apenas com dados fictícios (`seed.sql`).
- Produção: recomendo plano **Pro** do Supabase (backups diários, sem pausa por inatividade). O plano gratuito serve para desenvolvimento.

---

## 17. Testes críticos

- **Integração (Vitest + projeto Supabase de dev):** cria Usuário A e B via Admin API; com a sessão de A tenta SELECT/UPDATE/DELETE em modelo, recibo, versão, asset e arquivo do Storage de B → **esperado: nenhuma linha / erro**. Também: admin sem sessão de suporte não lê dados; com sessão expirada não lê; usuário desativado não lê; usuário não altera o próprio `role`.
- **Unidade:** extração de variáveis do JSON, validação de campos obrigatórios, máscaras, valor por extenso, formato do número, sanitização de nome de arquivo, validador do schema do editor (rejeita nós/atributos fora da whitelist).
- **Concorrência:** N emissões simultâneas → N números distintos e sequenciais.
- **PDF:** snapshot do texto extraído + contagem de páginas para o modelo padrão.
- **E2E (fase 10, Playwright):** fluxo completo em viewport 375px.

Duas camadas de teste de banco:

- `npm run test:db` — aplica **todas as migrations num Postgres embutido (PGlite)** com stubs de `auth`/`storage` e simula usuários via `auth.uid()`. Sem rede, sem Docker: roda em qualquer máquina e no CI.
- `npm run test:integration` — mesmos cenários contra o projeto Supabase de **desenvolvimento** real (Auth, PostgREST, Storage), com usuários fictícios criados e removidos pelo teste. Nunca contra produção.

---

## 18. Riscos técnicos

| # | Risco | Mitigação |
|---|---|---|
| 1 | Projeto dentro do **OneDrive**: sincronizar `node_modules`/`.next` (centenas de milhares de arquivos) causa lentidão, arquivos travados e erros no `npm install` | Mover para pasta fora do OneDrive (ex.: `C:\dev\meu-recibo`) — o código fica salvo no GitHub |
| 2 | Rate limit do Auth por IP se login fosse pelo servidor | Login no navegador (§5) |
| 3 | Editor (HTML) e PDF (react-pdf) são motores de layout diferentes | Mesmas fontes/medidas; o preview de emissão É o PDF; "Visualizar PDF" no editor |
| 4 | Limitações do react-pdf (sem WEBP, hifenização inglesa, fontes precisam ser registradas, arquivos precisam entrar no bundle da Vercel) | PNG normalizado; hifenização desligada; `outputFileTracingIncludes` para as fontes; teste de PDF no CI |
| 5 | iOS: `share()` exige gesto do usuário; PDF em iframe só mostra 1ª página | Pré-carregar o Blob; pdf.js |
| 6 | Qualidade da remoção de fundo em fotos ruins | Correção de iluminação + ajuste manual + original preservado |
| 7 | Usuário desativado com JWT ainda válido | ban + checagem de status na RLS + JWT curto |
| 8 | Vazamento da secret key | Só em módulos `server-only`, só nas ações admin/bootstrap; nunca `NEXT_PUBLIC_` |
| 9 | Duplo toque em "Gerar PDF" | `idempotency_key` único |
| 10 | Autosave com duas abas abertas | `revision` com conflito explícito |
| 11 | Plano gratuito do Supabase pausa após 7 dias sem uso e não tem backup | Aceitável em dev; Pro em produção |
| 12 | Extensões pagas do TipTap (Pro) | Usar só pacotes MIT |
| 13 | Mudança do domínio do e-mail sintético depois de ter usuários | Definir `AUTH_EMAIL_DOMAIN` já na fase 1 |
| 14 | Limite de 4,5 MB de resposta de função na Vercel | Imagens redimensionadas → PDFs de recibo ficam na casa de 100–400 KB |

---

## 19. Plano incremental

| Fase | Entrega | Validação |
|---|---|---|
| 1 Fundação | Next.js + Tailwind + Supabase SSR, migrations (schema, RLS, storage, funções), login username, primeiro acesso, script do admin | Testes de RLS A×B passando; login real |
| 2 Admin | Criar/desativar/reativar/redefinir usuário, auditoria básica | Admin cria usuário que consegue entrar |
| 3 Onboarding | Perfil profissional, logo, assinatura (recorte + fundo) | Arquivos no storage privado, preview |
| 4 Modelos | Modelo padrão semeado, editor, variáveis, campos personalizados | Criar/editar/duplicar/arquivar com autosave |
| 5 Emissão | Formulário dinâmico, máscaras, rascunho preservado | Só campos do modelo aparecem |
| 6 PDF | Renderizador, preview, emissão, numeração, storage | PDF idêntico ao preview; concorrência |
| 7 Compartilhar | Web Share + fallback | Testado em Android e iPhone |
| 8 Histórico | Busca, filtros, duplicar, corrigir (versões) | |
| 9 Admin avançado | Modo suporte, tela de auditoria | Faixa visível, somente leitura, auditado |
| 10 Hardening | CSP, rate limits, E2E, responsividade 320→1440, acessibilidade | Critérios de aceite 1–28 |
