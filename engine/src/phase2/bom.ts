import { n } from "../expression.js";
import { DIAMETERS, kgPerM } from "../helpers.js";
import { analyse, currencyFactor, resourceByCode } from "./pricing.js";
import { DEFAULT_MATERIAL_FACTORS } from "./resources.js";
import type {
  BomContext,
  BomItemRow,
  BomRow,
  ConcreteMix,
  MaterialFactors,
  Resource,
} from "./pricing-types.js";

const INTEGER_UNITS = new Set(["No.","bags","sheets","rolls"]);
const CONCRETE_CODES = new Set([
  "BLD","CBED","CPAD","CSTUB","CSTRIP","CGB","CSOG","CBFT","CAPR","CDRN",
  "CHW","CAPPR","CCOL","CBEAM","CSLAB","CWALL","CSTAIR","CPIER","CXHEAD",
  "CABW","CWING","CBALL","CGIRD","CDIAPH","CDECK","CPARA","CLINT",
]);
const ANALYSED_MATERIAL_CODES =
  /^(MAS|BFORCE$|DPC\d|PLI|PLE|SKIM|PNTI|PNTX|WTILE_|CLAD_|SCR\d|PFLOAT$|FF_|SK_|CPL\d|CPNT|CSUS_|EL_|EG_|SF_|PPRC|PPRH|WST\d|PL_|RF)/;
const DEFAULT_MIXES: Readonly<Record<number, ConcreteMix>> = {
  15:{cem:230,sand:.50,agg:.90},20:{cem:290,sand:.47,agg:.88},
  25:{cem:340,sand:.44,agg:.85},30:{cem:380,sand:.42,agg:.82},
  35:{cem:420,sand:.40,agg:.80},40:{cem:460,sand:.38,agg:.78},
};

function mergedFactors(context: BomContext): MaterialFactors {
  return { ...DEFAULT_MATERIAL_FACTORS, ...context.factors };
}
function gradeOf(code: string, context: BomContext): string {
  const grade = context.project.grades;
  if (code === "BLD" || code === "CBED") return grade.blind;
  if (["CPAD","CSTUB","CSTRIP","CGB","CSOG","CBFT","CAPPR"].includes(code)) return grade.found;
  if (["CCOL","CBEAM","CSLAB","CWALL","CSTAIR","CLINT"].includes(code)) return grade.frame;
  if (["CDRN","CHW","CAPR"].includes(code)) return grade.civil;
  return grade.bridge;
}
function mixFor(grade: string, context: BomContext): ConcreteMix {
  const strength = Number(/C\s*(\d+)/i.exec(grade)?.[1] ?? 25);
  const mixes = context.mixes ?? DEFAULT_MIXES;
  const keys = Object.keys(mixes).map(Number).sort((a,b)=>a-b);
  let selected = keys[0] ?? 25;
  for (const key of keys) if (key <= strength) selected = key;
  return mixes[selected] ?? DEFAULT_MIXES[25]!;
}
function resourcePrice(resource: Resource | undefined, context: BomContext): number | undefined {
  return resource ? resource.rate * currencyFactor(context) : undefined;
}

export function bomResourcePrice(code: string, context: BomContext): number | undefined {
  const resources = resourceByCode(context.resources);
  const p = (resourceCode: string): number | undefined => resourcePrice(resources.get(resourceCode),context);
  if (code.startsWith("RES-")) return p(code.slice(4));
  const map: Readonly<Record<string, number | undefined>> = {
    CEM:p("M01"),SAND:p("M02"),AGG:p("M03"),WATER:p("M04"),WIRE:p("M08"),
    MESHS:(p(context.project.btype==="road"?"M38":"M13")??0)*11.52,
    PLY:p("M09"),TIMB:p("M10"),NAILS:p("M11"),REL:p("M12"),HC:p("M15"),
    SANDB:p("M02"),DPMR:(p("M14")??0)*100,ATTL:p("M16"),BORR:p("M17"),
    BFGRM:p("M35"),CRS:p("M18"),GRV:p("M17"),CAPM:p("M17"),
    ACWM:p("M19"),ACBM:p("M45"),MC30:p("M20"),K160:p("M21"),
    SDSB:p("M37"),CHIP:p("M22"),KERBU:p("M24"),PAINT:p("M25"),
    SIGNS:p("M26"),GRAILM:p("M27"),STUDS:p("M28"),KMPM:p("M29"),
    BRGM:p("M30"),EJM:p("M31"),WPFM:p("M32"),SURFM:p("M19"),
    SPOUTM:p("M34"),HRAILM:p("M33"),
  };
  if (code in map) return map[code];
  if (/^BAR\d+$/.test(code)) return p(Number(code.slice(3)) < 10 ? "M07" : "M06");
  if (code.startsWith("RMX-")) return p("M05");
  if (/^PIPEU\d+$/.test(code)) {
    const diameter=Number(code.slice(5));
    const choices:[[number,string],[number,string],[number,string],[number,string],[number,string]]=[[450,"M39"],[600,"M40"],[750,"M41"],[900,"M42"],[1200,"M43"]];
    const selected=choices.reduce((best,next)=>Math.abs(next[0]-diameter)<Math.abs(best[0]-diameter)?next:best);
    return (p(selected[1])??0)*mergedFactors(context).pipeLen||undefined;
  }
  return undefined;
}

export function bomRows(context: BomContext): BomRow[] {
  const output: BomRow[] = [];
  const factors = mergedFactors(context);
  const totals = context.result.tot;
  let pendingSection = "";
  const section = (title: string): void => { pendingSection = title; };
  const row = (
    code: string, material: string, specification: string, unit: string,
    net: number, waste: number,
  ): void => {
    if (!(net > .0005)) return;
    if (pendingSection) { output.push({ sec: pendingSection }); pendingSection = ""; }
    const integer = INTEGER_UNITS.has(unit);
    let order = net * (1 + waste / 100);
    if (integer) order = Math.ceil(order - 1e-9);
    const manualRate = context.manualMaterialRates?.[code];
    const rate = manualRate ?? bomResourcePrice(code,context);
    output.push({
      code, material, specification, unit, net, waste, order,
      displayDecimals: integer ? 1 : unit === "t" ? 3 : 2,
      orderDecimals: integer ? 0 : unit === "t" ? 3 : 2,
      rate, manualRate, amount: rate ? order * rate : 0,
    });
  };

  section("Concrete");
  const volumes: Record<string,number> = {};
  for (const item of context.result.items) {
    if (!CONCRETE_CODES.has(item.code)) continue;
    const grade = gradeOf(item.code,context);
    volumes[grade] = (volumes[grade] ?? 0) + item.q;
  }
  const grades = Object.keys(volumes).filter((grade)=>(volumes[grade]??0)>.0005);
  if (factors.readymix) {
    for (const grade of grades) row(`RMX-${grade}`,`Ready-mix concrete ${grade}`,"Delivered to site, pumping priced separately","m³",volumes[grade]!,factors.concWaste);
  } else {
    let cement=0,sand=0,aggregate=0,water=0;
    for (const grade of grades) {
      const volume=volumes[grade]!,mix=mixFor(grade,context);
      cement+=volume*mix.cem;sand+=volume*mix.sand;aggregate+=volume*mix.agg;water+=volume*.18;
    }
    const split=grades.map((grade)=>`${grade} ${volumes[grade]!.toFixed(1)} m³`).join(" · ");
    row("CEM","Cement CEM I 42.5N",`50 kg bags for ${split}`,"bags",cement/50,factors.concWaste);
    row("SAND","River sand","Fine aggregate for concrete","m³",sand,factors.concWaste);
    row("AGG","Crushed aggregate 20 mm","Coarse aggregate for concrete","m³",aggregate,factors.concWaste);
    row("WATER","Water","Mixing and curing, 180 l/m³","m³",water,0);
  }

  section("Reinforcement");
  for (const diameter of DIAMETERS) {
    const kg=context.result.bars.filter((bar)=>bar.dia===diameter).reduce((sum,bar)=>sum+bar.kg,0);
    if (!kg) continue;
    const stock=factors.stock||12;
    const lengths=Math.ceil(kg*(1+factors.steelWaste/100)/(stock*kgPerM(diameter)));
    row(`BAR${diameter}`,`${diameter>=10?"High yield":"Mild steel"} bar ${diameter} mm`,`About ${lengths} No. ${stock.toFixed(0)} m lengths`,"t",kg/1000,factors.steelWaste);
  }
  row("WIRE","Binding wire",`16 SWG annealed, ${factors.wire} kg per tonne`,"kg",context.result.steelKg/1000*factors.wire,0);
  const mesh=(totals.MESH??0)+(totals.MESHD??0);
  row("MESHS","Steel fabric mesh",`${context.project.btype==="road"?"A142":context.project.sog?.mesh ?? "A193"} sheets 4.8 × 2.4 m with ${factors.meshLap}% laps`,"sheets",mesh*(1+factors.meshLap/100)/11.52,factors.meshWaste);

  section("Formwork");
  const formwork=context.result.formwork,uses=Math.max(1,factors.uses);
  row("PLY","Plywood 18 mm shuttering",`1.22 × 2.44 m sheets, ${uses} uses`,"sheets",formwork/2.9768/uses,factors.fwWaste);
  row("TIMB","Sawn timber 50 × 100 mm",`${factors.timber} m per m² of formwork, ${uses} uses`,"m",formwork*factors.timber/uses,factors.fwWaste);
  row("NAILS","Wire nails, assorted",`${factors.nails} kg per m²`,"kg",formwork*factors.nails,0);
  row("REL","Mould release agent","0.1 l per m²","l",formwork*.1,factors.fwWaste);

  section("Fill, membranes and treatment");
  row("HC","Hardcore",`Loose volume at compaction factor ${factors.compact}`,"m³",(totals.HARD??0)*factors.compact,0);
  row("SANDB","Blinding sand",`${n(context.project.sog?.sand ?? 50)} mm thick, loose`,"m³",(totals.SAND??0)*n(context.project.sog?.sand ?? 50)/1000*1.25,0);
  row("DPMR","Polythene membrane 1000 gauge","100 m² rolls, 15% laps","rolls",(totals.DPM??0)*1.15/100,0);
  row("ATTL","Anti-termite chemical",`Diluted, ${factors.att} l per m²`,"l",(totals.ATT??0)*factors.att,0);
  row("BORR","Imported fill",`Loose volume at factor ${factors.compact}`,"m³",(totals.RBORROW??0)*factors.compact,0);
  row("BFGRM","Granular backfill to abutments",`Loose volume at factor ${factors.compact}`,"m³",(totals.BFGR??0)*factors.compact,0);

  const sumCodes = (pattern: RegExp): number => Object.entries(totals)
    .filter(([code]) => pattern.test(code))
    .reduce((sum,[,quantity]) => sum+quantity,0);
  section("Pavement materials");
  row("CRS","Graded crushed stone","Base course, loose factor 1.30","m³",sumCodes(/^BASE/)*1.3,factors.aggWaste);
  row("GRV","Natural gravel","Subbase, loose factor 1.25","m³",sumCodes(/^SUBB/)*1.25,factors.aggWaste);
  row("CAPM","Selected gravel","Improved subgrade, loose factor 1.25","m³",sumCodes(/^CAP\d/)*1.25,factors.aggWaste);
  let asphaltWearing=0,asphaltBinder=0;
  for(const item of context.result.items){
    const type=context.recipeTypes?.rpave?.find((value)=>value.id===item.tid);
    if(!type)continue;
    if(/^ACW/.test(item.code))asphaltWearing+=item.q*n(type.acw)/1000*n(type.dens);
    if(/^ACB/.test(item.code))asphaltBinder+=item.q*n(type.acb)/1000*n(type.dens);
  }
  row("ACWM","Asphalt concrete wearing course","Hot mix, at section density","t",asphaltWearing,factors.asWaste);
  row("ACBM","Dense bitumen macadam","Binder course, hot mix","t",asphaltBinder,factors.asWaste);
  row("MC30","Cutback bitumen MC-30",`Prime coat, ${factors.prime} l/m²`,"l",(totals.PRIME??0)*factors.prime,factors.bitWaste);
  row("K160","Bitumen emulsion K1-60",`Tack coat, ${factors.tack} l/m²`,"l",(totals.TACK??0)*factors.tack,factors.bitWaste);
  row("SDSB","Penetration bitumen 80/100","Surface dressing, 1.8 l/m² for two coats","l",(totals.SDS??0)*1.8,factors.bitWaste);
  row("CHIP","Chippings 14 mm and 10 mm","Surface dressing, 0.018 m³/m²","m³",(totals.SDS??0)*.018,factors.aggWaste);

  section("Drainage, furniture and bridge items");
  for(const diameter of new Set(context.recipeTypes?.rculv?.map((type)=>String(type.dia))??[])){
    row(`PIPEU${diameter}`,`Precast concrete pipe ${diameter} mm`,`${factors.pipeLen.toFixed(1)} m units, spigot and socket`,"No.",(totals[`PIPE${diameter}`]??0)/Math.max(factors.pipeLen,.1),2);
  }
  row("KERBU","Precast concrete kerbs","1.0 m units","No.",totals.KERB??0,3);
  row("PAINT","Thermoplastic road marking",`${factors.paint} kg per m of 100 mm line`,"kg",(totals.RMARK??0)*factors.paint,5);
  row("SIGNS","Road signs with posts","To sign schedule","No.",totals.RSIGN??0,0);
  row("GRAILM","W-beam guardrail","With posts and fixings","m",totals.GRAIL??0,2);
  row("STUDS","Road studs","Reflective, bi-directional","No.",totals.RSTUD??0,2);
  row("KMPM","Kilometre posts","Precast concrete","No.",totals.KMP??0,0);
  row("BRGM","Elastomeric bearings","To bearing schedule","No.",totals.BRG??0,0);
  row("EJM","Expansion joint system","Proprietary, full carriageway width","m",totals.EJ??0,0);
  row("WPFM","Deck waterproofing membrane","Including 10% laps","m²",(totals.WPF??0)*1.1,0);
  const surfacingThickness=n(context.project.bacc?.surfT??50);
  row("SURFM","Asphalt deck surfacing",`${surfacingThickness} mm at 2.35 t/m³`,"t",(totals.SURF??0)*surfacingThickness/1000*2.35,factors.asWaste);
  row("SPOUTM","Deck drainage spouts","uPVC or cast iron","No.",totals.SPOUT??0,0);
  row("HRAILM","Galvanised steel handrail","With posts","m",totals.HRAIL??0,2);

  const aggregated = new Map<string,{resource:Resource;quantity:number;families:Set<string>}>();
  for (const [code,quantity] of Object.entries(totals)) {
    if (!(quantity>.0005) || !ANALYSED_MATERIAL_CODES.test(code)) continue;
    const analysis=analyse(code,context);
    const multiplier=/^RF(STEEL|STS)_/.test(code)?quantity/1000:quantity;
    for (const line of analysis.rows) {
      if (!line.resource || !["Material","Subcontract"].includes(line.resource.category)) continue;
      const current=aggregated.get(line.resourceCode)??{resource:line.resource,quantity:0,families:new Set<string>()};
      current.quantity+=line.quantity*multiplier;current.families.add(analysis.family);aggregated.set(line.resourceCode,current);
    }
  }
  if (aggregated.size) section("Masonry, finishes, services and roofing");
  for (const [code,value] of [...aggregated].sort(([a],[b])=>a.localeCompare(b))) {
    row(`RES-${code}`,value.resource.name,`From ${[...value.families].join(", ").toLowerCase()} build-ups (waste included)`,value.resource.unit==="bag"?"bags":value.resource.unit,value.quantity,0);
  }
  return output;
}

export function bomTotal(rows: readonly BomRow[]): number {
  return rows.reduce((sum,row)=>sum+("code" in row?(row as BomItemRow).amount:0),0);
}
