import { n } from "../expression.js";
import { DEFAULT_MATERIAL_FACTORS } from "./resources.js";
import type {
  CategoryTotals,
  ConcreteMix,
  MaterialFactors,
  PricingContext,
  RateAnalysis,
  Recipe,
  RecipeLine,
  Resource,
  ResourceCategory,
  RoofType,
} from "./pricing-types.js";

const CONCRETE_FACTORS: Readonly<Record<string, number>> = {
  BLD:.6,CBED:.7,CPAD:1,CSTUB:1.2,CSTRIP:1,CGB:1.1,CSOG:.9,CBFT:1,
  CAPR:.9,CDRN:1,CHW:1.3,CAPPR:1,CCOL:1.5,CBEAM:1.3,CSLAB:1.1,
  CWALL:1.4,CSTAIR:1.7,CPIER:1.6,CXHEAD:1.6,CABW:1.4,CWING:1.4,
  CBALL:1.5,CGIRD:1.6,CDIAPH:1.6,CDECK:1.2,CPARA:1.8,CLINT:1.5,
};
const FORMWORK_FACTORS: Readonly<Record<string, number>> = {
  FPAD:.8,FSTUB:.9,FSTRIP:.8,FGB:.85,FSOGE:.7,FBFT:.8,FAPPRE:.7,FHW:1,
  FCOL:1.1,FBSID:1.1,FBSOF:1.3,FSLABE:.9,FWALL:1.1,FSTSOF:1.4,
  FSTSTR:1.3,FSTRIS:.35,FPIER:1.5,FXHEAD:1.5,FABW:1.2,FWING:1.2,
  FBALL:1.3,FGIRD:1.5,FDIAPH:1.5,FDECK:1.2,FDECKE:1,FPARA:1.6,FLINT:1.2,
};
const PROPPING_WEEKS: Readonly<Record<string, number>> = {
  FBSOF:2,FSTSOF:2,FGIRD:4,FDIAPH:4,FDECK:4,FXHEAD:3,
};
const BRIDGE_CODES = new Set([
  "CPIER","CXHEAD","CABW","CWING","CBALL","CGIRD","CDIAPH","CDECK","CPARA",
  "FPIER","FXHEAD","FABW","FWING","FBALL","FGIRD","FDIAPH","FDECK","FDECKE","FPARA",
]);
const BRIDGE_REBAR_GROUPS = new Set(["BFND","PIER","ABUT","DECK","PARA"]);
const DEFAULT_MIXES: Readonly<Record<number, ConcreteMix>> = {
  15:{cem:230,sand:.50,agg:.90},20:{cem:290,sand:.47,agg:.88},
  25:{cem:340,sand:.44,agg:.85},30:{cem:380,sand:.42,agg:.82},
  35:{cem:420,sand:.40,agg:.80},40:{cem:460,sand:.38,agg:.78},
};

function factors(context: PricingContext): MaterialFactors {
  return { ...DEFAULT_MATERIAL_FACTORS, ...context.factors };
}
function round5(value: number): number { return Math.round(value * 100_000) / 100_000; }
function cleanMark(value: string): string { return value.replace(/[^A-Za-z0-9]/g, "") || "X"; }
function result(family: string, lines: RecipeLine[], note = ""): Recipe {
  return { family, lines, note };
}
function builder(): { lines: RecipeLine[]; add: (resourceCode: string, quantity: number, note?: string) => void } {
  const lines: RecipeLine[] = [];
  return {
    lines,
    add(resourceCode, quantity, note = "") {
      if (quantity > 0) lines.push({ resourceCode, quantity: round5(quantity), note });
    },
  };
}
function gradeOf(code: string, context: PricingContext): string {
  const grade = context.project.grades;
  if (code === "BLD" || code === "CBED") return grade.blind;
  if (["CPAD","CSTUB","CSTRIP","CGB","CSOG","CBFT","CAPPR"].includes(code)) return grade.found;
  if (["CCOL","CBEAM","CSLAB","CWALL","CSTAIR","CLINT"].includes(code)) return grade.frame;
  if (["CDRN","CHW","CAPR"].includes(code)) return grade.civil;
  return grade.bridge;
}
function mixFor(grade: string, context: PricingContext): ConcreteMix {
  const strength = Number(/C\s*(\d+)/i.exec(grade)?.[1] ?? 25);
  const mixes = context.mixes ?? DEFAULT_MIXES;
  const keys = Object.keys(mixes).map(Number).sort((a, b) => a - b);
  let selected = keys[0] ?? 25;
  for (const key of keys) if (key <= strength) selected = key;
  return mixes[selected] ?? DEFAULT_MIXES[25]!;
}
function roofByMark(context: PricingContext, mark: string): RoofType | undefined {
  return context.recipeTypes?.roof?.find((type) => cleanMark(type.mark) === mark);
}

export function finRecipe(code: string, context: PricingContext): Recipe | null {
  const { lines, add } = builder();
  const mortar = (volume: number, ratio: string, note = ""): void => {
    const r = Number(ratio.split(":")[1]) || 4;
    add("M01", volume * 1.3 / (1 + r) * 1440 / 50, note || `Mortar 1:${r}`);
    add("M02", volume * 1.3 * r / (1 + r)); add("M04", volume * .3);
  };
  let match = /^MAS(HB|SB|BR|ST)(\d+)([EI])$/.exec(code);
  if (match) {
    const kind = match[1]!, thickness = Number(match[2]), position = match[3];
    const keys = { "Hollow concrete block":"HB", "Solid concrete block":"SB", "Burnt clay brick":"BR", "Stone":"ST" } as const;
    const type = context.recipeTypes?.masonry?.find((item) => keys[item.mat] === kind && n(item.t) === thickness);
    const unitLength = n(type?.uL ?? (kind === "BR" ? 230 : 400)) / 1000;
    const unitHeight = n(type?.uH ?? (kind === "BR" ? 75 : 200)) / 1000;
    const joint = n(type?.joint ?? 10) / 1000;
    const per = 1 / ((unitLength + joint) * (unitHeight + joint));
    const resource = kind === "BR" ? "M51" : kind === "ST" ? "M52"
      : kind === "SB" ? (thickness <= 120 ? "M49" : "M50")
      : thickness <= 120 ? "M46" : thickness <= 175 ? "M47" : "M48";
    add(resource, per * 1.05, `${per.toFixed(1)} units per m² + 5% breakage`);
    const solidFraction = unitLength * unitHeight / ((unitLength + joint) * (unitHeight + joint));
    const volume = thickness / 1000 * (1 - solidFraction) * (kind === "HB" ? .75 : 1) * 1.15;
    mortar(volume, type?.mortar ?? "1:4", `Mortar ${type?.mortar ?? "1:4"}, ${(volume * 1000).toFixed(1)} l per m²`);
    const mason = (kind === "BR" ? 1.1 : kind === "ST" ? 1 : .55) + thickness / 1000 * (kind === "BR" ? 2.5 : 1.6);
    add("L01", mason * (position === "E" ? 1.1 : 1)); add("L03", mason * .8);
    if (position === "E") add("P19", 1, "External scaffold, 1 week");
    return result("Masonry", lines, `About ${(1 / mason).toFixed(1)} m² laid per mason-hour`);
  }
  if (code === "BFORCE") { add("M53",1.05); add("L01",.02); return result("Masonry",lines); }
  match = /^DPC(\d+)$/.exec(code);
  if (match) { add("M54",Number(match[1]) / 225 * 1.05,"Cut to wall width, 5% laps"); add("M01",.01); add("L03",.05); return result("Masonry",lines); }
  match = /^(PLI|PLE|CPL)(\d+)$/.exec(code);
  if (match) {
    const thickness = Number(match[2]), external = match[1] === "PLE", ceiling = match[1] === "CPL";
    mortar(thickness / 1000 * 1.2,"1:4");
    const labour = (.3 + thickness * .006) * (external ? 1.25 : 1) * (ceiling ? 1.35 : 1);
    add("L01",labour); add("L03",labour * .7); if (external || ceiling) add("P19",external ? 1 : .5);
    return result(ceiling ? "Ceiling finishes" : "Wall finishes",lines,`About ${(1 / labour).toFixed(1)} m² per plasterer-hour`);
  }
  match = /^SKIM(\d+)$/.exec(code);
  if (match) { add("M55",Number(match[1]) * 1.1,"About 1.1 kg per m² per mm"); add("M04",.005); add("L01",.2); add("L03",.1); return result("Wall finishes",lines); }
  match = /^(PNTI|PNTX|CPNT)(\d+)$/.exec(code);
  if (match) {
    const coats = Number(match[2]), external = match[1] === "PNTX", ceiling = match[1] === "CPNT";
    add(external ? "M58" : "M56",(external ? .15 : .11) * (coats + (external ? 0 : .5)) * 1.05);
    add("L02",.07 * coats * (ceiling ? 1.3 : 1) * (external ? 1.2 : 1)); add("L03",.02 * coats);
    if (external) add("P19",.5); return result(ceiling ? "Ceiling finishes" : "Wall finishes",lines);
  }
  if (/^WTILE_/.test(code)) { add("M59",1.08); add("M60",4.5); add("M61",.3); add("L01",.8); add("L03",.4); return result("Wall finishes",lines); }
  if (/^CLAD_/.test(code)) { add("M62",1.08); add("M60",6); add("M01",.05); add("L01",1.2); add("L03",.6); add("P19",1); return result("Wall finishes",lines); }
  match = /^SCR(\d+)$/.exec(code);
  if (match) { const t=Number(match[1]); mortar(t/1000*1.15,"1:3"); add("L01",.12+t*.002); add("L03",.2+t*.004); return result("Floor finishes",lines); }
  if (code === "PFLOAT") { add("L02",.15); add("P21",.04); return result("Floor finishes",lines); }
  if (/^FF_/.test(code)) {
    const type = context.recipeTypes?.ffin?.find((item) => cleanMark(item.mark) === code.slice(3));
    switch (type?.fin ?? "Ceramic tiles") {
      case "Porcelain tiles": add("M64",1.08); add("M60",5); add("M61",.3); add("L01",.85); add("L03",.4); break;
      case "Ceramic tiles": add("M63",1.08); add("M60",4.5); add("M61",.3); add("L01",.7); add("L03",.35); break;
      case "Terrazzo": add("M65",1.05); add("M01",.4); add("M02",.01); add("L01",1.2); add("L03",1); add("P20",.25); break;
      case "Timber flooring": add("M66",1.08); add("M10",2.8,"Battens"); add("M11",.1); add("L01",.9); add("L03",.3); break;
      case "Vinyl sheet": add("M67",1.1); add("M68",3); add("L01",.3); add("L03",.1); break;
      case "Epoxy coating": add("M69",.6); add("L02",.25); add("L03",.1); break;
      case "Carpet tiles": add("M70",1.05); add("L01",.2); break;
      case "Power-floated concrete": add("L02",.15); add("P21",.04); break;
    }
    return result("Floor finishes",lines);
  }
  if (/^SK_/.test(code)) {
    const type = context.recipeTypes?.ffin?.find((item) => cleanMark(item.mark) === code.slice(3));
    const height = n(type?.skh ?? 100) / 1000;
    if (type?.skm === "Timber") { add("M71",1.05); add("M11",.02); add("L01",.12); }
    else if (type?.skm === "PVC") { add("M72",1.05); add("L01",.08); }
    else { add(type?.fin === "Porcelain tiles" ? "M64" : "M63",height*1.15); add("M60",height*5); add("M61",height*.4); add("L01",.15); add("L03",.05); }
    return result("Floor finishes",lines);
  }
  if (/^CSUS_/.test(code)) {
    const type = context.recipeTypes?.cfin?.find((item) => cleanMark(item.mark) === code.slice(5));
    switch (type?.kind ?? "Gypsum board suspended ceiling") {
      case "Gypsum board suspended ceiling": add("M73",1.08); add("M74",1); add("M75",1); add("L01",.6); add("L03",.3); add("P19",.5); break;
      case "Mineral fibre tile suspended ceiling": add("M76",1.05); add("M74",1); add("L01",.4); add("L03",.2); add("P19",.5); break;
      case "PVC ceiling panels": add("M77",1.08); add("M10",3); add("L01",.35); add("L03",.15); break;
      case "T&G timber ceiling": add("M78",1.1); add("M10",3); add("M11",.1); add("L01",.8); add("L03",.3); break;
      default: add("M73",1.08); add("L01",.6);
    }
    return result("Ceiling finishes",lines);
  }
  return null;
}

const ELECTRICAL_POINTS: Readonly<Record<string, readonly [string, number]>> = {
  "Lighting point – LED panel":["E01",.9],"Lighting point – downlight":["E02",.7],
  "Lighting point – batten":["E03",.7],"Lighting point – exterior":["E04",.9],
  "Emergency light":["E05",1],"Switch – one gang":["E06",.5],"Switch – two gang":["E07",.6],
  "Socket outlet – twin 13 A":["E08",.7],"Power outlet – 20 A (AC or cooker)":["E09",.9],
  "Data outlet Cat6":["E10",.6],"TV outlet":["E11",.5],"Smoke detector":["E12",.6],"Manual call point":["E13",.6],
};
const CABLES: Readonly<Record<string,string>> = {"1.5 mm² twin & earth":"E20","2.5 mm² twin & earth":"E21","4 mm² twin & earth":"E22","6 mm² twin & earth":"E23","Cat6 data":"E24","Coaxial":"E25","Fire-resistant 1.5 mm²":"E26"};
const CONDUITS: Readonly<Record<string,string>> = {"20 mm PVC conduit":"E30","25 mm PVC conduit":"E31","Surface trunking":"E32"};
const GEAR: Readonly<Record<string,readonly [string,number]>> = {"Distribution board":["E40",8],"Main switchboard":["E41",24],"Sub-main cable":["E42",.25],"Cable tray":["E43",.3],"Earthing system":["E44",16],"Lightning protection":["E45",40],"Changeover switch":["E46",6],"Energy meter":["E47",2]};
const FITTINGS: Readonly<Record<string,readonly [string,number,boolean]>> = {"WC suite":["S01",3.5,false],"Wash hand basin":["S02",2.5,true],"Urinal":["S03",3,true],"Shower":["S04",4,true],"Kitchen sink":["S05",3,true],"Bath":["S06",5,true],"Floor drain":["S07",1,false]};
const PLUMBING: Readonly<Record<string,"pipe"|readonly [string,number]>> = {"Cold water riser":"pipe","Hot water riser":"pipe","Soil and vent stack":["S33",.5],"Rainwater downpipe":["S47",.35],"Underground drain pipe":["S46",.6],"Water storage tank":["S40",8],"Booster pump set":["S41",16],"Water heater":["S42",4],"Inspection chamber":["S43",10],"Septic tank":["S44",40],"Soakaway":["S45",24],"Fire hose reel":["S48",6],"Gate valve":["S49",1]};

export function mepRecipe(code: string, context: PricingContext): Recipe | null {
  const { lines, add } = builder();
  if (code.startsWith("EL_")) {
    const type=context.recipeTypes?.elec?.find((item)=>cleanMark(item.mark)===code.slice(3)); if (!type) return null;
    const point=ELECTRICAL_POINTS[type.cat]??["E08",.7], run=n(type.run);
    add(point[0],1,"Device"); add("E33",1); const cable=CABLES[type.cable], conduit=CONDUITS[type.conduit];
    if (cable) add(cable,run*1.1); if (conduit) add(conduit,run*1.05);
    add("L07",point[1]+run*.05); add("L03",.2+run*.02); return result("Electrical installation",lines);
  }
  if (code.startsWith("EG_")) {
    const type=context.recipeTypes?.elecgear?.find((item)=>cleanMark(item.mark)===code.slice(3)); if (!type) return null; const gear=GEAR[type.item]??["E40",8];
    add(gear[0],type.unit==="m"?1.05:1); add("L07",gear[1]); add("L03",gear[1]*.5); if(type.item==="Cable tray")add("M10",.5);
    return result("Electrical installation",lines);
  }
  if (code.startsWith("SF_")) {
    const type=context.recipeTypes?.sanit?.find((item)=>cleanMark(item.mark)===code.slice(3)); if (!type) return null; const fitting=FITTINGS[type.fx]??["S02",2.5,true];
    add(fitting[0],1); if(fitting[2])add("S10",1); const supplies=(type.cold?1:0)+(type.hot?1:0);
    add("S11",supplies); add("S12",supplies); add("L08",fitting[1]); add("L03",1); return result("Plumbing installation",lines);
  }
  let match=/^PPR([CH])(\d+)$/.exec(code);
  if(match){const d=Number(match[2]);add(d<=20?"S20":d<=25?"S21":d<=32?"S22":"S23",1.05);add("S25",1);add("S36",1);add("L08",.3*(match[1]==="H"?1.1:1));add("L03",.1);return result("Plumbing installation",lines);}
  match=/^WST(\d+)$/.exec(code);
  if(match){const d=Number(match[1]);add(d<=32?"S30":d<=40?"S31":d<=50?"S32":"S33",1.05);add("S35",1);add("S36",1);add("L08",d>=110?.5:.35);add("L03",.1);return result("Plumbing installation",lines);}
  if(code.startsWith("PL_")){
    const type=context.recipeTypes?.plumb?.find((item)=>cleanMark(item.mark)===code.slice(3));if(!type)return null;const item=PLUMBING[type.item];
    if(item==="pipe"){const d=Number(/\d+/.exec(type.size)?.[0]??50);add(d<=20?"S20":d<=25?"S21":d<=32?"S22":"S23",1.05);add("S25",1.2);add("S36",1);add("L08",.45);add("L03",.2);}
    else if(item){add(item[0],type.unit==="m"?1.05:1);add("L08",item[1]);add("L03",item[1]*.6);if(type.unit==="m")add("S36",1);if(type.item==="Underground drain pipe"){add("P02",.02);add("L05",.02);add("M02",.08);}}
    return result("Plumbing installation",lines);
  }
  return null;
}

const ROOF_COVERS: Readonly<Record<string,readonly [string,number,"sheet"|"tile"|"flat"]>> = {
  "Pre-painted IT4 iron sheets":["R01",1.12,"sheet"],"Galvanised corrugated iron sheets":["R02",1.15,"sheet"],
  "Stone-coated steel tiles":["R05",1.1,"tile"],"Clay roof tiles":["R03",1.05,"tile"],
  "Concrete roof tiles":["R04",1.05,"tile"],"Torch-on bituminous membrane":["R06",1.15,"flat"],
  "Liquid-applied waterproofing":["R07",1.8,"flat"],
};
const ROOF_INSULATION: Readonly<Record<string,string>> = {"Foil-backed insulation":"R16","Glass wool 50 mm":"R17","Rigid PIR board 50 mm":"R18"};

export function roofRecipe(code: string, context: PricingContext): Recipe | null {
  const {lines,add}=builder(); const done=(note="")=>result("Roofing",lines,note); let match=/^RFCOV_(.+)$/.exec(code);
  if(match){const type=roofByMark(context,match[1]!);if(!type)return null;const cover=ROOF_COVERS[type.cover]??["R01",1.12,"sheet"];
    add(cover[0],cover[1]);if(cover[2]==="sheet"){add("R09",1);add("L01",.18);add("L03",.12);}else{add("R22",1.1);add("R23",1/Math.max(.25,n(type.ps)/1000)*1.05);add("R09",.5);add("L01",cover[0]==="R05"?.35:.6);add("L03",cover[0]==="R05"?.2:.4);}add("P19",.3);return done();}
  match=/^RFRIDGE_(.+)$/.exec(code);if(match){const type=roofByMark(context,match[1]!);const tile=ROOF_COVERS[type?.cover??""]?.[2]==="tile";if(tile){add(type?.cover.includes("Concrete")?"R04":"R03",.4);add("M01",.05);add("M02",.004);add("L01",.25);}else{add("R08",1.05);add("R09",.2);add("L01",.15);}return done();}
  match=/^RFTRUSS_.+_S(\d+)$/.exec(code);if(match){const span=Number(match[1])/10;add("R10",(span*3.4+2)*1.05);add("R11",1);add("R21",2);add("L01",3+span*.4);add("L03",(3+span*.4)*.6);return done();}
  if(/^RFSTEEL_/.test(code)||/^RFSTS_/.test(code)){add("R14",1.03);add("L01",60);add("L03",40);add("P13",4);return done();}
  match=/^RFPURL_(.+)$/.exec(code);if(match){const type=roofByMark(context,match[1]!);if(!type)return null;if(type.struct==="Steel trusses"){add("R15",1.05);add("R21",.3);add("L01",.12);add("L03",.06);}else if(ROOF_COVERS[type.cover]?.[2]==="tile"){add("R23",1.05);add("M11",.01);add("L01",.03);}else{add("R12",1.05);add("M11",.02);add("L01",.08);add("L03",.04);}return done();}
  if(code==="RFPLATE"){add("R13",1.05);add("R21",.8);add("M01",.03);add("L01",.15);add("L03",.1);return done();}
  match=/^RFINS_(.+)$/.exec(code);if(match){const type=roofByMark(context,match[1]!);const resource=ROOF_INSULATION[type?.ins??""]??"R16";add(resource,resource==="R16"?1.1:1.05);add("L01",.08);add("L03",.04);return done();}
  if(code==="RFFASC"){add("R19",1.05);add("M11",.02);add("M56",.15);add("L01",.25);add("L02",.08);return done();}
  if(code==="RFGUT"){add("R20",1.05);add("L08",.25);add("L03",.1);return done();}
  match=/^RFSCR(\d+)$/.exec(code);if(match){const t=Number(match[1]),v=t/1000*1.15;add("M01",v*1.3/4*1440/50);add("M02",v*1.3*3/4);add("M04",v*.3);add("L01",.15+t*.002);add("L03",.25+t*.004);return done();}
  match=/^RFMEM_(.+)$/.exec(code);if(match){const type=roofByMark(context,match[1]!);if(type?.cover==="Liquid-applied waterproofing"){add("R07",1.8);add("L02",.2);add("L03",.05);}else{add("R06",1.15);add("M20",.25);add("L02",.25);add("L03",.1);}return done();}
  return null;
}

export function roofxRecipe(code: string, context: PricingContext): Recipe | null {
  const {lines,add}=builder(),done=()=>result("Roofing",lines);let match=/^RFVAL_(.+)$/.exec(code);
  if(match){const type=roofByMark(context,match[1]!);const cover=ROOF_COVERS[type?.cover??""]??["R01",1.12,"sheet"];if(cover[2]==="tile"){add("R25",1.05);add(cover[0],.3);add("L01",.55);}else{add("R24",1.1);add(cover[0],.25);add("R09",.5);add("L01",.35);}add("L03",.15);return done();}
  match=/^RFVERGE_(.+)$/.exec(code);if(match){const type=roofByMark(context,match[1]!);if(ROOF_COVERS[type?.cover??""]?.[2]==="tile"){add("R27",1.02);add("L01",.2);}else{add("R26",1.1);add("R09",.2);add("L01",.15);}return done();}
  if(code==="RFABUT"){add("R28",1.1);add("R29",1);add("L01",.3);add("L03",.1);return done();}
  if(code==="RFCHIM"){add("R28",1.25);add("R29",1.5);add("L01",.8);add("L03",.2);return done();}
  if(code==="RFBOX"){add("R30",1.05);add("R22",.7);add("R12",2);add("L01",.8);add("L03",.4);return done();}
  match=/^RF(SKYL|DORM|HATCH|VENT)_(\d+)x(\d+)$/.exec(code);if(match){const w=Number(match[2])/100,l=Number(match[3])/100,area=w*l,perimeter=2*(w+l);
    if(match[1]==="SKYL"){add("R31",area);add("R28",perimeter*1.1);add("R29",perimeter);add("R12",perimeter*2);add("L01",3+area*1.5);add("L03",2);}
    else if(match[1]==="DORM"){add("R10",area*6);add("R01",area*1.4);add("R28",perimeter*1.3);add("R29",perimeter);add("L01",12+area*4);add("L03",8);}
    else if(match[1]==="HATCH"){add("R32",1);add("R28",perimeter*1.1);add("R29",perimeter);add("R12",perimeter*2);add("L01",3);add("L03",1);}
    else{add("R33",1);add("R29",1);add("L01",.5);}return done();}
  match=/^RFTTS_(.+)$/.exec(code);if(match){const truss=context.roofTrusses?.find(item=>cleanMark(item.mark)===match![1]);const span=n(truss?.span??8),members=n(truss?.wt)>0?n(truss?.wt):span*3.4+2;add("R10",members*1.05);add("R11",1);add("R21",2);add("L01",3+span*.4);add("L03",(3+span*.4)*.6);return done();}
  return null;
}

export function stdRecipe(code: string, context: PricingContext): Recipe {
  const specialised = roofxRecipe(code,context) ?? roofRecipe(code,context) ?? mepRecipe(code,context) ?? finRecipe(code,context);
  if(specialised)return specialised;
  const {lines,add}=builder(),material=factors(context);
  if(code in CONCRETE_FACTORS){
    const factor=CONCRETE_FACTORS[code]!,plain=code==="BLD"||code==="CBED";
    if(material.readymix){add("M05",1.05,"Includes 5% waste");add("L02",.5*factor);add("L03",1.2*factor);add("L04",.1*factor);add("P09",plain?0:.2);}
    else{const mix=mixFor(gradeOf(code,context),context);add("M01",mix.cem/50*1.05);add("M02",mix.sand*1.05);add("M03",mix.agg*1.05);add("M04",.18);add("L01",.4*factor);add("L02",.8*factor);add("L03",2*factor);add("L04",.1*factor);add("P08",.3);if(!plain)add("P09",.2);}
    if(!plain)add("M36",.25);if(["CSLAB","CBEAM","CDECK","CGIRD"].includes(code))add("P17",.06);if(BRIDGE_CODES.has(code))add("P13",.15);
    return result("In-situ concrete",lines,`Placing output about ${(8/factor).toFixed(1)} m³ per gang-hour`);
  }
  const base=/^FSLAB\d/.test(code)?"FSLAB":code.replace(/[\d.]+$|OVER.*$/,"");
  if(base in FORMWORK_FACTORS || /^FSLAB\d/.test(code)){
    const factor=FORMWORK_FACTORS[base]??1,uses=Math.max(1,material.uses),riser=base==="FSTRIS"?.3:1;
    add("M09",1.1/(2.98*uses)*riser);add("M10",material.timber/uses*riser);add("M11",material.nails*riser);add("M12",.1*riser);
    add("L01",.9*factor);add("L03",.6*factor);const weeks=base==="FSLAB"?2:PROPPING_WEEKS[base];if(weeks)add("P18",weeks);if(base==="FGIRD"||base==="FDECK")add("P13",.02);
    return result("Formwork",lines);
  }
  const rebar=/^R([A-Z]+)(\d+)$/.exec(code);
  if(rebar){const group=rebar[1]!,diameter=Number(rebar[2]),bridge=BRIDGE_REBAR_GROUPS.has(group)?1.15:1,hours=(diameter<=10?44:diameter<=16?34:26)*bridge;
    add(diameter<10?"M07":"M06",1.05);add("M08",material.wire);add("L01",hours);add("L03",hours*.5);add("P14",3);if(group==="DECK"||group==="PIER")add("P13",.5);return result("Bar reinforcement",lines);}
  const band=/(1\.00|2\.00|4\.00|OVER4)$/.exec(code)?.[1],depthFactor=band?({"1.00":1,"2.00":1.2,"4.00":1.5,"OVER4":1.9}[band]??1):1;
  const suffix=Number(/(\d+)$/.exec(code)?.[1]??0),family=code.replace(/\d+$/,""),density=2.35;
  if(/^EXC[PSTCR](1\.00|2\.00|4\.00|OVER4)$/.test(code)){add("P02",.045*depthFactor);add("L05",.045*depthFactor);add("L03",.25*depthFactor);add("L04",.01);return result("Excavation",lines);}
  if(/^EXCB(1\.00|2\.00|4\.00|OVER4)$/.test(code)){add("P01",.03*depthFactor);add("L05",.03*depthFactor);add("L03",.15*depthFactor);add("L04",.01);return result("Excavation",lines);}
  if(/^SUP(1\.00|2\.00|4\.00|OVER4)$/.test(code)){add("M10",1.2*depthFactor);add("M11",.05);add("L02",.15*depthFactor);add("L03",.15*depthFactor);return result("Earthwork support",lines);}
  if(family==="CAP"||family==="SUBB"){add("M17",1.25);add("P06",.008);add("P04",.012);add("P07",.01);add("M04",.1);add("L05",.03);add("L03",.1);return result("Pavement",lines);}
  if(family==="BASE"){add("M18",1.3);add("P06",.008);add("P04",.012);add("P07",.01);add("M04",.1);add("L05",.03);add("L03",.1);return result("Pavement",lines);}
  if(family==="ACW"||family==="ACB"){add(family==="ACW"?"M19":"M45",suffix/1000*density*1.03);add("P10",.0012);add("P11",.0012);add("P04",.0008);add("P03",.002);add("L05",.0032);add("L06",.002);add("L03",.02);return result("Bituminous",lines);}
  if(family==="PIPE"){const choices:[[number,string],[number,string],[number,string],[number,string],[number,string]]=[[450,"M39"],[600,"M40"],[750,"M41"],[900,"M42"],[1200,"M43"]];const selected=choices.reduce((best,next)=>Math.abs(next[0]-suffix)<Math.abs(best[0]-suffix)?next:best);const scale=suffix/600;add(selected[1],1.02);add("M01",.05*scale);add("L01",.25*scale);add("L03",.5*scale);add("P02",.03*scale);add("L05",.03*scale);return result("Pipework",lines);}
  switch(code.replace(/(1\.00|2\.00|4\.00|OVER4)$/,"")){
    case"TOP":add("P02",.006);add("L05",.006);add("P03",.006);add("L06",.006);add("L03",.02);return result("Site preparation",lines);
    case"CLR":add("P15",.0012);add("L05",.0012);add("P03",.0008);add("L06",.0008);add("L03",.015);return result("Site preparation",lines);
    case"TOPR":add("P15",.012);add("L05",.012);add("L03",.05);return result("Site preparation",lines);
    case"RCUT":add("P01",.012);add("P15",.004);add("L05",.016);add("L03",.03);return result("Road earthworks",lines);
    case"RCUTFILL":add("P01",.005);add("L05",.005);add("P03",.03);add("L06",.03);return result("Road earthworks",lines);
    case"RBORROW":add("M17",material.compact);add("P01",.006);add("L05",.006);add("P03",.05);add("L06",.05);return result("Road earthworks",lines);
    case"RFILL":add("P04",.01);add("P06",.005);add("P07",.008);add("M04",.08);add("L05",.023);add("L03",.05);return result("Road earthworks",lines);
    case"RSPOIL":add("P15",.004);add("L05",.004);add("P03",.035);add("L06",.035);return result("Road earthworks",lines);
    case"SGC":add("P06",.0015);add("P04",.002);add("P07",.0015);add("L05",.005);add("L03",.01);return result("Road earthworks",lines);
    case"PRIME":add("M20",material.prime);add("P12",.0008);add("L05",.0008);add("L03",.01);return result("Bituminous",lines);
    case"TACK":add("M21",material.tack);add("P12",.0006);add("L05",.0006);add("L03",.008);return result("Bituminous",lines);
    case"SDS":add("M37",1.8);add("M22",.018);add("P12",.001);add("P11",.0008);add("L05",.0018);add("L03",.02);return result("Bituminous",lines);
    case"KERB":add("M24",1.03);add("M01",.08);add("M02",.02);add("M03",.03);add("L01",.15);add("L03",.2);return result("Kerbs",lines);
    case"RMARK":add("M25",material.paint);add("P16",.004);add("L02",.004);add("L03",.004);return result("Road markings",lines);
    case"RSIGN":add("M26",1);add("M01",1);add("M02",.05);add("M03",.1);add("L02",3);add("L03",4);return result("Road furniture",lines);
    case"GRAIL":add("M27",1.02);add("L02",.3);add("L03",.3);add("P02",.02);add("L05",.02);return result("Road furniture",lines);
    case"RSTUD":add("M28",1);add("L03",.05);return result("Road furniture",lines);
    case"KMP":add("M29",1);add("M01",.5);add("L03",2);return result("Road furniture",lines);
    case"BRG":add("M30",1);add("L01",4);add("L03",4);add("P13",.5);return result("Bridge items",lines);
    case"EJ":add("M31",1);add("L01",2);add("L03",2);return result("Bridge items",lines);
    case"WPF":add("M32",1.1);add("L02",.1);add("L03",.05);return result("Bridge items",lines);
    case"SURF":add("M19",n(context.project.bacc?.surfT??50)/1000*density*1.03);add("P10",.002);add("P11",.002);add("L05",.004);add("L03",.03);return result("Bituminous",lines);
    case"SPOUT":add("M34",1);add("L01",1);add("L03",1);return result("Bridge items",lines);
    case"HRAIL":add("M33",1);add("L01",.5);add("L03",.5);return result("Bridge items",lines);
    case"BFGR":add("M35",material.compact);add("L03",.4);add("P05",.2);add("P04",.01);add("L05",.01);return result("Filling",lines);
    case"EXCD":add("P02",.04);add("L05",.04);add("L03",.3);add("P03",.02);add("L06",.02);return result("Excavation",lines);
    case"LVL":add("L03",.06);add("P05",.025);return result("Earthworks",lines);
    case"ATT":add("M16",material.att);add("L02",.02);return result("Treatment",lines);
    case"BFL":add("L03",.4);add("P05",.15);add("P07",.01);add("M04",.05);return result("Filling",lines);
    case"DSP":add("P02",.015);add("L05",.015);add("P03",.05);add("L06",.05);return result("Disposal",lines);
    case"HARD":add("M15",material.compact);add("L03",.7);add("P05",.25);return result("Filling",lines);
    case"SAND":add("M02",n(context.project.sog?.sand ?? 50)/1000*1.25);add("L03",.04);return result("Filling",lines);
    case"DPM":add("M14",1.15);add("L03",.02);return result("Membranes",lines);
    case"MESH":case"MESHD":add(code==="MESH"?"M13":"M38",1.15);add("M08",.05);add("L01",.05);add("L03",.05);return result("Fabric reinforcement",lines);
  }
  return result("Unclassified",lines);
}

export function analyse(code: string, context: PricingContext): RateAnalysis {
  const standard=stdRecipe(code,context),custom=context.customRates?.[code],lines=custom?.lines??standard.lines;
  const resources=new Map(context.resources.map(resource=>[resource.code,resource]));
  const categories: CategoryTotals={Labour:0,Material:0,Plant:0,Subcontract:0};
  const missing:string[]=[];
  const rows=lines.map((line,index)=>{const resource=resources.get(line.resourceCode)??null;const cost=resource?line.quantity*resource.rate*currencyFactor(context):0;if(resource)categories[resource.category]+=cost;else missing.push(line.resourceCode);return{...line,index,resource,cost};});
  const tools=categories.Labour*(context.toolsPct??3)/100;
  const direct=categories.Labour+categories.Material+categories.Plant+categories.Subcontract+tools;
  const overheads=direct*(context.overheadPct??10)/100;
  const profit=(direct+overheads)*(context.profitPct??10)/100;
  return{code,family:standard.family,note:standard.note,custom:custom!==undefined,rows,categories,tools,direct,overheads,profit,rate:Math.round((direct+overheads+profit)*100)/100,missing};
}

export function raRate(code: string, context: PricingContext): number { return analyse(code,context).rate; }
export function currencyFactor(context: PricingContext): number {
  return (context.databankCurrency??"USD").toUpperCase()===(context.projectCurrency??context.project.project?.currency??"USD").toUpperCase()?1:(context.fxRate??1);
}
export function resourceByCode(resources: readonly Resource[]): ReadonlyMap<string,Resource> {
  return new Map(resources.map(resource=>[resource.code,resource]));
}
export const RATE_CATEGORIES: readonly ResourceCategory[] = ["Labour","Material","Plant","Subcontract"];
