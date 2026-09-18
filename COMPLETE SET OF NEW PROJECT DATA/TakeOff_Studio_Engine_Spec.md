# TakeOff Studio – Engine Specification (`packages/engine`)

This is the single source of truth for measurement, pricing and bill of materials logic. It is pure TypeScript with no DOM or Node APIs. The web app runs it in a Web Worker and the API runs it for summaries and exports.

**Reference implementation:** `reference/takeoff_studio_team.html`. Search for the function names given here (`compute`, `computeFinishes`, `computeMEP`, `computeRoof`, `computeRoofx`, `catalogue`, `stdRecipe`, `finRecipe`, `mepRecipe`, `roofRecipe`, `roofxRecipe`, `analyse`, `boqRows`, `bomRows`, `boqTotals`). Port the logic; do not redesign it.

---

## 0. Package layout

```
packages/engine/src/
  types.ts                 Project, Level, all member types & placements, Rules, Grades, Mix, MaterialFactors,
                           Resource, CustomRate, RateSettings, ReportSettings, RoofX (planes/lines/openings/trusses)
  helpers.ts               n(), ceilSafe, kgPerM, band, bandText, proppingBand, san(), letter()
  context.ts               createContext(): add(), bar(), nB(), stock(), links(), stat(), warn
  compute/
    building/foundations.ts   pad, strip, gbeam, ground slab
    building/frame.ts         column, beam, slab, wall, stair (levelled)
    building/masonry.ts       masonry walls + lintels + faces → wall finishes
    building/finishes.ts      wall finish "other surfaces", rooms (floor + ceiling)
    building/mep.ts           elec, elecgear, sanit, plumb
    building/roof.ts          roof types + simple rows (mode "simple")
    building/roofx.ts         complex roof planes/lines/openings/trusses (mode "complex")
    road.ts                   sections, earthworks balance, drains, culverts, furniture
    bridge.ts                 footings, piers, walls, beams, slabs, accessories
    index.ts                  compute(project) → ComputeResult
  catalogue/                  per module; catalogue(project) → CatalogueEntry[] (deduplicated by code)
  rates/
    defaults.ts               DEFAULT_RESOURCES (see §9) with baseCurrency "USD"
    recipes/*.ts              one file per family; stdRecipe(code, project) → {family, lines[], note}
    analyse.ts                analyse(code, project) → build-up
  boq.ts  bom.ts  summary.ts  params.ts (project parameters for cover)  index.ts
```

## 1. Core types and result

```ts
type MeasuredItem = { loc: string; lvl: number /* -1 substructure/civil */; el: string; tid?: string;
  code: string; times: number; d1: number|null; d2: number|null; d3: number|null; q: number };
type Bar = { loc; lvl; el; member; mark /* `${member}-01` */; shape; dia; members; each; len; total; kg };
type ComputeResult = { items: MeasuredItem[]; bars: Bar[]; warn: string[]; tot: Record<string, number>;
  concrete: number; steelKg: number; formwork: number; byPlacement: Record<id,{conc,kg}>;
  byType: Record<id,{conc,kg,uses}>; floorArea: number; levels: Level[] };
```

**Measurement helpers:**
- **Squaring:** `q = times × (d1 ?? 1) × (d2 ?? 1) × (d3 ?? 1)`. Skip non-finite values or |q| < 1e-9. A negative `times` is a deduction.
- **`bar(ctx, shape, dia, each, len)`:**
  - Adds a Bar with `kg = members × each × len × dia²/162.2`.
  - Adds a MeasuredItem with code `R{GRP}{dia}`, times = members, d1 = len, d2 = each, d3 = kg/m. Its unit is kg, and the BOQ shows tonnes.
- **`nB(width, spacingMm)`** = `spacing > 0 && width > 0 ? ceilSafe(width/(spacing/1000)) + 1 : 0`.
- **`stock(len, dia)`:** if `len > rules.stock`, add `(ceilSafe(len/stock) − 1) × lap × dia/1000` for laps.
- **`links(len, sp, spEnd, endZone)`:** returns `2·ceilSafe(ez/spE) + ceilSafe((len−2ez)/sp) + 1` when an end zone is set and `len > 2ez`. Otherwise returns `ceilSafe(len/sp) + 1`.
- **Aggregates:**
  - `concrete` = Σ of codes in the CONC set: CPAD, CSTUB, CSTRIP, CGB, CSOG, CCOL, CBEAM, CSLAB, CWALL, CSTAIR, CBFT, CPIER, CABW, CWING, CBALL, CPARA, CGIRD, CXHEAD, CDIAPH, CDECK, CAPPR, CDRN, CBED, CHW, CAPR, CLINT.
  - `formwork` = Σ of codes matching `/^F(?!STRIS|F_)/` (excludes riser metres and floor finishes).
- **Depth bands:** `band(d)` = ≤1 → "1.00", ≤2 → "2.00", ≤4 → "4.00", else "OVER4".
- **Propping bands:** `pband(h)` = ≤3 → "3.00", ≤4.5 → "4.50", else "OVER4.50".
- **Code-safe marks:** `san(mark)` strips anything that isn't alphanumeric.

**Rules defaults:**
- Working space: `ws 0.30` (on)
- Earthwork support and anti-termite: `supOn`, `attOn` true
- `blinding 50` mm
- Covers: `cF 50, cC 40, cB 30, cS 25, cW 30` mm
- Anchorage: `anchF 12×d`, `anchB 40×d`, `anchS 20×d`
- `lap 50×d`, `hook 24×d`, `stock 12` m

**Project types (`btype`):** `foundation | single | multi | road | bridge`. Active levels:
- `multi` → all levels
- `single` → the first level only
- others → none

**Visible kinds by type:**
- road: `rpave, rdrain, rculv` (+ furniture)
- bridge: `bfoot, bpier, bwall, bbeam, bslab` (+ accessories)
- building: `pad, strip, gbeam`, and when not foundation-only: `column, beam, slab, wall, roof, masonry, wfin, ffin, cfin, elec, elecgear, sanit, plumb`; plus `stair` for multi-storey

## 1b. Calculator inputs (numeric expressions)

Every numeric input accepts a formula, not just a number. The engine stores the **raw string** the user typed, so the working stays visible and auditable, and evaluates it on read.

- **Operators:** `+ - * /`, `x` or `×` for multiply, `÷` for divide, `^` for power, parentheses, implicit multiply `2(3+1)`, unary minus, and a comma or dot decimal.
- **Percent:** a trailing `%` inside an expression divides by 100 (`200*5%` = 10). A plain `15%` means 15, so percentage fields behave naturally.
- **Safety:** use a recursive-descent parser. **Never use `eval` or `Function`.** Limit input to 240 characters. Division by zero or an invalid expression returns `NaN`, and `n()` then returns 0.
- **Detection:** `isExpr(v)` returns true when the string contains only `[0-9 . , + - * / x × ÷ ( ) % ^ space]`, has at least one operator, and is not a plain signed number or plain percentage.
- **`n(v)`:** numbers pass through. Expressions evaluate through a memoised cache (clear it at 2,000 entries). Anything else falls back to `parseFloat` with comma → dot.
- **Required tests:**

| Input | Result |
|---|---|
| `2.4*3+1.2` | 8.4 |
| `(6-0.3)*2` | 11.4 |
| `12/4` | 3 |
| `2x3` | 6 |
| `2×3÷4` | 1.5 |
| `3-1-1` | 1 |
| `-2+5` | 3 |
| `2,5*2` | 5 |
| `2(3+1)` | 8 |
| `2^3` | 8 |
| `15%` | 15 |
| `200*5%` | 10 |
| `1/0` | 0 |
| `4*` | 0 |
| `abc` | 0 |
| `600 × 600 mm` | 600 (text fallback) |

- **UI contract** (web):
  - While typing a valid formula, the box border turns green and shows a badge `= 310.00`. An invalid one turns red and shows "check formula".
  - **Enter** replaces the formula with its result.
  - The hover title shows `formula = result`.
  - Steppers and arrow keys act on the evaluated value.
  - Rates, resource prices, quantities, dimensions and percentages all accept formulas.
  - Excel export writes the evaluated number and puts the formula text in a cell comment.

---

## 2. Building – substructure and frame

Port exactly from the prototype `compute()`.

- **Pad footings** (per placement × type):
  - Earthworks: `EXCP{band}` = no × (L+2ws)(W+2ws) × depth. `SUP{band}` (perimeter × depth). `LVL`, `ATT` (base area).
  - Concrete and formwork: `BLD` = no·L·W·G. `CPAD` = no·L·W·D. `FPAD` = 2(L+W)·D. `CSTUB`/`FSTUB`, with stub height from the type.
  - Backfill: `BFL` = excavation − displaced, and `DSP` = displaced, where displaced = L·W·(G+D) + sb·sd·min(sh, pad top depth).
  - Bars:
    - bottom mats X and Y: count `nB(W−2c, bxs)`, length `L − 2c + 2·anchF·d`
    - optional top mat repeating the bottom
    - starters: no × length
    - stub links
- **Strip footings:** `EXCS{band}`, `SUP` (both sides), `LVL`, `ATT`, `BLD`, `CSTRIP`, `FSTRIP` (2 sides). Transverse bars across the width, and longitudinal bars with `stock()` laps.
- **Ground beams:** trench `EXCT{band}` with width b + 2ws and depth h + G. `SUP` ×2, `LVL`, `ATT`, `BLD`, `CGB`, `FGB` (2 sides), `BFL`/`DSP`. Bars as for beams (below).
- **Ground slab:** `TOP` (topsoil area), `LVL`, `HARD` (area × hardcore thickness), `SAND`, `ATT`, `DPM` (optional), `CSOG`, `FSOGE` (edge × t), `MESH`.
- **Columns** (per level):
  - Height = placement h, or level h − level slab zone.
  - Measures: `CCOL`, `FCOL`.
  - Bars: `n × (h + lap·d)`; links from `links(h, lks, lksEnd, ez)` with length `2((b−2c)+(d−2c)) + hook·d`.
- **Beams** (per level):
  - Downstand = h − level zone. Measures: `CBEAM` = no·span·b·down, `FBSOF` = span·b, `FBSID` = 2·span·down.
  - Bars (`beamBars`):
    - bottom and top: stock(span + 2·anchB·d)
    - extra top at supports: 2·extN × (extF·span + anchB·d)
    - side bars
    - links with end zones
- **Slabs** (per level):
  - `CSLAB` = no·L·W·t, less openings.
  - Soffit formwork `FSLAB{pband(h−t)}` = no·(L−bw)(W−bw), less openings. `FSLABE` = free edge × t.
  - Bars: bottom X/Y. Top either "full" (both directions full length) or "supports" (2·nB per direction, length 0.25·clear span + bw/2 + anchorage).
- **Walls (RC):** `CWALL`/`FWALL` (2 faces) less openings. Vertical bars `f·nB(len−2c, vs)` × (h + lap). Horizontal bars `f·nB(h−2c, hs)` × stock(len + 2·anchS·d).
- **Stairs:**
  - Geometry: risers per flight `nR = ceilSafe(rise/0.175)`, `incl = √(going² + rise²)`, `flightX = incl·waist + rise·going/(2·nR)`.
  - Measures: `CSTAIR` (flights w·flightX + landings), `FSTSOF`, `FSTRIS` (m = F·nR·w), `FSTSTR`.
  - Bars: main and distribution in flights and landings.
- **Warnings** (deduplicated):
  - pad top above ground
  - stub larger than pad
  - spacing outside 50–450 mm
  - fewer than 4 column bars
  - section too small for cover
  - openings larger than wall area
  - missing type references

**Reinforcement groups:** FND (foundations and ground beams), COL, BEAM, SLAB, WALL, STAIR, LINT (lintels), BFND, PIER, ABUT, DECK, PARA, CULV.

## 3. Masonry (`masonry`, levelled)

**Type fields:**
- `mark`
- `mat` ∈ {Hollow concrete block (HB), Solid concrete block (SB), Burnt clay brick (BR), Stone (ST)}
- `t` mm, `uL`, `uH`, `joint` mm
- `mortar` ∈ {1:3, 1:4, 1:6}
- `bfc` (brickforce every n courses, 0 = none), `dpc` bool
- `lh` (lintel depth mm), `bear` (m), `lbar`, `llk` (dia)

**Placement fields:**
- `level`, `type`, `pos` ∈ {External, Internal}
- `len`, `h` (blank → level h − zone)
- `op` (openings area m²), `opn` (number of openings), `opw` (average width m)
- `f1`, `f2` (wall finish type ids for each face), `ref`

**Measures:**
- **Walling:** `MAS{HB|SB|BR|ST}{t}{E|I}` m² = len·h, plus a deduction line of −op.
- **Brickforce:** `BFORCE` m = floor(h/((uH+joint)/1000)/bfc) × len.
- **Damp-proof course:** `DPC{t}` m = len, on the lowest active level only, when `dpc`.
- **Lintels** (if opn > 0 and opw > 0): length each `ll = opw + 2·bear`, then:
  - `CLINT` = opn·ll·(t/1000)·(lh/1000)
  - `FLINT` = opn·ll·(b + 2·lh)
  - bars (group LINT, members = opn): 2 × lbar at ll + 0.25; 2 × max(8, lbar−2) at ll − 0.05; links llk at 200 c/c, length 2((b−.05)+(lh−.05)) + 0.2
- **Faces:** apply the wall-finish face logic (§4) for f1 and f2 using len × h less op.

## 4. Finishes (`wfin`, `ffin`, `cfin`)

**Wall finish type** `wfin`: `side` (Internal/External), `base` (Cement-sand plaster | Cement-sand render | Gypsum skim | None), `bt` mm, `fin` (Emulsion paint | Weatherproof paint | Ceramic wall tiles | Stone cladding | No finish), `coats`, `tile`.

**Face logic** (area = len·h − op, or an explicit area):
- **Base coat:** `SKIM{bt}` if gypsum skim; otherwise `PLE{bt}` if External, else `PLI{bt}`.
- **Finish:**
  - Emulsion paint → `PNTI{coats}`
  - Weatherproof paint → `PNTX{coats}`
  - Ceramic wall tiles → `WTILE_{mark}`
  - Stone cladding → `CLAD_{mark}`

**Other surfaces:** `wfin` placements (level, type, area, ref) apply the face logic to the area.

**Floor finish type** `ffin`: `screed` mm, `fin` (Porcelain tiles | Ceramic tiles | Terrazzo | Timber flooring | Vinyl sheet | Epoxy coating | Carpet tiles | Power-floated concrete), `tile`, `skm` (Matching tile | Timber | PVC | None), `skh` mm.

**Ceiling type** `cfin`: `kind` (Gypsum board suspended ceiling | Mineral fibre tile suspended ceiling | Plaster and paint to soffit | Paint to fair-faced soffit | PVC ceiling panels | T&G timber ceiling), `bt`, `coats`, `drop`.

**Rooms schedule** (`ffin` placements): `level`, `room`, `type` (floor), `cf` (ceiling type id), `area`, `perim`, `doors`, `no`, `ref`.
- **Screed:** `SCR{screed}` = no × area (if screed > 0).
- **Floor finish:** power-floated → `PFLOAT`; otherwise `FF_{mark}`, = no × area.
- **Skirting:** `SK_{mark}` m = no × (perim − doors), if skm ≠ None and skh > 0.
- **Ceiling:**
  - Plaster and paint to soffit → `CPL{bt}` + `CPNT{coats}`
  - Paint to fair-faced soffit → `CPNT{coats}`
  - Otherwise → `CSUS_{mark}`, plus `CPNT{coats}` for gypsum board with coats > 0

## 5. Electrical and plumbing (levelled)

**Electrical point type** `elec`: `cat`, `desc`, `cable`, `conduit`, `run` m.

| cat | device resource | electrician h |
|---|---|---|
| Lighting point – LED panel | E01 | 0.9 |
| Lighting point – downlight | E02 | 0.7 |
| Lighting point – batten | E03 | 0.7 |
| Lighting point – exterior | E04 | 0.9 |
| Emergency light | E05 | 1.0 |
| Switch – one gang | E06 | 0.5 |
| Switch – two gang | E07 | 0.6 |
| Socket outlet – twin 13 A | E08 | 0.7 |
| Power outlet – 20 A (AC or cooker) | E09 | 0.9 |
| Data outlet Cat6 | E10 | 0.6 |
| TV outlet | E11 | 0.5 |
| Smoke detector | E12 | 0.6 |
| Manual call point | E13 | 0.6 |

**Cables:**
- 1.5 mm² → E20
- 2.5 mm² → E21
- 4 mm² → E22
- 6 mm² → E23
- Cat6 → E24
- Coaxial → E25
- Fire-resistant 1.5 mm² → E26

**Containment:**
- 20 mm PVC conduit → E30
- 25 mm PVC conduit → E31
- Surface trunking → E32
- None → no line

**Electrical measures:**
- **Points:** `EL_{mark}` No. = placement no.
- **Distribution** (`elecgear`: item, spec, unit): `EG_{mark}` = qty. Items and resources:
  - Distribution board → E40, 8 h
  - Main switchboard → E41, 24 h
  - Sub-main cable → E42, 0.25 h/m
  - Cable tray → E43, 0.3 h/m
  - Earthing system → E44, 16 h
  - Lightning protection → E45, 40 h
  - Changeover switch → E46, 6 h
  - Energy meter → E47, 2 h

**Sanitary fitting type** `sanit`: `fx`, `spec`, `cold`, `hot`, `sdia` (20/25/32), `srun` m, `wdia` (32/40/50/110), `wrun` m.
- **Fitting:** `SF_{mark}` No. = no.
- **Cold supply:** `PPRC{sdia}` m = no·srun, if cold.
- **Hot supply:** `PPRH{sdia}` m = no·srun, if hot.
- **Waste:** `WST{wdia}` m = no·wrun.

**Fitting resources, plumber hours and trap:**

| Fitting | Resource | Plumber h | Trap |
|---|---|---|---|
| WC suite | S01 | 3.5 | no |
| Wash hand basin | S02 | 2.5 | yes |
| Urinal | S03 | 3 | yes |
| Shower | S04 | 4 | yes |
| Kitchen sink | S05 | 3 | yes |
| Bath | S06 | 5 | yes |
| Floor drain | S07 | 1 | no |

**Plumbing items** (`plumb`: item, size, unit): `PL_{mark}` = qty. Items and resources:
- **Water risers** (cold and hot): PPR pipe picked from the first number in `size`: ≤20 S20, ≤25 S21, ≤32 S22, else S23.
- **Soil and vent stack** → S33, 0.5 h/m
- **Rainwater downpipe** → S47, 0.35 h/m
- **Underground drain pipe** → S46, 0.6 h/m, plus backhoe and bedding
- **Water storage tank** → S40, 8 h
- **Booster pump set** → S41, 16 h
- **Water heater** → S42, 4 h
- **Inspection chamber** → S43, 10 h
- **Septic tank** → S44, 40 h
- **Soakaway** → S45, 24 h
- **Fire hose reel** → S48, 6 h
- **Gate valve** → S49, 1 h

## 6. Roofing – one step, two methods

**Roof type** `roof` fields:
- `form` ∈ {Pitched – hip, Pitched – gable, Mono-pitch, Flat concrete slab}
- `cover` ∈ {Pre-painted IT4 iron sheets (R01, laps 1.12, sheet), Galvanised corrugated iron sheets (R02, 1.15, sheet), Stone-coated steel tiles (R05, 1.10, tile), Clay roof tiles (R03, 1.05, tile), Concrete roof tiles (R04, 1.05, tile), Torch-on bituminous membrane (R06, 1.15, flat), Liquid-applied waterproofing (R07, 1.8 kg/m², flat)}
- `spec`, `pitch` °, `overhang` m
- `struct` ∈ {Steel trusses, Timber trusses, None – concrete slab}, `ts` truss spacing m, `ps` purlin/batten spacing mm
- `ins` ∈ {None, Foil-backed (R16), Glass wool 50 mm (R17), Rigid PIR 50 mm (R18)}
- `falls` mm, `gutter`, `fascia` bools

**Method:** `project.roofMode` ∈ `"simple" | "complex"`. **Only the selected method is computed.** Data for the other method is kept.

### 6a. Simple (`roof` placements: type, L, W, no, ref – not levelled; lvl = top active level)

- **Flat:**
  - `RFSCR{falls}` = no·L·W (if falls > 0)
  - `RFMEM_{mk}` = no·L·W, plus a second line no·2(L+W)·0.3 for upstands
  - `RFINS_{mk}` = no·L·W (if insulated)
- **Pitched:** `Lp = L + 2·overhang`, `Wp = W + 2·overhang`, `cf = 1/cos(pitch)`, `rise = (mono ? Wp : Wp/2)·tan(pitch)`.
  - **Covering:** `RFCOV_{mk}` = no × Lp × Wp × cf.
  - **Ridge and hips:**
    - hip: `RFRIDGE_{mk}` = no·max(0, Lp−Wp), plus 4·no·√(2(Wp/2)² + rise²)
    - gable and mono: `RFRIDGE_{mk}` = no·Lp
  - **Trusses:** `nT = floor(L/ts) + 1`. Skip if the roof type is replaced by a truss schedule row.
    - Timber: `RFTRUSS_{mk}_S{round(W·10)}` No. = no·nT
    - Steel: `RFSTEEL_{mk}` (kg) = no·nT × W × (10 + 0.6·W)
  - **Purlins:** slope = (mono ? Wp : Wp/2)·cf; rows = ceilSafe(slope/(ps/1000)) + 1; `RFPURL_{mk}` m = no·rows·(mono ? 1 : 2)·Lp (unless struct is None).
  - **Wall plate:** `RFPLATE` = no·2·L for timber trusses.
  - **Insulation:** `RFINS_{mk}` = no·Lp·Wp·cf.
  - **Fascia and barge:** `RFFASC` = hip 2(Lp+Wp); gable 2·Lp + 4·slope; mono 2·Lp + 2·slope.
  - **Gutters:** `RFGUT` = hip 2(Lp+Wp); gable 2·Lp; mono Lp.
  - **Warning:** pitch < 5°.

### 6b. Complex (`project.roofx`)

- **Planes** `{ref, roof (type id), shape: Rectangle|Trapezium|Triangle, a (eaves m), b (top m), h (plan depth m), pitch ('' = type pitch), no, less (deduct)}`:
  - **Geometry:**
    - plan area: Rectangle a·h, Trapezium (a+b)/2·h, Triangle a·h/2
    - cf = 1/cos(pitch); rafter = h·cf
    - average purlin length: Rectangle a, Trapezium (a+b)/2, Triangle a/2
    - sign = less ? −1 : 1
  - **Flat type:** `RFSCR{falls}`, `RFMEM_{mk}`, `RFINS_{mk}` on plan area.
  - **Pitched:** `RFCOV_{mk}` = sign·no·plan·cf; `RFINS_{mk}` same; `RFPURL_{mk}` = sign·no·(ceilSafe(rafter/ps) + 1)·avgLen.
- **Lines** `{ref, kind, roof, len, on: Plan|True, p1, p2, no}`:
  - **True length:**
    - hip or valley measured on plan: `rise = L / √(cot²p1 + cot²p2)`, `true = √(L² + rise²)` (p2 defaults to p1)
    - verge measured on plan: `true = L/cos(p1)`
    - all others: true = L
  - **Codes:**
    - Ridge, Hip → `RFRIDGE_{mk}`
    - Valley → `RFVAL_{mk}`
    - Verge / barge → `RFVERGE_{mk}` + `RFFASC` if fascia
    - Eaves → `RFGUT` if gutter + `RFFASC` if fascia
    - Abutment – wall → `RFABUT`
    - Abutment – chimney → `RFCHIM`
    - Parapet / box gutter → `RFBOX`
- **Openings** `{ref, roof, kind, w, l, no}`:
  - If w·l > 1 m², deduct `−no·w·l` from `RFCOV_{mk}` (or `RFMEM_{mk}` if flat) and from `RFINS_{mk}`.
  - Item: `RF{SKYL|DORM|HATCH|VENT}_{round(w·100)}x{round(l·100)}` No. = no.
- **Truss schedule** `{mark, type: Steel truss|Steel rafter / portal|Timber truss, span, wt (kg each steel / member m each timber), no, replaces (roof type id)}`:
  - Steel → `RFSTS_{mark}` (kg) = no·wt.
  - Timber → `RFTTS_{mark}` No. = no.
- **Readouts:** plan area, area on slope, ridges and hips, valleys, openings deducted, scheduled steel.

## 7. Road

**Section type** `rpave` fields:
- `cw`, `sw`, `reserve` (widths m)
- `acw`, `acb` mm, `dens` t/m³, `sds` bool
- `base`, `subb`, `cap` mm
- `cs`, `fs` (slopes H:1V), `top` mm

**Placements:** `from`, `to` (chainage m), `cut`, `fill` (average m), `ref`.

**Per section:** `L = |to − from|`, `Wf = cw + 2sw`, `topW = Wf + 2·cs·cut + 2·fs·fill`.
- **Clearance and topsoil:** `CLR` = L·reserve; `TOPR` = L·topW·top/1000.
- **Earthworks:**
  - `RCUT` = L·cut·(Wf + cs·cut)
  - `RFILL` = L·fill·(Wf + fs·fill)
  - `SGC` = L·Wf
- **Pavement layers:**
  - `CAP{cap}` / `SUBB{subb}` / `BASE{base}` = L·Wf·t
  - `PRIME` = L·cw, if base and any asphalt
  - `ACB{acb}` = L·cw, with `TACK` if a wearing course is also present
  - `ACW{acw}` = L·cw
  - `SDS` = 2·L·sw, if sds

**Earthworks balance:** `RCUTFILL` = min(Σcut, Σfill); `RBORROW` = max(0, fill − cut); `RSPOIL` = max(0, cut − fill).

**Furniture:** `KERB` m, `RMARK` = lines × total length, `RSIGN`, `GRAIL`, `RSTUD`, `KMP`.

**Drains** (`b, d, s, lined, t, mesh`; placement `len`, `sides`):
- `EXCD` = `DSP` = len·sides·d(b + s·d)
- If lined: `CDRN` = len·perimeter·t, where perimeter = b + 2√(d² + (s·d)²); plus `MESHD` if mesh.

**Culverts** (`dia, bed, hwW, hwH, hwT, vd, vs, hd, hs, apL, apW, apT`; placement `len`, `lines`, `no`, `depth`):
- **Trench and pipes:** `Wb = lines(D+0.3) + 0.3`; `EXCC{band}` = no·len·(Wb+2ws)·depth; `CBED` = no·len·Wb·bed; `PIPE{dia}` m = no·lines·len.
- **Backfill:** `BFL`/`DSP`.
- **Headwalls:** `CHW` = 2·no·hwW·hwH·hwT; `FHW` = 4·no·hwW·hwH; bars on both faces.
- **Aprons:** `CAPR` = 2·no·apL·apW·apT; `MESHD` = 2·no·apL·apW.

## 8. Bridge

- **Footings** `bfoot` (placement `part`, `no`): like pads, without stubs. Codes: `EXCB{band}`, `SUP`, `LVL`, `BLD`, `CBFT`, `FBFT`, `BFL`, `DSP`. Group BFND.
- **Pier columns** `bpier` (placement `h`, `no`): `CPIER`, `FPIER`; main bars with `stock()`; links. Group PIER.
- **Walls** `bwall` (part → code suffix: Abutment wall ABW, Wingwall WING, Ballast wall BALL, Parapet PARA): `C{pk}` = no·len·h·t; `F{pk}` = 2·no·len·h; bars. Group PARA for parapets, otherwise ABUT.
- **Beams** `bbeam` (part: Girder GIRD, Crosshead XHEAD, Diaphragm DIAPH): `C{pk}` = no·span·b·h; `F{pk}` soffit + 2 sides; `beamBars`. Group PIER for crossheads, otherwise DECK.
- **Slabs** `bslab` (part: Deck slab DECK, Approach slab APPR): `C{pk}`; `FDECK` soffit (deck only); `F{pk}E` edges; bars as for slabs. Group DECK.
- **Accessories:** `BRG`, `EJ`, `WPF`, `SURF`, `SPOUT`, `HRAIL`, `BFGR`, taken directly from the inputs.

**Concrete grades (`gradeOf`):**
- BLD, CBED → blind
- CPAD, CSTUB, CSTRIP, CGB, CSOG, CBFT, CAPPR → found
- CCOL, CBEAM, CSLAB, CWALL, CSTAIR → frame
- CDRN, CHW, CAPR → civil
- everything else → bridge

**Mix (`mixFor`):** take the highest mix key ≤ the grade number. Default mixes (cement kg / sand m³ / aggregate m³ per m³):

| Grade | Cement kg | Sand m³ | Aggregate m³ |
|---|---|---|---|
| 15 | 230 | 0.50 | 0.90 |
| 20 | 290 | 0.47 | 0.88 |
| 25 | 340 | 0.44 | 0.85 |
| 30 | 380 | 0.42 | 0.82 |
| 35 | 420 | 0.40 | 0.80 |
| 40 | 460 | 0.38 | 0.78 |

---

## 9. Catalogue (BOQ descriptions)

**`catalogue(project)`** returns `{sec, code, unit, desc}` in bill order. **Deduplicate by code** (first entry wins).

**Units:**
- m³, m², m, No., item, t
- t items are summed in kg and divided by 1000 in the BOQ, rounded to 3 dp
- other units are rounded to 2 dp

**Bill order for buildings:**
1. Site preparation and earthworks
2. Substructure concrete, formwork and reinforcement
3. Frame – columns
4. Frame – beams
5. Frame – suspended slabs
6. Walls
7. Staircases
8. Masonry
9. Wall finishes
10. Floor finishes
11. Ceiling finishes
12. Electrical – lighting, power, data and fire alarm points
13. Electrical – distribution, containment and protection
14. Plumbing – sanitary fittings
15. Plumbing – branch pipework to fittings
16. Plumbing – risers, stacks, drainage and plant
17. Roofing

**Roads:** clearance and earthworks → pavement layers → drainage and culverts → furniture and markings.
**Bridges:** substructure → deck → bearings, joints and finishes.

**Dynamic descriptions** are built from type fields. Copy the wording from the prototype `catalogue`, `finCatalogue`, `mepCatalogue`, `roofCatalogue` and `roofxCatalogue`. Examples:
- `MASHB200E` → "Hollow concrete block walling 200 mm thick, 400 × 200 mm units, external walls, bedded and jointed in cement-sand mortar 1:4"
- `EL_LP1` → "Lighting point – LED panel: 600 × 600 mm recessed, 40 W, wired in 1.5 mm² twin & earth in 20 mm pvc conduit, average run 8 m, including back box, connections and testing (point LP1)"
- `RFVAL_RF1` → "Pre-painted valley gutter 600 mm girth with cutting of sheets (roof RF1)"

**BOQ rows (`boqRows`):**
- Skip codes with |q| < 0.0005.
- Item letters run A, B, … Z, AA, AB… across the whole bill.
- Rate = manual override (`project.manualRates[code]`) ?? analysed rate.
- amount = q × rate.

**Totals (`boqTotals`):** sub = Σ bill amounts; cont = sub × contingency%; tax = (sub + cont) × taxRate%; total = sub + cont + tax.

**Unit cost:**
- road: per km
- bridge: per m² of deck
- building: per m² of floor and slab

---

## 10. Rate analysis

**Resource:** `{code, category: Labour|Material|Plant|Subcontract, name, unit, rate, note}`. The databank has `baseCurrency`; project `fxRate` converts it live as `fxf = databankCurrency === projectCurrency ? 1 : fxRate`.

**`analyse(code)`:**
1. lines = customRate[code]?.lines ?? stdRecipe(code).lines
2. cost per line = qty × resource.rate × fxf
3. category subtotals
4. tools = Labour × toolsPct
5. direct = L + M + P + S + tools
6. overheads = direct × ohPct
7. profit = (direct + OH) × profitPct
8. rate = round2(direct + OH + profit)

**Defaults:** tools 3%, OH 10%, profit 10%.

**Recipe lookup order:** roofx → roof → MEP → finishes/masonry → structural/civil (`stdRecipe`). Copy the quantities from the prototype recipes. Key rules:

- **Concrete** (codes in CONC_F, factor f):
  - Site mix: cement bags = mix.cem/50 × 1.05, sand × 1.05, aggregate × 1.05, water 0.18; L01 0.4f, L02 0.8f, L03 2f, L04 0.1f; mixer P08 0.3; poker P09 0.2 (not for BLD/CBED); curing M36 0.25.
  - Ready-mix: M05 1.05 with reduced labour.
  - Extras: pump P17 0.06 for CSLAB, CBEAM, CDECK, CGIRD; crane P13 0.15 for bridge members.
  - CONC_F factors: BLD .6, CBED .7, CPAD 1, CSTUB 1.2, CSTRIP 1, CGB 1.1, CSOG .9, CBFT 1, CAPR .9, CDRN 1, CHW 1.3, CAPPR 1, CCOL 1.5, CBEAM 1.3, CSLAB 1.1, CWALL 1.4, CSTAIR 1.7, CPIER 1.6, CXHEAD 1.6, CABW 1.4, CWING 1.4, CBALL 1.5, CGIRD 1.6, CDIAPH 1.6, CDECK 1.2, CPARA 1.8, CLINT 1.5.
- **Formwork** (FORM_F factor c, uses = material factor):
  - Materials: plywood M09 1.1/(2.98·uses); timber M10 timber/uses; nails M11; release M12 0.1.
  - Labour: L01 0.9c, L03 0.6c.
  - Props P18 by weeks: FBSOF 2, FSLAB 2, FSTSOF 2, FGIRD 4, FDIAPH 4, FDECK 4, FXHEAD 3.
  - Risers (FSTRIS) × 0.3.
  - FORM_F factors: FPAD .8, FSTUB .9, FSTRIP .8, FGB .85, FSOGE .7, FBFT .8, FAPPRE .7, FHW 1, FCOL 1.1, FBSID 1.1, FBSOF 1.3, FSLABE .9, FWALL 1.1, FSTSOF 1.4, FSTSTR 1.3, FSTRIS .35, FPIER 1.5, FXHEAD 1.5, FABW 1.2, FWING 1.2, FBALL 1.3, FGIRD 1.5, FDIAPH 1.5, FDECK 1.2, FDECKE 1, FPARA 1.6, FLINT 1.2.
- **Reinforcement `R{GRP}{d}`** (per tonne):
  - Steel: M07 if d < 10, else M06, at 1.05. Binding wire M08 = wire factor.
  - Steel fixer L01: 44 h (d ≤ 10), 34 h (d ≤ 16), 26 h (larger); × 1.15 for bridge groups. L03 = 0.5 × L01.
  - Bender P14 3 h; crane P13 0.5 for DECK/PIER.
- **Excavation by depth band** (factor 1 / 1.2 / 1.5 / 1.9): backhoe P02 0.045f + operator, L03 0.25f, foreman L04 0.01.
- **Masonry `MAS…`:**
  - Units per m² = 1/((uL+j)(uH+j)), plus 5% breakage.
  - Resource: HB ≤120 → M46, ≤175 → M47, else M48; SB ≤120 → M49, else M50; BR → M51; ST → M52.
  - Mortar volume = t/1000 × (1 − unit face area fraction) × (0.75 for hollow block) × 1.15. Cement bags = V·1.3/(1+r)·1440/50; sand = V·1.3·r/(1+r); water = V·0.3.
  - Mason hours = (BR 1.1 | ST 1.0 | blocks 0.55) + t/1000 × (BR 2.5 | others 1.6); × 1.1 for external. Labourer = 0.8 × mason. External work adds scaffold P19 1.
- **Plaster and render:** mortar t/1000 × 1.2 at 1:4. Labour (0.3 + 0.006·t), × 1.25 external, × 1.35 ceilings. Labourer 0.7 ×. Scaffold for external (1) and ceilings (0.5).
- **Paint:** emulsion M56 0.11·(coats + 0.5) × 1.05; weatherproof M58 0.15·coats × 1.05. Painter L02 0.07·coats (× 1.3 ceiling, × 1.2 external).
- **Tiles, flooring, ceilings, electrical, plumbing and roofing:** copy the quantities from `finRecipe`, `mepRecipe`, `roofRecipe` and `roofxRecipe`.
- **Coverage:** every BOQ code must resolve to a recipe with rate > 0. Add a test that fails on any unpriced item.

**Default databank:** 68 core resources (L01–L06, M01–M45, P01–P18) plus:
- **Masonry and finishes:** M46–M78, P19–P21
- **Electrical and plumbing:** L07 electrician, L08 plumber, E01–E47, S01–S49
- **Roofing:** R01–R33

Codes, names, units and USD prices are in the prototype functions `raDefaults`, `finResourcesEnsure`, `mepResourcesEnsure`, `roofResourcesEnsure` and `roofxResourcesEnsure`. Seed them in that order.

## 11. Bill of materials

**Default material factors:**
- readymix false, concWaste 5%
- steelWaste 5%, stock 12 m, wire 10 kg/t
- meshLap 15%, meshWaste 5%
- formwork: uses 4, fwWaste 10%, timber 3.5 m/m², nails 0.2 kg/m²
- compact 1.3, anti-termite 5 l/m²
- aggWaste 5%, asWaste 3%, prime 1.0 l/m², tack 0.35 l/m², bitWaste 5%
- pipeLen 1.0 m, paint 0.5

**Sections, in order:**
1. **Concrete:** by grade, as ready-mix or cement bags/sand/aggregate/water.
2. **Reinforcement:** by diameter in tonnes, with the number of stock lengths; binding wire; mesh sheets 11.52 m² with laps.
3. **Formwork:** plywood sheets, timber, nails, release agent.
4. **Fill, membranes and treatment:** hardcore, blinding sand, DPM rolls (100 m²), anti-termite, imported fill, granular backfill.
5. **Masonry and finishes:** aggregated Material lines of each code's analysed build-up × quantity (waste already included).
6. **Electrical and plumbing:** same aggregation, Material + Subcontract.
7. **Roofing:** same aggregation. Steel truss codes use q/1000 (tonnes).
8. **Pavement and bridge materials:** as in the prototype.

**Row calculation:** `order = net × (1 + waste%)`, rounded up for No., bags, sheets and rolls. Price = manual price ?? databank price (`RES-{code}` maps to the resource rate × fxf).

## 12. Summary, parameters and dashboard data

- **`projectParams`:**
  - always: project type, measurement basis (NRM2 for buildings; CESMM4 principles for roads and bridges; overridable), currency
  - buildings: storeys, height, floor area
  - roads: length and widths
  - bridges: length, deck width, spans
  - then concrete, reinforcement, formwork, contract, start, duration, and user-defined parameters
- **Dashboard series:**
  - cost by bill; resource split (Labour, Material, Plant, Subcontract)
  - top 10 items with cumulative %; cost build-up waterfall
  - concrete, formwork and reinforcement by element; reinforcement by diameter
  - largest materials
  - building: frame concrete by level; road: cut/fill by section; bridge: steel intensity

## 13. Tests (must pass)

1. **Seed the example projects from the prototype:**
   - multi-storey building with all modules
   - single-storey building
   - foundations-only project
   - 2.0 km road
   - three-span bridge
   - roof in both simple and complex mode
2. **Snapshot every BOQ code quantity and rate** (±0.01), plus concrete, steelKg, formwork, bill totals and BOM order quantities. Generate the expected values once from the prototype with a Playwright script and commit them as JSON.
3. **Invariants:**
   - earthworks balance EXC − BFL − DSP = 0 (buildings)
   - no NaN or Infinity
   - no duplicate BOQ codes
   - every item priced
   - roof modes are exclusive (the simple-mode total never includes RFVAL/RFSTS codes, and vice versa)
4. **Expression parser:** the table in §1b.
5. **Geometry checks** (complex roof, 22.5° hip):
   - hip plan 8.49 m → true 8.84 m
   - valley plan 5.66 m → true 5.90 m
   - plane 24/12/6 trapezium → 108 m² plan, 116.9 m² slope
6. **Performance:** `compute()` + `boqRows()` + `bomRows()` < 80 ms for the multi-storey example.
