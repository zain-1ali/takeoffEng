import type { MaterialFactors, Resource, ResourceCategory } from "./pricing-types.js";

type ResourceSeed = readonly [
  code: string, category: ResourceCategory, name: string, unit: string,
  rate: number, note?: string,
];

const CORE: readonly ResourceSeed[] = [
  ["L01","Labour","Skilled tradesman (mason, carpenter, steel fixer)","h",1.6],
  ["L02","Labour","Semi-skilled worker","h",1.1],["L03","Labour","General labourer","h",0.7],
  ["L04","Labour","Foreman / supervisor","h",2.5],["L05","Labour","Plant operator","h",1.8],
  ["L06","Labour","Truck driver","h",1.4],
  ["M01","Material","Cement CEM I 42.5N","bag",9.5,"50 kg bag"],["M02","Material","River sand","m³",22],
  ["M03","Material","Crushed aggregate 20 mm","m³",35],["M04","Material","Water","m³",1.5],
  ["M05","Material","Ready-mix concrete C30/37 delivered","m³",128],
  ["M06","Material","High yield steel bars (Y10–Y32)","t",950],["M07","Material","Mild steel bars (R6–R8)","t",900],
  ["M08","Material","Binding wire 16 SWG","kg",2.2],["M09","Material","Plywood 18 mm shuttering sheet 1.22 × 2.44 m","sheet",32],
  ["M10","Material","Sawn timber 50 × 100 mm","m",1.2],["M11","Material","Wire nails, assorted","kg",2.5],
  ["M12","Material","Mould release agent","l",3],["M13","Material","Steel fabric mesh A193","m²",4.8],
  ["M14","Material","Polythene membrane 1000 gauge","m²",0.9],["M15","Material","Hardcore","m³",18],
  ["M16","Material","Anti-termite solution, diluted","l",0.35],["M17","Material","Natural gravel from borrow pit","m³",8],
  ["M18","Material","Graded crushed stone base material","m³",30],["M19","Material","Asphalt concrete, plant mixed","t",95],
  ["M20","Material","Cutback bitumen MC-30","l",1.3],["M21","Material","Bitumen emulsion K1-60","l",1.1],
  ["M22","Material","Chippings 14 mm and 10 mm","m³",40],["M24","Material","Precast concrete kerb, 1.0 m unit","m",9],
  ["M25","Material","Thermoplastic road marking material","kg",2.8],["M26","Subcontract","Road sign with post, supplied","No.",180],
  ["M27","Subcontract","W-beam guardrail with posts, supplied","m",45],["M28","Material","Reflective road stud","No.",6],
  ["M29","Material","Precast kilometre post","No.",60],["M30","Subcontract","Elastomeric bearing, supplied","No.",650],
  ["M31","Subcontract","Expansion joint system, supplied","m",420],["M32","Material","Deck waterproofing membrane","m²",9],
  ["M33","Subcontract","Galvanised steel handrail, fabricated","m",75],["M34","Material","Deck drainage spout","No.",55],
  ["M35","Material","Granular backfill material","m³",25],["M36","Material","Curing compound","l",2.5],
  ["M37","Material","Penetration bitumen 80/100","l",1.25],["M38","Material","Steel fabric mesh A142","m²",3.6],
  ["M39","Material","Precast concrete pipe 450 mm","m",32],["M40","Material","Precast concrete pipe 600 mm","m",45],
  ["M41","Material","Precast concrete pipe 750 mm","m",62],["M42","Material","Precast concrete pipe 900 mm","m",85],
  ["M43","Material","Precast concrete pipe 1200 mm","m",140],["M45","Material","Dense bitumen macadam, plant mixed","t",85],
  ["P01","Plant","Hydraulic excavator 20 t, wet hire","h",55],["P02","Plant","Backhoe loader, wet hire","h",32],
  ["P03","Plant","Tipper truck 10 m³, wet hire","h",30],["P04","Plant","Vibratory roller 12 t, wet hire","h",40],
  ["P05","Plant","Plate compactor","h",5],["P06","Plant","Motor grader, wet hire","h",60],
  ["P07","Plant","Water bowser","h",25],["P08","Plant","Concrete mixer 350 l","h",6],
  ["P09","Plant","Poker vibrator","h",3],["P10","Plant","Asphalt paver","h",90],
  ["P11","Plant","Pneumatic tyred roller","h",45],["P12","Plant","Bitumen distributor","h",50],
  ["P13","Plant","Mobile crane 25 t","h",75],["P14","Plant","Bar bending and cutting machine","h",4],
  ["P15","Plant","Bulldozer D6, wet hire","h",70],["P16","Plant","Line marking machine","h",20],
  ["P17","Plant","Concrete pump","h",60],["P18","Plant","Steel props and falsework hire","m²·wk",0.9],
];

const FINISHES: readonly ResourceSeed[] = [
  ["M46","Material","Hollow concrete block 400 × 200 × 100 mm","No.",.55],["M47","Material","Hollow concrete block 400 × 200 × 150 mm","No.",.75],
  ["M48","Material","Hollow concrete block 400 × 200 × 200 mm","No.",.95],["M49","Material","Solid concrete block 400 × 200 × 100 mm","No.",.7],
  ["M50","Material","Solid concrete block 400 × 200 × 150 mm","No.",1],["M51","Material","Burnt clay brick 230 × 110 × 75 mm","No.",.12],
  ["M52","Material","Dressed stone block 400 × 200 × 200 mm","No.",1.2],["M53","Material","Brickforce ladder reinforcement","m",.45],
  ["M54","Material","Bituminous damp-proof course 225 mm wide","m",.6],["M55","Material","Gypsum skim plaster","kg",.4],
  ["M56","Material","Emulsion paint","l",4.5],["M58","Material","Weatherproof masonry paint","l",6.5],
  ["M59","Material","Ceramic wall tiles","m²",11],["M60","Material","Tile adhesive","kg",.35],["M61","Material","Tile grout","kg",1.2],
  ["M62","Material","Natural stone cladding","m²",28],["M63","Material","Ceramic floor tiles","m²",12],["M64","Material","Porcelain floor tiles","m²",18],
  ["M65","Material","Terrazzo chips, pigment and divider strips","m²",9],["M66","Material","Timber flooring boards","m²",35],
  ["M67","Material","Vinyl sheet flooring","m²",14],["M68","Material","Floor smoothing compound","kg",.9],
  ["M69","Material","Epoxy floor coating","kg",9],["M70","Material","Carpet tiles","m²",16],["M71","Material","Timber skirting 100 mm","m",2.5],
  ["M72","Material","PVC skirting","m",1.4],["M73","Material","Gypsum board 12.5 mm","m²",5.5],["M74","Material","Suspended ceiling grid","m²",4],
  ["M75","Material","Ceiling screws, tape and jointing","m²",.8],["M76","Material","Mineral fibre ceiling tiles","m²",7],
  ["M77","Material","PVC ceiling panels","m²",6.5],["M78","Material","T&G timber ceiling boards","m²",18],
  ["P19","Plant","Scaffolding hire","m²·wk",.35],["P20","Plant","Terrazzo grinding machine","h",8],["P21","Plant","Power trowel","h",7],
];

const MEP: readonly ResourceSeed[] = [
  ["L07","Labour","Electrician","h",2.2],["L08","Labour","Plumber","h",2],
  ["E01","Material","LED panel light 600 × 600 mm, 40 W","No.",28],["E02","Material","LED downlight 18 W","No.",12],
  ["E03","Material","LED batten 1200 mm","No.",14],["E04","Material","Exterior bulkhead light IP65","No.",18],
  ["E05","Material","Emergency light, maintained 3 h","No.",35],["E06","Material","One-gang light switch","No.",3.5],
  ["E07","Material","Two-gang light switch","No.",5],["E08","Material","13 A twin switched socket outlet","No.",6.5],
  ["E09","Material","20 A double-pole switched outlet","No.",12],["E10","Material","Cat6 data outlet","No.",9],
  ["E11","Material","TV coaxial outlet","No.",6],["E12","Material","Smoke detector","No.",22],["E13","Material","Manual call point","No.",25],
  ["E20","Material","Cable 1.5 mm² twin & earth","m",.55],["E21","Material","Cable 2.5 mm² twin & earth","m",.85],
  ["E22","Material","Cable 4 mm² twin & earth","m",1.35],["E23","Material","Cable 6 mm² twin & earth","m",2],
  ["E24","Material","Cat6 data cable","m",.4],["E25","Material","Coaxial cable","m",.35],["E26","Material","Fire-resistant cable 1.5 mm²","m",1.6],
  ["E30","Material","PVC conduit 20 mm with fittings","m",.45],["E31","Material","PVC conduit 25 mm with fittings","m",.65],
  ["E32","Material","PVC surface trunking","m",1.8],["E33","Material","Back box, grommets and accessories","No.",.9],
  ["E40","Material","Distribution board TPN 12-way with MCBs","No.",320],
  ["E41","Subcontract","Main switchboard with incomer and outgoing MCCBs","item",2500],
  ["E42","Material","Armoured sub-main cable 4-core 16 mm²","m",9.5],["E43","Material","Perforated cable tray 150 mm with supports","m",7.5],
  ["E44","Subcontract","Earthing system: rods, bars and tape","item",650],["E45","Subcontract","Lightning protection system","item",2800],
  ["E46","Material","Changeover switch 100 A","No.",480],["E47","Material","Energy meter","No.",90],
  ["S01","Material","WC suite with cistern and seat","No.",110],["S02","Material","Wash hand basin with pedestal and mixer","No.",75],
  ["S03","Material","Urinal bowl with flush valve","No.",90],["S04","Material","Shower tray with mixer and head","No.",140],
  ["S05","Material","Stainless steel kitchen sink with mixer","No.",95],["S06","Material","Bath with mixer","No.",220],
  ["S07","Material","Floor drain 100 mm with grating","No.",14],["S10","Material","Bottle trap and waste fittings","No.",6],
  ["S11","Material","Angle isolating valve","No.",5],["S12","Material","Flexible connector","No.",3],
  ["S20","Material","PPR pipe PN20 20 mm","m",1.1],["S21","Material","PPR pipe PN20 25 mm","m",1.6],
  ["S22","Material","PPR pipe PN20 32 mm","m",2.4],["S23","Material","PPR pipe PN20 50 mm","m",5.2],
  ["S25","Material","PPR fittings allowance","m",.45],["S30","Material","uPVC waste pipe 32 mm","m",1.2],
  ["S31","Material","uPVC waste pipe 40 mm","m",1.6],["S32","Material","uPVC waste pipe 50 mm","m",2.1],
  ["S33","Material","uPVC soil pipe 110 mm","m",4.5],["S35","Material","uPVC fittings allowance","m",.6],
  ["S36","Material","Pipe clips and brackets","m",.35],["S40","Material","Polyethylene water tank 5,000 l","No.",650],
  ["S41","Material","Booster pump set with pressure vessel","No.",1400],["S42","Material","Electric water heater 100 l","No.",280],
  ["S43","Material","Precast inspection chamber with cover","No.",180],["S44","Material","Septic tank, built","No.",3500],
  ["S45","Material","Soakaway pit","No.",900],["S46","Material","uPVC underground drain pipe 150 mm","m",9],
  ["S47","Material","uPVC rainwater downpipe 100 mm","m",3.5],["S48","Material","Fire hose reel, complete","No.",450],
  ["S49","Material","Gate valve 50 mm","No.",38],
];

const ROOF: readonly ResourceSeed[] = [
  ["R01","Material","Pre-painted IT4 iron sheet 0.4 mm","m²",7.5],["R02","Material","Galvanised corrugated iron sheet 28 gauge","m²",5.5],
  ["R03","Material","Clay roof tiles","m²",14],["R04","Material","Concrete roof tiles","m²",10],["R05","Material","Stone-coated steel roof tiles","m²",16],
  ["R06","Material","Torch-on bituminous membrane 4 mm","m²",7.5],["R07","Material","Liquid-applied waterproofing","kg",6],
  ["R08","Material","Ridge and hip capping","m",4],["R09","Material","Roofing screws, washers and sealant","m²",.6],
  ["R10","Material","Treated timber 50 × 150 mm for trusses","m",2.2],["R11","Material","Truss nail-plate connector set","No.",14],
  ["R12","Material","Treated timber purlin 50 × 75 mm","m",1.1],["R13","Material","Treated timber wall plate 100 × 75 mm","m",2],
  ["R14","Subcontract","Structural steel roof trusses, fabricated and primed","t",1900],["R15","Material","Cold-formed steel C-purlin 150 mm","m",6.5],
  ["R16","Material","Foil-backed roof insulation","m²",1.8],["R17","Material","Glass wool insulation 50 mm","m²",3.2],
  ["R18","Material","Rigid PIR insulation board 50 mm","m²",9],["R19","Material","Treated fascia board 25 × 225 mm","m",3.2],
  ["R20","Material","PVC eaves gutter 150 mm with brackets","m",5.5],["R21","Material","Truss hurricane straps and bolts","No.",3],
  ["R22","Material","Roofing underlay felt","m²",1.2],["R23","Material","Treated tile batten 38 × 50 mm","m",.6],
  ["R24","Material","Pre-painted valley gutter, 600 mm girth","m",7.5],["R25","Material","GRP valley trough for tiled roofs","m",9],
  ["R26","Material","Pre-painted verge / barge flashing","m",4],["R27","Material","Dry verge units","m",6],
  ["R28","Material","Pre-painted apron and step flashing","m",4.5],["R29","Material","Flashing sealant and fixings","m",.8],
  ["R30","Material","Box gutter 600 mm girth with outlets","m",22],["R31","Material","Polycarbonate roof light with upstand kerb","m²",45],
  ["R32","Material","Insulated roof access hatch with kerb","No.",180],["R33","Material","Pipe and vent flashing collar","No.",12],
];

function resource([code, category, name, unit, rate, note = ""]: ResourceSeed): Resource {
  return { code, category, name, unit, rate, note };
}

export function ensureResources(
  existing: readonly Resource[],
  seeds: readonly ResourceSeed[],
): Resource[] {
  const output = existing.map((item) => ({ ...item }));
  const codes = new Set(output.map(({ code }) => code));
  for (const seed of seeds) {
    if (!codes.has(seed[0])) {
      output.push(resource(seed));
      codes.add(seed[0]);
    }
  }
  return output;
}

export function raDefaults(): Resource[] { return CORE.map(resource); }
export function finResourcesEnsure(resources: readonly Resource[]): Resource[] { return ensureResources(resources, FINISHES); }
export function mepResourcesEnsure(resources: readonly Resource[]): Resource[] { return ensureResources(resources, MEP); }
export function roofResourcesEnsure(resources: readonly Resource[]): Resource[] { return ensureResources(resources, ROOF.slice(0, 23)); }
export function roofxResourcesEnsure(resources: readonly Resource[]): Resource[] { return ensureResources(resources, ROOF.slice(23)); }

export function allDefaultResources(): Resource[] {
  return roofxResourcesEnsure(roofResourcesEnsure(mepResourcesEnsure(finResourcesEnsure(raDefaults()))));
}

/** Catalog items with no prices. Used so new workspaces stay at zero until the user types rates. */
export function blankResources(): Resource[] {
  return allDefaultResources().map((row) => ({ ...row, rate: 0 }));
}

export const DEFAULT_MATERIAL_FACTORS: Readonly<MaterialFactors> = {
  readymix: false, concWaste: 5, steelWaste: 5, stock: 12, wire: 10,
  meshLap: 15, meshWaste: 5, uses: 4, fwWaste: 10, timber: 3.5,
  nails: .2, compact: 1.3, att: 5, aggWaste: 5, asWaste: 3,
  prime: 1, tack: .35, bitWaste: 5, pipeLen: 1, paint: .5,
};
