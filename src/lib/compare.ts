import type { KitRecord } from "./designer-kit";
import { typeText, sectionText, asksText } from "./take-away";
import { categoryLabel } from "./categories";
import { sectorName, BASIS_WORD } from "./labels";
import { PHONE_NAV_NAME } from "./structure";
import { spreadsheetSafe } from "./views/receipts";
export const compareRows = (rows: readonly KitRecord[]) => [
  {name:"Sector · category · sub-category",values:rows.map(r=>[sectorName(r.sector),r.category?categoryLabel(r.category):null,r.subcategory?categoryLabel(r.subcategory):null].filter(Boolean).join(" · "))},
  {name:"Headline and body type",values:rows.map(typeText)},
  {name:"Palette · share of first screen",values:rows.map(r=>r.identity.palette.map(p=>`${p.hex}${p.share!=null?` ${Math.round(p.share*100)}%`:""}`).join(" · ")||"Not measured")},
  {name:"Theme",values:rows.map(r=>r.theme??"Not measured")},
  {name:"Voice and style",values:rows.map(r=>r.identity.tags.map(t=>`${t.name} · ${BASIS_WORD[t.basis]}`).join(" · ")||"Not read")},
  {name:"Primary ask",values:rows.map(r=>r.structure?.asks?.find(a=>a.p)?.l??r.ask??"Not read")},
  {name:"First-screen asks",values:rows.map(r=>asksText(r.structure))},
  {name:"Navigation words",values:rows.map(r=>r.structure?.nav_labels?.join(" · ")??"Not read")},
  {name:"Section order",values:rows.map(r=>sectionText(r.structure))},
  {name:"Phone navigation",values:rows.map(r=>r.phone?.mobile?.nav?PHONE_NAV_NAME[r.phone.mobile.nav]??r.phone.mobile.nav:"Not read")},
  {name:"Last change",values:rows.map(r=>r.lastChange?`${r.lastChange.text} · ${r.lastChange.at.slice(0,10)}`:"No change recorded")},
];
export const compareTsv = (rows: readonly KitRecord[]) => [["Reading",...rows.map(r=>r.name)],...compareRows(rows).map(r=>[r.name,...r.values])].map(r=>r.map(s=>spreadsheetSafe(s).replace(/[\t\r\n]/g," ")).join("\t")).join("\n");