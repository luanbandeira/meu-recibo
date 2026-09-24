# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

MeuRecibo: multi-user web app for issuing professional receipts (PDF). UI, copy, comments and docs are in **Brazilian Portuguese** — keep it that way. Architecture decisions live in `docs/ARQUITETURA.md` (items marked `[CONFIRMADO]` are settled; update the doc when a decision changes). Delivery follows 10 phases listed at the end of that doc; all 10 phases are done.

## Commands

```bash
npm run dev                  # dev server (http://localhost:3000)
npm run build                # production build
npm run lint                 # eslint
npm run typecheck            # tsc --noEmit
npx next typegen             # regenerate PageProps/LayoutProps/RouteContext after adding routes
npm test                     # unit + DB/RLS tests (PGlite, offline) — run before every commit
npx vitest run tests/unit/history.test.ts         # single file
npx vitest run tests/db -t "histórico"            # single describe/test by name
npm run test:integration     # RLS isolation against the real DEV Supabase project (.env.local)
npm run test:e2e             # Playwright (installed Chrome, 375px) against `npm run dev`; E2E_BASE_URL=<url> targets a deploy
npm run db:push              # apply supabase/migrations to the DEV project (.env.local); refuses production
npm run db:push:prod         # apply to PRODUCTION (.env.production.local) — only after testing in dev and with the user's go-ahead
npm run admin:create -- --username <u> --name "<Nome>"   # bootstrap Super Admin
```

`postinstall` copies the pdf.js worker to `public/pdfjs/` and converts PDF fonts to TTF in `assets/pdf-fonts/` (both gitignored). If PDF fonts or the viewer worker are missing, rerun `npm install`.

`npm run db:types` needs Docker (not available), so RPC result types are hand-written next to the queries.

## Stack

Next.js 16 App Router (`src/proxy.ts`, not middleware), React 19, TypeScript, Tailwind v4, Supabase (`@supabase/ssr` with `getClaims`, publishable/secret keys), zod v4, TipTap 3 (MIT extensions only), `@react-pdf/renderer`, pdfjs-dist, Vitest. Deploy: Vercel (region `gru1`); every push to `main` auto-deploys.

**Environments.** The Supabase project `fwnxlxgfhskiqxzgbdwo` is **PRODUCTION** and holds real clients. The Vercel site uses it. For now there is **no separate dev project** (the user's decision on 2026-09-24; one will be created later), so `.env.local` points to production. `scripts/production.ts` makes the integration tests, the E2E tests and `npm run db:push` refuse to run against production. Until a dev project exists:
- validate changes with `npm test` (unit + PGlite, which applies every migration);
- keep migrations additive;
- apply them with `npm run db:push:prod` (reads `.env.production.local`) after telling the user;
- the user checks new flows in production with fictitious accounts.

When a dev project exists, put its keys in `.env.local` and the guarded suites run again.

## Architecture

**Security model = Postgres RLS.** The frontend is never trusted. Every table has RLS; the pattern is `user_id = (select auth.uid()) and (select private.is_active_user())`, or read-only access through `private.support_target_id()` during an admin support session. Multi-row or privileged writes go through `SECURITY DEFINER` RPCs with `set search_path = ''` that check `auth.uid()` themselves (`issue_receipt`, `correct_receipt`, `attach_receipt_pdf`, `start/end_support_session`, `admin_*`). Read RPCs such as `list_receipts` are `SECURITY INVOKER` so RLS still applies. Helpers live in the `private` schema; grants are revoked by default. New migrations go in `supabase/migrations/` (never edit applied ones) and need matching tests in `tests/db/rls.test.ts`.

**Auth.** Login is username + password. Supabase Auth only sees a synthetic email `username@${NEXT_PUBLIC_AUTH_EMAIL_DOMAIN}`. Login runs client-side (Supabase rate-limits by IP). A trigger on `auth.users` (insert or update of `raw_app_meta_data`) creates `profiles` and seeds the 11 default fields; `role`/`username` come from `app_metadata`, set only by the admin API. Server guards are in `src/features/auth/session.ts` (`requireUser`, `requireSuperAdmin`, …) and `src/features/profile/guards.ts` (`requireOnboardedUser`). Supabase clients: `src/lib/supabase/{browser,server,admin,proxy}.ts`. `admin.ts` uses the secret key and is server-only.

**Code layout.** Domain logic is in `src/features/<domain>/` (queries.ts = server reads, actions.ts = server actions, pure modules shared by client and server, `components/`). `src/app/` holds thin route files grouped as `(public)`, `(setup)` (onboarding), `(app)` (user area) and `admin/`. User-facing strings stay in Portuguese.

**Templates → receipts → PDF (the core flow):**
- A template is a TipTap document stored as **JSON** (never HTML), validated by a strict recursive zod schema (`features/templates/document/schema.ts`). Custom nodes: `variable`, `professionalHeader`, `logo`, `signature`. Send editor JSON to server actions as a **string**: ProseMirror attrs are null-prototype objects, and React server actions can't serialize them. Saving uses optimistic concurrency via a `revision` column.
- Variables resolve from three sources: profile data, emission fields (`fields` table: user-owned, system + custom) and automatic values (`numero_recibo`, `valor_extenso`). See `features/templates/document/variables.ts` and `features/receipts/values.ts`. `values.ts` has pure raw → normalized → formatted conversions (cents, ISO dates, digits-only CPF/CNPJ) and runs identically in the browser and on the server.
- Issuing: form → preview → `issue_receipt` RPC. The RPC locks the per-user/year counter, snapshots the template and profile into `receipt_versions`, and dedupes on the idempotency key. After that, `generateAndAttachPdf` renders **from the snapshots**, uploads to the private `receipts` bucket (`<user>/<receipt>/vN.pdf`) and records the SHA-256 via `attach_receipt_pdf`. Versions are immutable.
- Correction (`correct_receipt`) creates version N+1 with the same number, reusing the previous template snapshot with the current profile. The emission form and preview serve both flows through `features/receipts/flow.ts`. Duplicate = `/emitir/[templateId]?duplicar=<id>`.
- Summary columns promoted onto `receipts` (`payer_name`, `amount_cents`, `service_date`, normalized `search_text`, generated `receipt_date`) power the history RPC `list_receipts`. History filters live in the URL (`features/receipts/history.ts`).
- The preview is the real PDF: `POST /api/recibos/previa` returns bytes rendered with pdf.js (`features/pdf/pdf-viewer.tsx`). Saved PDFs are served only through `GET /api/recibos/[id]/pdf` using the user's session; there are never public storage URLs.
- PDF fonts **must be TTF**. WOFF input made react-pdf drop bold glyphs on screen; `tests/unit/pdf-fonts.test.tsx` guards this. Fonts are read from disk, so routes that render PDFs need to be covered by `outputFileTracingIncludes` in `next.config.ts` (`/api/recibos/**`, `/emitir/**`, `/recibos/**`). `@react-pdf/renderer` is in `serverExternalPackages`.

**Support mode (admin, read-only).** A super admin with an open `support_sessions` row (30 min) sees the target user's app: `requireOnboardedUser()` then returns the target's `userId` plus `support`. It **rejects support mode by default**. Only read-only pages pass `{ allowSupport: true }` and must hide write UI when `support` is set. Server actions must never opt in. PDFs delivered to an admin are audited (`admin.support.view_pdf`). The audit screen uses the `admin_list_audit` RPC.

**Security headers and limits.** The CSP with a per-request nonce is built in `src/lib/security/csp.ts` and set by the proxy. The root layout calls `connection()` so every page is dynamic and gets the nonce. Never add inline `<script>` or third-party script origins. Other headers live in `next.config.ts`. Abuse-prone actions and routes call `withinRateLimit(name, userId)` (`src/lib/security/rate-limit.ts`), which is DB-backed through the service-role-only RPC `rate_limit_hit`.

**Client-side PII.** Emission and correction drafts (patient names, CPF) live only in `sessionStorage` (`features/receipts/draft.ts`), keyed by draft id. They are cleared on sign-out, on login mount and after issuing. Never move them to localStorage or the server.

**Images.** Uploads are validated by magic bytes (`features/assets/image-validation.ts`). Signature/stamp background removal is a custom adaptive threshold in `features/assets/background-removal.ts`.

## Tests

- `tests/unit/` holds pure logic and PDF rendering. PDF assertions extract text with pdfjs.
- `tests/db/rls.test.ts` applies every migration to in-process PGlite with auth/storage stubs (`tests/db/supabase-stubs.sql`) and impersonates users via `request.jwt.claim.sub` + `set role authenticated`. Users added inside a `describe` must be deleted afterwards, because the admin tests count users.
- `tests/e2e/` (Playwright + axe) creates `e2e-pw-*` accounts in global setup and deletes them, with their files and audit rows, in teardown. `fluxo.spec.ts` is serial, and `qualidade.spec.ts` runs after it (its rate-limit test must stay last).
- `tests/integration/` hits the real DEV project. Test users are named `teste-(a|b|adm)-<hex>`, are tracked immediately on creation and are deleted in `afterAll` along with their audit rows.

## Rules for this repo

- Use only fictitious data (names, CPF, registration numbers) in code, tests, fixtures and examples. Do not suggest a specific profession as a form placeholder.
- Never read or print real client data from production. Diagnose production only with aggregates or schema queries.
- The owner's accounts (`luan`, `luciane`, `teste`) live in production. Never delete or modify them. Throwaway test users exist only in the dev project and must be named `e2e-*` or `teste-*`. Their cleanup must also remove Storage files, since deleting an auth user does not delete them.
- `SUPABASE_SECRET_KEY` and `SUPABASE_DB_URL` are server/local only. Never prefix them with `NEXT_PUBLIC_`, and never set `SUPABASE_DB_URL` on Vercel.
- Commit/push only when the user approves. Pushing to `main` deploys.
