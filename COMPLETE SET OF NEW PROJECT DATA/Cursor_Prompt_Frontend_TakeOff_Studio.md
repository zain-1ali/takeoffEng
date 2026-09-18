# Cursor AI Prompt – TakeOff Studio FRONTEND (`apps/web`)

**Attach:** `@docs/01_ENGINE_SPEC.md @reference/takeoff_studio_team.html @.cursor/rules/takeoff-studio.mdc`

Build one phase at a time. After each phase, run `pnpm lint && pnpm test`, list what was built, and wait for "next phase".

---

## 1. Role and outcome

You are a senior front-end engineer and product designer who understands quantity surveying. Build the production web app for **TakeOff Studio**. It must match the prototype's behaviour, wording, layout and numbers, rebuilt as a maintainable Next.js codebase that talks to the NestJS API (`docs/03_BACKEND_PROMPT.md`).

## 2. Stack

- **Framework:** Next.js 15 (App Router, RSC for marketing and shells, client components for editors), TypeScript strict, pnpm workspace.
- **Styling:** Tailwind CSS v4 mapped to the CSS variable tokens in the rules file. Radix UI primitives (Dialog, DropdownMenu, Tabs, Tooltip, Popover, Toast, Select). Fonts: Barlow + Barlow Semi Condensed via `next/font`.
- **State:**
  - TanStack Query v5 for server state.
  - Zustand + immer + zundo (undo/redo) as the editor facade over a **Yjs** document.
  - `y-indexeddb` offline cache.
- **Engine:** `packages/engine` runs in a **Web Worker** via Comlink, debounced at 150 ms. `useComputed()` exposes `{result, boq, bom, totals, params}`.
- **Realtime:** Socket.IO client (presence, comments, tasks, activity, exports, billing) and the `y-socket.io` provider (document sync).
- **Charts:** Recharts, themed with CSS variables. Every chart has an accessible data-table fallback.
- **Tables:** TanStack Table + `@tanstack/react-virtual` for the dimension sheet, bar schedule, BOQ and databank.
- **Forms:** react-hook-form + zod (schemas from `packages/types`).
- **i18n and numbers:** next-intl (en first). `Intl.NumberFormat(project.numberLocale)`, with `decimal.js` for money display.
- **Auth:** Auth.js v5 using API endpoints (magic link, Google, Microsoft). The active org id is kept in a cookie and sent as `X-Org-Id`.
- **Payments:** `@stripe/stripe-js` (Checkout redirect, Customer Portal), plus Flutterwave and Paystack inline scripts loaded on demand.
- **Tests:** Vitest + Testing Library, Playwright, Storybook 8 for `packages/ui`.

## 3. Folder structure

```
apps/web/
  app/
    (marketing)/page.tsx pricing/ features/[slug]/ legal/[doc]/ login/ signup/ verify/ invite/[token]/
    (app)/app/layout.tsx                         ← org switcher, top bar, notifications
    (app)/app/page.tsx                           ← workspace projects grid
    (app)/app/new/page.tsx                       ← new project wizard
    (app)/app/p/[projectId]/layout.tsx           ← project shell: top bar + left nav + worker + Yjs provider
      setup/ levels/ [kind]/ roofing/ rules/ dashboard/ boq/ bom/ rates/ rates/report/ bbs/ dims/ team/ versions/
    (app)/app/databank/ settings/{organisation,members,billing,profile}/
    api/og/route.tsx                             ← OG images
  src/
    lib/api/ (generated client + hooks)  lib/realtime.ts  lib/format.ts  lib/expr.ts (re-export engine n/isExpr/evalExpr)
    features/
      editor/ (store, yjs binding, useProjectDoc, useComputed, worker/engine.worker.ts)
      inputs/ (TypeSchedule, PlacementTable, schemas per kind, drawings per kind)
      roofing/ (RoofTypes, MethodPicker, SimpleRoofTable, ComplexRoof: Planes, Lines, Openings, TrussSchedule, PlanSketch)
      reports/ (CoverPage, SummaryPage, BillPage, BomPage, RateReport, BarSchedule, DimSheet, print.css)
      dashboard/  rates/  databank/  collaboration/  billing/  marketing/
  public/  e2e/  vitest.config.ts  playwright.config.ts
packages/ui/src/ (NumberField, TextField, SelectField, Switch, DiaChips, Readout, TypeChips, KpiCard, charts/*, ReportPage, AvatarStack, CommentButton, Drawer, Kanban, PlanCard, Toast, EmptyState, ConfirmDialog)
```

## 4. Design system (`packages/ui`)

Use the tokens and fonts in the rules file.

**Components** (each with a Storybook story and tests):

- **`NumberField`**, the most important component:
  - Layout: − stepper | input | + stepper | unit tag. Blue condensed text on a pale yellow fill.
  - **Calculator inputs (engine spec §1b):**
    - accepts `2.4*3+1.2`, `(6-0.3)*2`, `20×15+4×2.5`, `12/4`, `200*5%`
    - stores the raw string
    - shows a green badge `= 310.00` under the box when valid, and a red border with "check formula" when invalid
    - **Enter** replaces the formula with its result
    - hover title shows `formula = result`
    - ↑/↓ step the evaluated value (Shift ×10), and the steppers do the same
  - Accepts a comma decimal, an `inputMode="decimal"` keyboard, and exposes `aria-describedby` for the result badge.
  - Works inside table cells (compact variant) and inline in forms.
- **Other inputs:** `TextField`, `SelectField`, `Switch`, `DiaChips` (6–32 mm), `Readout`.
- **`TypeChips`:** schedule chips (mark, summary, "12 in use" / kg) + Add type.
- **`PlacementTable`:**
  - rows grouped by level, with an **Add row** button in each level header
  - computed columns (concrete, steel), hidden for finishes, electrical, plumbing and roofing
  - "Copy rows from level X to all levels above"
  - delete row
  - virtualised above 200 rows
- **Charts:** `KpiCard`, `DonutChart`, `ColumnChart`, `HBarList`, `ParetoChart` (bars = share, line = cumulative %), `WaterfallChart` (measured work → contingency → tax → total), `StackedBar`.
- **Reports:** `ReportPage` (A4 sheet, print CSS), `CoverPage`, `SummaryPage`, `BillTable`, `SignBlock`.
- **Collaboration:** `AvatarStack`, `PresenceDot`, `CommentButton` (unresolved count), `CommentDrawer`, `KanbanBoard`, `ActivityFeed`.
- **Billing:** `PlanCard`, `BillingToggle`, `CheckoutDialog`.
- **Feedback:** `Toast`, `EmptyState`, `ConfirmDialog`.

## 5. Screens (match the prototype)

### 5.1 Marketing
- **Landing** (`/`):
  - sticky nav: Features, Project types, Collaboration, Pricing, FAQ, Open the app
  - hero with a live product preview (real computed example numbers)
  - standards strip (NRM2, CESMM4, your own standard; outputs BOQ, BBS, BOM, rate analysis, Excel, PDF)
  - 6-card feature grid, 3-step "how it works"
  - project type cards (Buildings, Roads, Concrete bridges), each opening an example
  - collaboration section with a mock thread
  - pricing, FAQ, CTA band, footer
- **Pricing:**
  - Starter / Professional / Team / Enterprise from `GET /billing/plans`
  - monthly/annual toggle (annual saves 20%)
  - "Show prices in" currency select (approximate, from `GET /billing/fx`)
  - plan comparison table, and payment methods: card, M-Pesa, MTN MoMo, Airtel Money, bank transfer
- **SEO:** metadata, OG images, sitemap, robots. Lighthouse ≥ 90.

### 5.2 Workspace
- **Projects grid:** cards with a type illustration, name, type, currency, stage, version, last editor, updated time, and presence dots. Search and filters.
- **New project wizard:**
  1. Type: foundations only, single storey, multi-storey, road, concrete bridge.
  2. Currency (about 40 ISO codes + custom), number format, tax name and rate, contingency.
  3. Measurement standard.
  4. Cover page: name, reference, revision, stage, description, image upload, stakeholders.

### 5.3 Project shell
- **Top bar:** home logo, editable project name, meta line (location · type · drawings), peer avatars, sync pill (Saved vN / Unsaved / Newer version available / Offline), plan badge, Open / Save version / Export.
- **Left nav** (filtered by project type):
  - **Building type segment:** Foundations only / Single storey / Multi-storey | Civil works: Road / Concrete bridge.
  - **Inputs:**
    - Project & type
    - Levels (multi-storey)
    - Pad footings, Strip footings, Ground beams & slab
    - Columns, Beams, Slabs, Walls
    - Staircases (multi-storey)
    - **Roofing** – a single item
    - Masonry walls, Wall finishes, Floor finishes & rooms, Ceiling finishes
    - Electrical points, Electrical distribution, Sanitary fittings, Plumbing pipework & plant
    - Covers & rules
    - Road: Road sections, Side drains, Culverts, Road furniture
    - Bridge: Bridge footings, Pier columns, Abutments & walls, Girders & crossheads, Deck & approach slabs, Bearings & finishes
  - **Collaborate:** Team workspace.
  - **Pricing:** Rate analysis, Resource databank.
  - **Reports:** Dashboard, Bills of quantities, Bill of materials, Rate analysis report, Bar schedule, Dimension sheet.
  - **Totals footer:** concrete, reinforcement, formwork, bar marks.
- **Right panel** (input screens):
  - section drawing of the selected type: pad, column, beam, slab, wall, strip, stair, masonry elevation, wall/floor/ceiling build-up, electrical symbol, sanitary fitting, roof section
  - live quantities for the current element, and whole-structure totals
  - project setup screens show a live cover page preview instead

### 5.4 Member type screens (generic)
- **Types fieldset:** `TypeChips`, then field groups rendered from the kind's schema (text, number, dia chips, bool, select), with Duplicate and Delete (confirm when the type is in use).
- **Where they occur:** `PlacementTable` from the placement schema. Field kinds: `type` (own types), `ftype` (select from another kind's types, e.g. wall finish or ceiling finish), `sel`, `num`, `text`. Rows are grouped by level for levelled kinds.
- **Screen-specific additions:**
  - **Wall finishes:** note that masonry faces are picked up automatically, plus an "Other surfaces" table.
  - **Floor finishes & rooms:** the placement table is the **Room finishes schedule** (room, floor finish, ceiling finish, area, perimeter, less door widths, number off).
  - **Ceiling finishes:** types only, with a link to the rooms schedule.

### 5.5 Roofing (one screen)
1. **Roof types:** form, covering, specification, pitch, overhang, structure, truss spacing, purlin/batten spacing, insulation, screed to falls, gutters, fascia.
2. **Measurement method:** a single **dropdown** – "Simple roof – rectangles" | "Complex roof – planes, lines, openings and truss schedule" – with a one-paragraph explanation. Only the selected method is computed. Switching keeps the other method's data.
3. **Simple:** roofs table (type, plan length, plan width/span, No., location).
4. **Complex:**
   - **Readouts:** plan area, area on slope, ridges and hips, valleys, openings deducted, scheduled steel.
   - **Roof planes:** plane, roof type, shape, eaves length, top length, plan depth, pitch (blank = type), No., Deduct, plan m², slope m².
   - **Roof lines:** line, type (Ridge / Hip / Valley / Verge / Eaves / Abutment – wall / Abutment – chimney / Parapet or box gutter), roof, length, measured on (Plan/True), pitch 1, pitch 2, No., true total.
   - **Openings:** type (Skylight / Dormer / Roof hatch / Vent), roof, width, length on slope, No., deducted m² (only > 1 m²).
   - **Truss schedule:** mark, type (steel truss / steel rafter / timber truss), span, kg or m each, No., "replaces estimate for", total.
   - **Side panel:** roof type section, a labelled L-shaped plan sketch (ridge, hip, valley, verge, eaves, opening), and live roofing quantities.

### 5.6 Road and bridge screens
Same generic pattern, plus:
- **Road furniture:** kerbs, marking lines, signs, guardrail, studs, km posts.
- **Bearings & finishes:** bearings, joints, waterproofing, surfacing, spouts, handrail, granular backfill.

### 5.7 Covers & rules
- Covers per element.
- Anchorage and lap multipliers, link hooks, stock length.
- Working space and its toggle, blinding, earthwork support and anti-termite toggles.
- Material factors (bill of materials).
- Reset to example project.

### 5.8 Dashboard
- **KPIs:**
  - hero total including contingency and tax, with unit cost (per m² / per km / per m² deck)
  - measured work and pricing coverage
  - concrete, reinforcement with kg/m³, formwork, excavation with balance
- **Charts:**
  - cost by bill (donut)
  - resource split (donut)
  - top 10 items (Pareto)
  - cost build-up (waterfall)
  - concrete by element
  - reinforcement by diameter
  - formwork by element
  - reinforcement by element × diameter (stacked)
  - largest materials
  - type-specific: frame concrete by level, road cut/fill by section, or bridge steel intensity
- Reinforcement ratio table with typical ranges and check tags.

### 5.9 Reports
All reports use print CSS: A4, `break-after: page` for the cover and summary, and a header/footer with project ref and page X of Y.

- **Bills of quantities:**
  1. **Cover page:** hero image or type illustration, document chip, stage · type, name, description, location, chips (ref, revision, date, currency, prepared by), project parameters (auto + custom), stakeholders, drawings, dark footer.
  2. **Summary page:**
     - KPIs: measured work, bills, items priced, unit cost
     - bills table with share %
     - subtotal, contingency %, subtotal incl. contingency, tax (custom name) %, **Total carried to form of tender**
     - charts: cost by bill, resource split, waterfall, top items
  3. **Bills:** "Bill No. n – section" with item letters, description plus comment button, qty, unit, **rate input** (placeholder = analysed rate, typed value = manual override shown with a red edge, formulas allowed), amount, and bill total carried to summary. Signature block at the end.
  - **Toolbar:** contingency, tax, Rate analysis link, Print/PDF, Download Excel.
- **Bill of materials:**
  - Cover page, then a materials summary (groups table, donut, ten largest materials), then sections.
  - Columns: material, specification and basis, unit, net, waste, order qty, unit price input (placeholder from databank), amount.
  - Toolbar: ready-mix switch, edit material factors, print.
- **Rate analysis report:** cover page, then per bill and item a build-up table (resource, unit, qty, rate, cost) with direct / tools / OH / profit / rate.
- **Bar schedule:** filters by element and level; columns: bar mark, shape, dia, No. of members, bars in each, total bars, length each, total length, weight.
- **Dimension sheet:** filter by location; columns: times, dim 1–3, squaring, unit, description, code.

### 5.10 Pricing
- **Rate analysis** (master–detail):
  - **KPIs:** items priced x/y with meter, bill value, direct cost split bar, and global small tools / overheads / profit inputs.
  - **Item list** (left, searchable, grouped by bill): item, description, qty, rate, badge Standard / Edited / Manual.
  - **Detail** (right):
    - header with the analysed rate box
    - manual override banner with a "Use analysed rate" button
    - missing-resource warning, productivity note
    - build-up table grouped by category: resource select (grouped by category), unit, qty per unit (formula-enabled), rate, cost, remove
    - subtotals, small tools, direct cost, overheads, profit, **rate per unit**
    - "Add resource", "Reset to standard build-up", cost split bar
    - comment button
- **Resource databank:**
  - search, category chips, add resource, export/import CSV (`code,category,name,unit,rate,notes`)
  - price basis note; adjust prices by % for all or one category
  - banner when the databank currency differs from the project currency, with the exchange rate and a "Convert databank" button
  - table grouped by category: code, name, category, unit, rate (formula-enabled), notes, used-in count, delete

### 5.11 Team workspace
- **Project status card:**
  - not shared → Share; shared → version, saved by, time, auto-save switch, Save now, Stop syncing
  - conflict → "Load their version" / "Overwrite with mine"
- **Presence and activity:** online now (avatar, name, where they are, item), activity feed.
- **Tasks:** kanban with To do / In progress / For review / Done; add task with assignee (member search) and due date; drag and drop.
- **Discussion:** project thread (latest 3 messages + open drawer).
- **Other workspace projects:** open or remove.
- **Comment drawer:** item header, thread, resolve/reopen, delete own, composer with @mentions.

### 5.12 Settings
- **Organisation:** name, logo, default currency/locale/tax/standard.
- **Members:** invite, roles owner/admin/editor/commenter/viewer, seats used.
- **Billing:** plan, renewal, seats, invoices, change plan, cancel, card portal, mobile-money flow.
- **Profile.**

## 6. Editor data flow

1. **Load:** `GET /projects/:id` (meta) → connect the Yjs provider for `project:{id}`. Hydrate the Zustand facade.
2. **Edit:** each input writes the **raw string** into Yjs (formulas preserved). A `useProjectDoc(path)` selector returns `[value, set]`.
3. **Compute:** the worker receives a debounced snapshot and runs `compute` → `boqRows` → `bomRows` → `boqTotals`, then returns the results. Show a subtle "calculating" indicator after 300 ms.
4. **Save:** the server persists Yjs updates. "Save version" calls `POST /projects/:id/versions`; auto-snapshots every 10 minutes of activity.
5. **Permissions:** viewers get read-only inputs; commenters can comment; editors edit; admins manage databank and members; owners manage billing. Gate controls with `useCan()`.
6. **Offline:** y-indexeddb with a pill; merge on reconnect.

## 7. Money, currency, locale
- `formatMoney(v, project)` and `formatQty(v, unit, dp)`.
- Tonnes shown to 3 dp; money to 2 dp (0 dp in KPI cards).
- Databank conversion is live via `fxRate` unless converted permanently.

## 8. Payments UI
- **Checkout dialog:** plan summary, cycle toggle, users stepper (min seats), organisation, payment tabs.
  - **Card:** `POST /billing/checkout {provider:'stripe'}` → redirect to Checkout.
  - **Mobile money:** `POST /billing/checkout {provider:'flutterwave'|'paystack', phone, network}` → open the inline modal, then wait for the socket event `billing.updated` or poll `GET /billing/checkout/:ref`.
  - **Bank transfer:** `POST /billing/invoice-request`.
- **Entitlements:** read from `GET /me`. Show upgrade prompts at gated actions: extra projects, road/bridge types, rate analysis, BOM, collaboration, clean exports.

## 9. Exports
- `POST /projects/:id/exports {kind: BOQ_PDF|BOM_PDF|RATE_PDF|BBS_PDF|FULL_XLSX}` → progress toast via socket → download from a signed URL.
- The report routes accept `?export=1&token=…` for server rendering and set `window.__reportReady = true` when charts have painted.

## 10. Quality bars
- **Speed:** keystroke → totals < 200 ms (multi-storey example); LCP < 2.5 s for the dashboard.
- **Stability:** zero console errors or hydration warnings; error boundary per route.
- **Accessibility:** axe shows no serious issues; charts have table fallbacks; full keyboard use.
- **Playwright e2e:**
  1. Sign up → create a multi-storey project → change column C1 to 600×600 → totals change.
  2. Type `20*15+4*2.5` in a room area → badge shows `= 310.00` → Enter replaces it → the BOQ floor finish quantity updates.
  3. Roofing: switch simple → complex → bill changes and there are no duplicate codes.
  4. Rate analysis: edit a quantity → the item shows "Edited" and the BOQ rate changes; type a manual rate → red edge; clear → analysed rate returns.
  5. Two browsers: B comments on an item → A sees the badge → resolves it.
  6. Stripe test checkout and Flutterwave sandbox mobile money activate plans.
  7. Viewer cannot edit.
  8. Offline edit → reconnect → merged.
  9. BOQ PDF and full XLSX export download.

## 11. Build phases
1. Workspace wiring, tokens, fonts, `packages/ui` primitives including **NumberField with formulas**, Storybook.
2. Wire `packages/engine` into a worker; `useComputed`; snapshot parity tests pass in the browser.
3. Marketing site (landing, pricing, features, legal, auth screens).
4. API client generation, auth, org switcher, workspace grid, new project wizard.
5. Project shell, nav filtering, generic type/placement screens, drawings, all building inputs.
6. Roofing screen (types, method dropdown, simple, complex), road and bridge inputs, covers & rules.
7. Dashboard, reports (cover, summary, BOQ, BOM, rate report, BBS, dims), print CSS.
8. Rate analysis editor and resource databank (CSV, adjust, currency).
9. Realtime: Yjs sync, presence, comments, tasks, activity, versions, notifications, offline.
10. Billing screens and gating; exports; accessibility and performance passes; full e2e suite green.

## 12. Acceptance criteria
- [ ] Engine results in the browser equal the prototype for every example project.
- [ ] Every numeric input accepts formulas as specified and preserves the raw text.
- [ ] Roofing is one nav item with a method dropdown; methods are exclusive.
- [ ] Every report begins with a cover page; the BOQ has a charted summary page before the bills.
- [ ] Any currency, locale, tax name and rate work end to end, including exports.
- [ ] Every BOQ item is priced; manual overrides are visible and reversible.
- [ ] Presence, comments and tasks propagate within 1 s; conflicts are handled.
- [ ] Plan entitlements are enforced in the UI and match the API.
- [ ] Lighthouse ≥ 90 on marketing pages; e2e suite green.
