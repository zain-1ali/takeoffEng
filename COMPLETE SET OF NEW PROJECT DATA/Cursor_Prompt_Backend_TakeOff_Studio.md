# Cursor AI Prompt – TakeOff Studio BACKEND (`apps/api`)

**Attach:** `@docs/01_ENGINE_SPEC.md @apps/api/prisma/schema.prisma @.cursor/rules/takeoff-studio.mdc`

Build one phase at a time. After each phase, run `pnpm lint && pnpm test`, summarise the result, and wait for "next phase".

---

## 1. Role and outcome

You are a senior backend engineer. Build the production API for **TakeOff Studio**. It handles:
- multi-tenant organisations
- projects stored as collaborative documents with versions
- engine-backed quantities, rates and reports
- resource databanks
- comments, tasks, activity and notifications
- PDF/XLSX exports
- subscriptions with Stripe (cards) and Flutterwave/Paystack (mobile money), plus bank-transfer invoices

It must be secure, observable and fully typed, and work for any country, currency and tax regime.

## 2. Stack

- **Runtime and framework:** Node 22 LTS, NestJS 10, TypeScript strict, pnpm workspace.
- **Database:** PostgreSQL 16 + Prisma 5, using the provided `schema.prisma`. Money, rates and quantities are `Decimal(18,4)`.
- **Redis 7:** cache, rate-limit store, Socket.IO adapter, BullMQ queues (exports, emails, webhooks, snapshots, dunning, outbox).
- **Realtime:** Socket.IO gateway `/rt`, plus a Yjs server (`y-socket.io` server or Hocuspocus embedded) with Postgres persistence.
- **Storage:** S3-compatible (S3 or Cloudflare R2; MinIO locally), with signed URLs.
- **Auth:**
  - Passport: email magic link, Google, Microsoft; SAML/OIDC SSO for Enterprise.
  - JWT access tokens (15 min) and rotating refresh tokens (30 days, httpOnly, SameSite=Lax); optional TOTP 2FA.
- **Email:** Resend or SES + React Email templates.
- **Payments:** `stripe` SDK; Flutterwave v3 and Paystack REST with webhook signature verification.
- **Exports:** ExcelJS (live formulas) and Playwright (Chromium) rendering the web report routes to PDF.
- **Validation:** `nestjs-zod` with schemas from `packages/types`. OpenAPI 3.1 at `/docs` and `/openapi.json`.
- **Observability:** pino JSON logs with request id, OpenTelemetry traces, Prometheus `/metrics`, Sentry.
- **Security:**
  - helmet, strict CORS allow-list, `@nestjs/throttler` (Redis), CSRF on cookie routes
  - argon2 where hashing is needed, AES-256-GCM field encryption for provider references, audit log
- **Tests:** Jest + Supertest + Testcontainers (Postgres, Redis, MinIO), Stripe/Flutterwave/Paystack webhook fixtures.
- **DevOps:**
  - multi-stage Dockerfile
  - `docker-compose.yml` (api, web, postgres, redis, minio, mailpit, stripe-cli)
  - GitHub Actions (lint, test, build, migrate)
  - `.env.example`, `docs/RUNBOOK.md`

## 3. Modules

```
apps/api/src/
  main.ts app.module.ts
  config/            zod-validated env (DATABASE_URL, REDIS_URL, JWT_*, S3_*, STRIPE_*, FLW_*, PAYSTACK_*, WEB_URL, EXPORT_TOKEN_SECRET, SENTRY_DSN…)
  common/            guards (JwtAuth, Org, Roles, Entitlement), decorators (@CurrentUser, @OrgId, @Can, @RequiresEntitlement),
                     interceptors (audit, serialization of Decimal → string), filters (problem+json), pagination (cursor)
  prisma/            PrismaService, tenant-scope extension (injects orgId, blocks unscoped tenant queries), soft delete
  auth/ users/ orgs/ members/ invitations/
  projects/          CRUD, duplicate, archive, cover image upload, settings (currency, locale, tax, contingency, roof mode, stakeholders, params)
  documents/         Yjs persistence, stateJson mirror, versions (manual + auto), restore, diff summary
  engine/            EngineService wrapping packages/engine: compute(project) with Redis cache by (projectId, docVersion, databankVersion, rateVersion)
  reports/           /summary /dashboard /boq /bom /bbs /dims /rates endpoints (engine-backed JSON)
  databank/          org resources, CSV import/export, bulk % adjust, currency conversion, seeding defaults
  rates/             custom build-ups, manual rates (BOQ + BOM), rate settings, analyse endpoint
  comments/ tasks/ activity/ notifications/
  realtime/          gateway, presence (Redis hash TTL 30 s), rooms, outbox relay
  exports/           BullMQ processors: pdf (Playwright), xlsx (ExcelJS), signed export tokens, watermark for Starter
  billing/           plans.ts, entitlements, checkout (stripe|flutterwave|paystack|invoice), webhooks, invoices, seats, dunning
  fx/                display FX rates (daily fetch, Redis cache)
  audit/ health/ admin/ (feature flags, super-admin read-only views)
```

## 4. Data model

Use `apps/api/prisma/schema.prisma` from this kit. Key points:
- **Project settings:** `currency`, `currencyCustom`, `numberLocale`, `taxName`, `taxRate`, `contingencyRate`, `roofMode` (`SIMPLE|COMPLEX`), `buildingType` (`FOUNDATION|SINGLE|MULTI|ROAD|BRIDGE`), `databankCurrency`, `fxRate`, stakeholders and parameters as JSON.
- **Document:** `ProjectDocument.yState` holds binary Yjs; `stateJson` holds the latest plain JSON mirror used by the engine. **Numeric inputs are stored as the raw strings the user typed**, and formulas such as `20*15+4*2.5` are allowed; the engine evaluates them with `n()` from `packages/engine` (spec §1b). The API never evaluates formulas itself.
- **Rates:** `Resource` (org databank), `CustomRate` (per project item build-up lines), `ManualRate` (kind BOQ | BOM), `RateSettings`.
- **Collaboration:** `Comment` (anchors PROJECT | BOQ_ITEM | RATE_LINE | MEMBER_TYPE | PLACEMENT | ROOF_PLANE | ROOF_LINE), `Task`, `Activity`, `Notification`.
- **Billing:** `Subscription`, `Invoice`, `PaymentEvent` (idempotency), `CheckoutSession`.
- **Other:** `ExportJob`, `AuditLog`, `Outbox`.

## 5. Plans and entitlements (`billing/plans.ts` is the single source of truth)

| Plan | USD / user / month (monthly / annual) | Seats | Entitlements |
|---|---|---|---|
| STARTER | 0 / 0 | 1 | maxProjects 1; types FOUNDATION, SINGLE; rateAnalysis ✗; bom ✗; collaboration ✗; exportsWatermark ✓ |
| PROFESSIONAL | 29 / 23 | ≥ 1 | unlimited projects; all types; rateAnalysis ✓; bom ✓; clean exports; collaboration ✗ |
| TEAM | 49 / 39 | ≥ 3 | + collaboration (presence, comments, tasks), shared databank, versions kept 180 days |
| ENTERPRISE | custom | ≥ 10 | + SSO, audit export, private region flag, custom standards |

- **Enforcement:** `EntitlementGuard` on routes and socket handlers → **402** problem+json `{type:"upgrade_required", entitlement, currentPlan, requiredPlan}`.
- **Seats:** inviting beyond seats → 402.
- **Downgrades:** take effect at period end; over-limit projects become read-only, never deleted.

## 6. REST API (`/v1`, JSON, problem+json errors, cursor pagination, `X-Org-Id` header)

```
Auth       POST /auth/magic-link  POST /auth/verify  GET /auth/oauth/:provider(/callback)  POST /auth/refresh  POST /auth/logout
           POST /auth/2fa/setup | /verify | /disable  GET /auth/sso/:orgSlug
Me         GET /me (user, memberships, active org, role, entitlements, plan)  PATCH /me  GET /me/export  DELETE /me
Orgs       POST /orgs  GET/PATCH /orgs/:id  POST /orgs/:id/logo
Members    GET /orgs/:id/members  PATCH /orgs/:id/members/:userId  DELETE /orgs/:id/members/:userId
Invites    POST /orgs/:id/invitations  GET /invitations/:token  POST /invitations/:token/accept  DELETE /orgs/:id/invitations/:id
Projects   GET /projects?type&stage&q&cursor  POST /projects  GET/PATCH/DELETE /projects/:id  POST /projects/:id/duplicate
           POST /projects/:id/cover (multipart, ≤ 8 MB, re-encoded to 1600 px JPEG)  PATCH /projects/:id/settings
Documents  GET /projects/:id/document  PUT /projects/:id/document (If-Match: version)  (live edits go through Yjs)
Versions   GET /projects/:id/versions  POST /projects/:id/versions {name,note}  GET /projects/:id/versions/:n  POST /projects/:id/versions/:n/restore
Reports    GET /projects/:id/summary | /dashboard | /boq | /bom | /bbs | /dims | /params
Rates      GET /projects/:id/rates  GET /projects/:id/rates/:code  PUT/DELETE /projects/:id/rates/:code/custom
           PUT/DELETE /projects/:id/rates/:code/manual?kind=BOQ|BOM  PATCH /projects/:id/rate-settings
Databank   GET /databank?category&q  POST /databank  PATCH/DELETE /databank/:id  POST /databank/import (CSV)  GET /databank/export.csv
           POST /databank/adjust {category?, percent}  POST /databank/convert {toCurrency, fxRate}  POST /databank/reset-defaults
Comments   GET /projects/:id/comments?anchorType&anchorId  POST /projects/:id/comments  PATCH/DELETE /comments/:id  POST /comments/:id/resolve | /reopen
Tasks      GET /projects/:id/tasks  POST /projects/:id/tasks  PATCH/DELETE /tasks/:id
Activity   GET /projects/:id/activity?cursor
Notify     GET /notifications  POST /notifications/read-all  PATCH /notifications/:id
Exports    POST /projects/:id/exports {kind}  GET /exports/:jobId
Billing    GET /billing/plans  GET /billing/fx  GET /billing/subscription  POST /billing/checkout  GET /billing/checkout/:reference
           POST /billing/portal  POST /billing/change  POST /billing/cancel  POST /billing/invoice-request  GET /billing/invoices
Webhooks   POST /webhooks/stripe  POST /webhooks/flutterwave  POST /webhooks/paystack   (raw body, verified, idempotent)
Ops        GET /health  GET /ready  GET /metrics  GET /docs  GET /openapi.json
```

**Validation rules for numeric inputs** (document PUT, placements, databank, rates):
- Accept a number **or** a string matching `^[0-9\s.,+\-*/x×÷()%^]{1,240}$`.
- Reject other strings in numeric fields with 422 problem+json `{type:"invalid_formula", path}`.
- Evaluate via `packages/engine` `n()` only when computing. The API never `eval`s.

**Engine-backed endpoints:**
- Inputs: load `stateJson` + org databank + CustomRate + ManualRate + RateSettings.
- Run `compute`, `boqRows`, `bomRows`, `boqTotals`, `projectParams`.
- Cache in Redis keyed by `projectId:docVersion:databankVersion:rateVersion`; invalidate on any change.
- Results must equal the web app exactly, because they come from the same package.

## 7. Realtime (Socket.IO `/rt`)

- **Connect:** JWT in `auth.token`, join `org:{orgId}`. `project.join {projectId}` checks role and joins `project:{projectId}`.
- **Presence:** `presence.update {route, itemCode?, planeId?, lineId?}`, stored in a Redis hash with a 30 s heartbeat; broadcast `presence.state`.
- **Yjs:**
  - VIEWER and COMMENTER connections are read-only; reject their updates server-side.
  - Persist debounced at 2 s to `ProjectDocument` (yState + stateJson + version++).
  - Auto-snapshot a `ProjectVersion` after 10 minutes of edits.
- **Domain events** go through the Outbox table + relay after commit, so nothing is lost:
  - `comment.created|updated|resolved|deleted`
  - `task.created|updated|deleted`
  - `activity.created`
  - `version.created|restored`
  - `document.saved`
  - `export.progress|ready|failed`
  - `billing.updated`, `member.updated`, `databank.updated`, `rates.updated`
- **Mentions:** `@userId` in a comment → Notification + batched email (5 minutes).

## 8. Payments

**Stripe:**
1. **Checkout:** `POST /billing/checkout {planId, cycle, seats, provider:'stripe'}`
   - upsert the customer (metadata orgId)
   - create a Checkout Session (subscription mode) with the plan price for the cycle, quantity = seats
   - automatic tax, promotion codes, success/cancel URLs
   - return `{url}`
2. **Webhooks:**
   - events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`
   - actions: upsert Subscription and Invoice, recompute entitlements, emit `billing.updated`
3. **Customer Portal:** card, invoices and cancellation.

**Flutterwave** (M-Pesa, MTN MoMo, Airtel Money, local cards):
1. **Checkout:** `POST /billing/checkout {provider:'flutterwave', phone, network}`
   - ensure a payment plan (cached per plan × cycle × currency)
   - create `CheckoutSession` with `tx_ref = sub_{orgId}_{uuid}`
   - return the inline config
2. **Webhook `charge.completed`:**
   - verify the `verif-hash` header
   - **server-side verify** `GET /v3/transactions/:id/verify`
   - check amount, currency and tx_ref
   - activate the period
3. **Renewals and dunning:**
   - a missed renewal → `PAST_DUE`
   - dunning emails on days 1, 3 and 7
   - day 14 → downgrade to STARTER with over-limit projects read-only

**Paystack:** mirror the flow with `/transaction/initialize`, `/transaction/verify/:reference`, the `charge.success` webhook and HMAC-SHA512 signature verification.

**Invoice / bank transfer** (Team, Enterprise): create an OPEN Invoice with a PDF of bank details, grant 14 days of access, and mark paid from the admin console.

**Rules:**
- Always recompute amounts from `plans.ts`; never trust client amounts.
- Webhooks are idempotent via `PaymentEvent.id`.
- Every billing mutation is written to AuditLog.

## 9. Exports

- **XLSX (ExcelJS):**
  - **Sheets:**
    - Project (cover data, stakeholders, parameters)
    - Summary (bills, contingency, tax, total)
    - Inputs / Member schedule, Placements
    - Roofing (types, method, simple rows or planes/lines/openings/truss schedule)
    - Bar schedule (formulas), Dim sheet (squaring formulas)
    - BOQ (SUMIF formulas from the Dim sheet, rates, amounts)
    - Bill of materials, Resources, Rate analysis (formulas), Steel by diameter
  - **Formatting:** number formats from the project locale; currency code in headers.
  - **Formulas typed by users:** write the evaluated number to the cell and attach the original formula as a cell comment ("Entered as 20*15+4*2.5").
- **PDF:**
  - A BullMQ worker opens `WEB_URL/app/p/:id/{boq|bom|rates/report|bbs}?export=1&token=<5-minute signed token>`.
  - Wait for `window.__reportReady`, then print A4 with header/footer (project ref, page X of Y).
  - Upload to S3, update ExportJob, emit `export.ready`.
- **Starter watermark:** diagonal "TakeOff Studio Starter" on PDFs and header text in XLSX.
- **Limits:** 10 exports per hour per org; 60 s timeout per job.

## 10. Security checklist

- **Tenancy:** the tenant Prisma extension forbids unscoped queries. Integration tests prove cross-tenant access returns 404.
- **Roles:**
  - VIEWER read
  - COMMENTER + comment
  - EDITOR + edit projects, rates, tasks
  - ADMIN + databank, members, exports
  - OWNER + billing, delete org
- **Uploads:** MIME sniffing, size limits (images 8 MB, CSV 5 MB), sharp re-encode, random S3 keys.
- **Rate limits:** auth 10/min per IP; writes 120/min per user; CSV import 10/hour per org.
- **Numeric formulas:** regex whitelist + length limit; the engine parser is non-eval.
- **Secrets and privacy:**
  - secrets only from env
  - provider customer ids encrypted at rest
  - GDPR / Kenya DPA / Rwanda data protection: data export and deletion endpoints
  - daily Postgres backups with PITR; S3 versioning

## 11. Seed (`prisma/seed.ts`)

- **Organisation and users:** demo org (USD, en-GB, VAT 0 %); users owner, editor, commenter.
- **Databank:** default resources seeded in the order from the engine spec §10 (core, masonry and finishes, MEP, roofing).
- **Example projects:**
  - six-storey building with all modules: frame, stairs, masonry, finishes, electrical, plumbing, roofing in **simple** mode, and a complex-roof dataset kept
  - single-storey building
  - 2.0 km road
  - three-span bridge
- **Project data:** stakeholders and cover parameters on each project, version 1, sample comments and tasks.
- **Subscription:** TEAM, 5 seats.

## 12. Build phases

1. Monorepo wiring, config, Prisma schema + migration, docker-compose, health, OpenAPI skeleton, CI.
2. Auth (magic link, OAuth, refresh rotation, 2FA), users, orgs, members, invitations, guards, audit.
3. Projects, settings, cover upload, documents, versions; EngineService with Redis cache; reports endpoints (parity tests with engine snapshots).
4. Databank (CRUD, CSV, adjust, convert, reset); rates (custom, manual BOQ/BOM, settings, analyse).
5. Realtime: gateway, presence, Yjs persistence with read-only enforcement, outbox relay.
6. Comments (anchors incl. roof planes/lines, mentions), tasks, activity, notifications, email templates.
7. Billing: plans, entitlements guard, Stripe checkout/webhooks/portal, Flutterwave + Paystack checkout/verify/webhooks, invoices, dunning jobs.
8. Exports: XLSX builder (all sheets, formula comments) and Playwright PDF worker, watermark.
9. Hardening: rate limits, tenant-isolation suite, formula validation tests, k6 load test (200 concurrent editors / 20 projects), dashboards.
10. Staging deploy, runbook, published API reference.

## 13. Acceptance criteria

- [ ] `pnpm test` green; engine endpoints equal web results for all seed projects.
- [ ] Numeric fields accept formulas (`20*15+4*2.5`), reject invalid strings with 422, and exports write results with formula comments.
- [ ] `roofMode` switches which roof data is measured; there are no duplicate BOQ codes.
- [ ] Two sockets on one project see presence, edits, comments and tasks within 1 s; viewer edits are rejected.
- [ ] Stripe test and Flutterwave/Paystack sandbox payments activate plans; replayed webhooks do not double-apply.
- [ ] Starter limits and seats are enforced with 402; downgrades make over-limit projects read-only.
- [ ] PDF and XLSX exports finish in < 30 s for the multi-storey example.
- [ ] Cross-tenant access returns 404; OWASP ASVS L2 checklist reviewed.
