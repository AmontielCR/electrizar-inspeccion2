import { Icono } from "./PanelTrabajos";
import { crearElementos, tareaCompleta } from "./checklists";
import { useState, useRef } from "react";
import { FichaLocal, useAutoguardadoFicha } from "./FichaLocal";
import { planesGenerador, tareasGenerador, type PlanGenerador } from "./plantillaGeneradores";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, PageOrientation,
  BorderStyle, WidthType, VerticalAlign, PageBreak,
} from "docx";
import { LOGO_ICON_B64, LOGO_FULL_B64 } from "./logos";

const LOGO_ICON_URI = `data:image/jpeg;base64,${LOGO_ICON_B64}`;
const LOGO_FULL_URI = `data:image/png;base64,${LOGO_FULL_B64}`;

const Y    = "#F5A800";
const DARK = "#111827";
const TEAL = "#0c4a6e";
const CO   = { nombre:"Electrizar Electromecánica SRL", tel:"4001-7246", correo:"amontiel@electrizarcr.com", dir:"Calle Blancos, Goicoechea, San José, Costa Rica." };
const HOY  = new Date().toISOString().split("T")[0];
const MESES_C = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type Tarea = { titulo: string; unidad?: string };
const tarea = (titulo: string): Tarea => ({ titulo });
const mediciones: Tarea[] = [
  { titulo: "Temperatura del agua tratada", unidad: "°C" },
  { titulo: "Sólidos sedimentables", unidad: "mL/L" },
  { titulo: "pH del agua tratada", unidad: "pH" },
];

const PLANTAS: Record<string, {
  icon: string;
  color: string;
  nombre: string;
  lugar: string;
  agrupado: boolean;
  tareas: Tarea[];
}> = {
  orokay: {
    icon: "🏭", color: Y, nombre: "PTAR Orokay II", lugar: "Orosi, Paraíso, Cartago",
    agrupado: false,
    tareas: [
      tarea("Limpieza de canasta de ingreso de aguas crudas"),
      tarea("Limpieza de tanques de ingreso de aguas crudas"),
      tarea("Limpieza de sedimentador secundario"),
      ...mediciones,
    ],
  },
  esfuerzo: {
    icon: "💧", color: "#0369a1", nombre: "PTAR El Esfuerzo", lugar: "Batán, Matina, Limón",
    agrupado: false,
    tareas: [
      tarea("Limpieza de canasta de ingreso de aguas crudas"),
      tarea("Limpieza de rejillas de ingreso de aguas crudas"),
      tarea("Limpieza de sedimentador secundario"),
      tarea("Limpieza general de la PTAR"),
      tarea("Verificación visual del agua tratada"),
      ...mediciones,
      tarea("Verificación del CCTV"),
    ],
  },
  lasanas: {
    icon: "⚙️", color: TEAL, nombre: "EBAR Las Anas", lugar: "Los Guido, Desamparados, San José",
    agrupado: true,
    tareas: [
      tarea("Limpieza de ingreso de aguas crudas"),
      tarea("Limpieza de canasta de ingreso de aguas crudas"),
      tarea("Limpieza general de la estación de bombeo"),
      tarea("Verificación del sistema de bombeo"),
      tarea("Verificación del CCTV"),
    ],
  },
};

const GENERADOR = { icon: "⚙️", color: TEAL, nombre: "Generadores", agrupado: false };
const perfilInforme = (inf: any) => inf.tipo === "generador" ? GENERADOR : PLANTAS[inf.planta];
const pieFoto = (foto: any, indice: number, cantidad: number) =>
  foto.pie ?? (cantidad === 2 ? ["ANTES", "DESPUÉS"][indice] : "");

const ESTADOS = ["Realizado", "No realizado", "No aplica"] as const;

const detalleElemento = (el: any) => el.requerido
  ? [el.estado, el.lectura && el.estado === "Realizado" ? [el.lectura, el.unidad].filter(Boolean).join(" ") : "", el.desc].filter(Boolean).join(" · ")
  : el.desc || el.titulo;

const tieneHallazgo = (el: any) =>
  !!el.fotos?.length || [...(el.obs || []), ...(el.acc || [])].some((texto: string) => texto.trim());

const elementosExportables = (inf: any) => (inf.elementos || []).filter((el: any) =>
  el.kind !== "resumen" && (!inf.checklistVersion || el.kind !== "hallazgo" || tieneHallazgo(el)));

const resumenExportable = (inf: any) => {
  const notas = (inf.resumen || []).filter((texto: string) => texto.trim());
  if (!inf.checklistVersion) return notas;
  const tareas = (inf.elementos || [])
    .filter((el: any) => el.requerido && el.estado === "Realizado")
    .map((el: any) => inf.tipo === "generador" ? el.titulo : [el.grupo, el.titulo, detalleElemento(el)].filter(Boolean).join(" · "));
  return [...tareas, ...notas];
};

const recomendacionesGenerador = (inf: any): string[] => inf.tipo === "generador"
  ? elementosExportables(inf).filter((el: any) => el.kind === "hallazgo")
    .flatMap((el: any) => (el.acc || []).filter((texto: string) => texto.trim()))
  : [];


/* ══ UTILIDADES ══ */
const uid = () => Math.random().toString(36).slice(2,10);

const processPhoto = (file: File): Promise<{url:string,b64:string}> => new Promise((res,rej) => {
  const img = new Image(), u = URL.createObjectURL(file);
  img.onload = () => {
    const max=600; let w=img.width, h=img.height;
    if(w>max){h=Math.round(h*max/w);w=max;} if(h>max){w=Math.round(w*max/h);h=max;}
    const c=document.createElement("canvas"); c.width=w; c.height=h;
    c.getContext("2d")!.drawImage(img,0,0,w,h); URL.revokeObjectURL(u);
    const dUrl=c.toDataURL("image/jpeg",0.55); res({url:dUrl,b64:dUrl.split(",")[1]});
  };
  img.onerror=rej; img.src=u;
});

const savePhotoToDevice = async (dataUrl: string, filename: string) => {
  try {
    const res=await fetch(dataUrl); const blob=await res.blob();
    const file=new File([blob],filename,{type:"image/jpeg"});
    if((navigator as any).canShare?.({files:[file]})){ await (navigator as any).share({files:[file],title:filename}); return; }
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),3000);
  } catch {}
};


// Genera la descripción del periodo a partir de fecha inicio y fin.
const periodoTexto=(iso1:string,iso2:string)=>{
  if(!iso1||!iso2)return"el periodo indicado";
  const[y1,m1,d1]=iso1.split("-").map(Number);
  const[y2,m2,d2]=iso2.split("-").map(Number);
  if(m1===m2&&y1===y2) return `del ${d1}° al ${d2} de ${MESES_C[m1-1]} ${y1}`;
  return `del ${d1} de ${MESES_C[m1-1]} al ${d2} de ${MESES_C[m2-1]} de ${y2}`;
};
// Etiqueta de mes/año para el título del informe (ej: "Agosto 2026").
const mesAnioTexto=(iso:string)=>{if(!iso)return"";const[y,m]=iso.split("-").map(Number);return`${MESES_C[m-1]} ${y}`;};

/* Crea la lista inicial de elementos a partir de la plantilla de la planta. */
const seedElementos = (plantaKey: string, numVisitas: number, checklist = true) => {
  const planta = PLANTAS[plantaKey];
  const grupos = planta.agrupado
    ? Array.from({ length: numVisitas }, (_, index) => "Visita #" + (index + 1))
    : [""];
  return crearElementos(planta.tareas, grupos, checklist);
};

/* ══ PDF: CSS + HELPERS (carta apaisada, formato Report&Run) ══ */
const PDF_CSS=`@page{size:letter landscape;margin:0;}*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#222;background:white;}
.pg{width:279mm;min-height:213mm;padding:11mm 15mm 9mm 15mm;page-break-after:always;display:flex;flex-direction:column;}
.pg:last-child{page-break-after:avoid;}
.body{flex:1;}
.hdr{display:flex;gap:14px;align-items:flex-start;padding-bottom:7px;border-bottom:2px solid #e5e7eb;margin-bottom:12px;}
.hdr-logo{height:40px;width:40px;object-fit:contain;flex-shrink:0;}
.hdr-cols{display:flex;gap:26px;font-size:7.5pt;color:#555;line-height:1.55;}
.hdr-cols b{color:#333;}
.ftr{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:7px;border-top:2px solid #e5e7eb;}
.ftr-logo{height:34px;width:auto;display:block;}
.ftr-pg{font-size:8pt;color:#9ca3af;}
.cover{padding:16mm 16mm 10mm 16mm;}
.cover-logo{height:48px;width:48px;object-fit:contain;display:block;margin-bottom:26px;}
.cover-band{background:${Y};border-radius:8px;height:150px;display:flex;align-items:center;justify-content:center;margin-bottom:30px;color:#fff;font-weight:900;font-size:17pt;letter-spacing:1px;text-align:center;line-height:1.3;}
.cover-title{font-size:23pt;font-weight:900;color:#111;line-height:1.28;margin-bottom:12px;}
.cover-sub{font-size:10.5pt;color:#555;line-height:1.6;max-width:78%;}
.cover-line{border-top:2px solid #111;margin-top:24px;}
.grp{font-size:15pt;font-weight:900;color:${DARK};margin-bottom:10px;}
.el-row{display:flex;gap:20px;align-items:flex-start;}
.el-imgs{display:flex;gap:8px;flex-shrink:0;}
.el-photo{width:230px;height:250px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;display:block;}
.el-photo.dual{width:150px;height:250px;}
.el-empty{width:230px;height:250px;background:#f3f4f6;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:34pt;color:#d1d5db;}
.el-cap{font-size:8pt;color:#888;text-align:center;margin-top:3px;font-weight:700;letter-spacing:1px;}
.el-num{font-size:8pt;color:#bbb;margin-top:5px;}
.el-text{flex:1;min-width:0;padding-top:2px;}
.el-title{font-size:11pt;color:#111;margin-bottom:8px;}
.el-title b{font-weight:900;}
.el-desc{font-size:10pt;line-height:1.65;color:#333;}
.sec{font-size:10pt;font-weight:700;color:#222;margin-top:12px;margin-bottom:4px;}
.li{font-size:9.5pt;line-height:1.55;color:#333;margin-bottom:2px;}
.res-h{font-size:16pt;font-weight:900;color:#111;margin-bottom:12px;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}`;

const pdfHdr=(nEl:string)=>`<div class="hdr"><img class="hdr-logo" src="${LOGO_ICON_URI}"/><div class="hdr-cols"><div><b>Contacto:</b> Ing. Alonso Montiel Cubillo<br/><b>Empresa:</b> ${CO.nombre}<br/><b>Teléfono:</b> ${CO.tel}<br/><b>Correo electrónico:</b> ${CO.correo}</div><div><b>Dirección:</b> ${CO.dir}<br/><b>N.º de elementos:</b> ${nEl}</div></div></div>`;
const pdfFtr=(p:number,t:number)=>`<div class="ftr"><img class="ftr-logo" src="${LOGO_FULL_URI}"/><div class="ftr-pg">página ${p} de ${t}</div></div>`;
const openPDF=(html:string)=>{const w=window.open("","_blank");if(!w){alert("Permite ventanas emergentes para generar el PDF.");return;}w.document.write(html);w.document.close();w.onload=()=>{w.focus();setTimeout(()=>w.print(),500);};};

const esc=(s:string)=>(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const nl2br=(s:string)=>esc(s).replace(/\n/g,"<br/>");

const generatePDF=(inf:any)=>{
  const P=perfilInforme(inf);
  const els=elementosExportables(inf);
  const nElLabel=P.agrupado?`${els.length} (${new Set(els.map((e:any)=>e.grupo)).size} grupos)`:`${els.length}`;
  const totalPags=els.length+2;
  const hdr=pdfHdr(nElLabel);

  // Portada
  const portada=`<div class="pg cover"><img class="cover-logo" src="${LOGO_ICON_URI}"/><div class="cover-band">CONSTRUCTORA<br/>ELECTROMECÁNICA</div><div class="cover-title">${esc(inf.codigo)}-Informe de ${esc(inf.tituloCorto)}</div><div class="cover-sub">${esc(inf.descripcion)}</div><div class="cover-line"></div>${pdfFtr(1,totalPags)}</div>`;

  // Hojas de elementos
  let prevGrupo="";
  const elPags=els.map((el:any,i:number)=>{
    const grupoH=(el.grupo && el.grupo!==prevGrupo)?`<div class="grp">${esc(el.grupo)}</div>`:"";
    prevGrupo=el.grupo||prevGrupo;
    // Fotos
    let imgs="";
    const fotos=(el.fotos||[]).filter((f:any)=>f&&f.url);
    if(fotos.length>=2){
      imgs=`<div><div class="el-imgs"><div><img class="el-photo dual" src="${esc(fotos[0].url)}"/><div class="el-cap">${esc(pieFoto(fotos[0],0,2))}</div></div><div><img class="el-photo dual" src="${esc(fotos[1].url)}"/><div class="el-cap">${esc(pieFoto(fotos[1],1,2))}</div></div></div><div class="el-num">(${i+1})</div></div>`;
    } else if(fotos.length===1){
      imgs=`<div><img class="el-photo" src="${esc(fotos[0].url)}"/><div class="el-cap">${esc(pieFoto(fotos[0],0,1))}</div><div class="el-num">(${i+1})</div></div>`;
    } else {
      imgs=`<div><div class="el-empty">📷</div><div class="el-num">(${i+1})</div></div>`;
    }
    // Texto
    let txt="";
    if(el.kind==="hallazgo"){
      const obs=(el.obs||[]).filter((x:string)=>x.trim()).map((o:string)=>`<div class="li">- ${nl2br(o)}</div>`).join("")||`<div class="li" style="color:#aaa">Sin observaciones.</div>`;
      const acc=(el.acc||[]).filter((x:string)=>x.trim()).map((a:string)=>`<div class="li">- ${nl2br(a)}</div>`).join("")||`<div class="li" style="color:#aaa">Sin acciones.</div>`;
      txt=`<div class="el-title"><b>Título:</b> ${esc(el.titulo)}</div><div class="sec">Observaciones:</div>${obs}<div class="sec" style="margin-top:14px;">Acciones Recomendadas:</div>${acc}`;
    } else {
      txt=`<div class="el-title"><b>Título:</b> ${esc(el.titulo)}</div><div class="el-desc">${nl2br(detalleElemento(el))}</div>`;
    }
    return `<div class="pg"><div class="body">${hdr}${grupoH}<div class="el-row">${imgs}<div class="el-text">${txt}</div></div></div>${pdfFtr(i+2,totalPags)}</div>`;
  }).join("");

  // Resumen General
  const resItems=resumenExportable(inf);
  const resList=resItems.map((r:string,i:number)=>`<div class="li" style="margin-bottom:6px;">${i+1}- ${nl2br(r)}</div>`).join("")||`<div class="li" style="color:#aaa">Sin acciones registradas.</div>`;
  const recomendaciones=recomendacionesGenerador(inf);
  const recomendacionesHTML=recomendaciones.length ? `<div class="sec">Recomendaciones</div>${recomendaciones.map(r=>`<div class="li">- ${nl2br(r)}</div>`).join("")}` : "";
  const resumen=`<div class="pg"><div class="body">${hdr}<div class="res-h">Resumen General</div><div class="sec" style="margin-top:0;">Acciones Realizadas:</div>${resList}${recomendacionesHTML}</div>${pdfFtr(totalPags,totalPags)}</div>`;

  openPDF(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>${esc(inf.codigo)}</title><style>${PDF_CSS}</style></head><body>${portada}${elPags}${resumen}</body></html>`);
};

/* ══ WORD (docx) — mismo contenido, apaisado ══ */
const CW=13248, MG=1152;
const NONE_B={style:BorderStyle.NONE,size:0,color:"FFFFFF"};
const PP={page:{size:{width:15840,height:12240,orientation:PageOrientation.LANDSCAPE},margin:{top:MG,right:MG,bottom:MG,left:MG}}};
const wCell=(ch:any[],w:number,ex:any={})=>new TableCell({width:{size:w,type:WidthType.DXA},borders:{top:NONE_B,bottom:NONE_B,left:NONE_B,right:NONE_B},margins:{top:40,bottom:40,left:60,right:60},verticalAlign:VerticalAlign.TOP,...ex,children:ch});
const wTbl=(rows:any[],cols:number[])=>new Table({width:{size:CW,type:WidthType.DXA},columnWidths:cols,borders:{top:NONE_B,bottom:NONE_B,left:NONE_B,right:NONE_B,insideHorizontal:NONE_B,insideVertical:NONE_B},rows});
const wp=(k:any[],o:any={})=>new Paragraph({children:k,...o});
const wt=(text:string,o:any={})=>new TextRun({text,font:"Arial",...o});
const wpb=()=>wp([new PageBreak()]);
const b64s=(uri:string)=>uri?uri.split(",")[1]:"";
const wImg=(b64:string,type:any,w:number,h:number)=>new ImageRun({type,data:b64,transformation:{width:w,height:h},altText:{title:"img",description:"img",name:"img"}});
const wHdr=(nEl:string)=>new Header({children:[wTbl([new TableRow({children:[
  wCell([wp([wImg(LOGO_ICON_B64,"jpeg",42,42)])],640),
  wCell([wp([wt("Contacto: ",{bold:true,size:14}),wt("Ing. Alonso Montiel Cubillo",{size:14,color:"555555"})]),wp([wt("Empresa: ",{bold:true,size:14}),wt(CO.nombre,{size:14,color:"555555"})]),wp([wt("Teléfono: ",{bold:true,size:14}),wt(CO.tel,{size:14,color:"555555"})]),wp([wt("Correo electrónico: ",{bold:true,size:14}),wt(CO.correo,{size:14,color:"555555"})])],6200),
  wCell([wp([wt("Dirección: ",{bold:true,size:14}),wt(CO.dir,{size:14,color:"555555"})]),wp([wt("N.º de elementos: ",{bold:true,size:14}),wt(nEl,{size:14,color:"555555"})])],CW-6840,{borders:{top:NONE_B,left:NONE_B,right:NONE_B,bottom:{style:BorderStyle.SINGLE,size:4,color:"E5E7EB"}}}),
]})],[640,6200,CW-6840])]});
const wFtr=()=>new Footer({children:[wTbl([new TableRow({children:[
  wCell([wp([wImg(LOGO_FULL_B64,"png",110,32)])],2400),
  wCell([wp([wt("Electrizar Electromecánica | Informe generado electrónicamente",{size:13,color:"9CA3AF"})],{alignment:AlignmentType.RIGHT})],CW-2400),
]})],[2400,CW-2400])]});
const wDownload=async(docx:any,codigo:string)=>{const blob=await Packer.toBlob(docx);const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${codigo}.docx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);};

const generateWord=async(inf:any)=>{
  const P=perfilInforme(inf);
  const els=elementosExportables(inf);
  const nElLabel=P.agrupado?`${els.length} (${new Set(els.map((e:any)=>e.grupo)).size} grupos)`:`${els.length}`;

  // Portada
  const cover=[
    wp([wImg(LOGO_ICON_B64,"jpeg",54,54)],{spacing:{after:220}}),
    wp([wt(`${inf.codigo}-Informe de ${inf.tituloCorto}`,{bold:true,size:44})],{spacing:{after:160}}),
    wp([wt(inf.descripcion,{size:21,color:"555555"})],{spacing:{after:360},border:{bottom:{style:BorderStyle.SINGLE,size:8,color:"111111"}}}),
    wpb(),
  ];
  // Elementos
  const elParas:any[]=[];
  let prevG="";
  els.forEach((el:any,idx:number)=>{
    if(el.grupo && el.grupo!==prevG){ elParas.push(wp([wt(el.grupo,{bold:true,size:30})],{spacing:{after:160}})); prevG=el.grupo; }
    const fotos=(el.fotos||[]).filter((f:any)=>f&&f.url);
    let imgCell:any[];
    if(fotos.length>=2){
      imgCell=[wTbl([new TableRow({children:[
        wCell([wp([wImg(b64s(fotos[0].url),"jpeg",150,215)]),wp([wt(pieFoto(fotos[0],0,2),{bold:true,size:16,color:"888888"})],{alignment:AlignmentType.CENTER})],2100),
        wCell([wp([wImg(b64s(fotos[1].url),"jpeg",150,215)]),wp([wt(pieFoto(fotos[1],1,2),{bold:true,size:16,color:"888888"})],{alignment:AlignmentType.CENTER})],2100),
      ]})],[2100,2100]),wp([wt(`(${idx+1})`,{size:16,color:"BBBBBB"})])];
    } else if(fotos.length===1){
      imgCell=[wp([wImg(b64s(fotos[0].url),"jpeg",240,255)]),wp([wt(pieFoto(fotos[0],0,1),{size:16,color:"888888"})]),wp([wt(`(${idx+1})`,{size:16,color:"BBBBBB"})])];
    } else {
      imgCell=[wp([wt("[ Sin fotografía ]",{size:18,color:"AAAAAA"})]),wp([wt(`(${idx+1})`,{size:16,color:"BBBBBB"})])];
    }
    let txtCell:any[];
    if(el.kind==="hallazgo"){
      txtCell=[wp([wt("Título: ",{bold:true,size:22}),wt(el.titulo,{size:22})],{spacing:{after:140}}),
        wp([wt("Observaciones:",{bold:true,size:20})],{spacing:{after:60}}),
        ...(el.obs||[]).filter((x:string)=>x.trim()).map((o:string)=>wp([wt("- "+o,{size:19,color:"333333"})],{spacing:{after:40}})),
        wp([wt("Acciones Recomendadas:",{bold:true,size:20})],{spacing:{before:120,after:60}}),
        ...(el.acc||[]).filter((x:string)=>x.trim()).map((a:string)=>wp([wt("- "+a,{size:19,color:"333333"})],{spacing:{after:40}}))];
    } else {
      txtCell=[wp([wt("Título: ",{bold:true,size:22}),wt(el.titulo,{size:22})],{spacing:{after:140}}),
        wp([wt(detalleElemento(el),{size:21,color:"333333"})])];
    }
    elParas.push(wTbl([new TableRow({children:[wCell(imgCell,5000),wCell(txtCell,CW-5000)]})],[5000,CW-5000]));
    if(idx<els.length-1) elParas.push(wpb());
  });
  elParas.push(wpb());
  // Resumen
  const resItems=resumenExportable(inf);
  const resumen=[wp([wt("Resumen General",{bold:true,size:32})],{spacing:{after:180}}),
    wp([wt("Acciones Realizadas:",{bold:true,size:22})],{spacing:{after:100}}),
    ...resItems.map((r:string,i:number)=>wp([wt(`${i+1}- ${r}`,{size:21,color:"333333"})],{spacing:{after:70}}))];

  const recomendaciones=recomendacionesGenerador(inf);
  if (recomendaciones.length) resumen.push(wp([wt("Recomendaciones",{bold:true,size:22})],{spacing:{before:120,after:60}}),
    ...recomendaciones.map(r=>wp([wt("- "+r,{size:21})])));

  const docx=new Document({sections:[{properties:PP,headers:{default:wHdr(nElLabel)},footers:{default:wFtr()},children:[...cover,...elParas,...resumen]}]});
  await wDownload(docx,inf.codigo);
};

/* ══ UI ATOMS ══ */
const Logo=({sm,white}:{sm?:boolean,white?:boolean})=>(<div className="flex items-center gap-2"><div className={`${sm?"w-7 h-7":"w-10 h-10"} flex items-center justify-center rounded-md flex-shrink-0`} style={{background:Y}}><svg viewBox="0 0 22 22" className={sm?"w-4 h-4":"w-6 h-6"} fill="white"><rect x="2" y="2" width="18" height="3"/><rect x="2" y="8.5" width="11" height="3"/><rect x="2" y="15" width="18" height="3"/><polygon points="14,8.5 18,8.5 15,12.5 19,12.5 12,20 13,13.5 9,13.5"/></svg></div><div><div className={`font-bold leading-tight ${sm?"text-xs":"text-sm"} ${white?"text-white":"text-gray-900"}`}>Electrizar</div><div className={`leading-tight ${sm?"text-[9px]":"text-[10px]"}`} style={{color:Y}}>Informes técnicos</div></div></div>);
const FI=({label,value,onChange,...rest}:any)=>(<div><label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">{label}</label><input value={value} onChange={onChange} className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-amber-400 focus:bg-white transition-all" {...rest}/></div>);
const Btn=({children,onClick,sm,disabled,full,color=Y,className=""}:any)=>(<button onClick={onClick} disabled={disabled} className={`font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 ${sm?"px-3 py-2 text-sm":"px-5 py-3"} ${full?"w-full":""} ${disabled?"opacity-50 cursor-not-allowed":"hover:opacity-90"} ${className}`} style={{background:disabled?"#9ca3af":color,color:"white"}}>{children}</button>);
const Card=({title,children,accent}:any)=>(<div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">{title&&<div className="px-4 pt-4 pb-2 flex items-center gap-2">{accent&&<div className="w-1 h-4 rounded-full" style={{background:Y}}/>}<h3 className="font-bold text-gray-700 text-xs uppercase tracking-widest">{title}</h3></div>}<div className="px-4 pb-4 space-y-3">{children}</div></div>);
const ListEditor=({label,items,set,placeholder,color=Y}:any)=>(<div><div className="flex items-center justify-between mb-2"><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</label><button onClick={()=>set([...items,""])} className="text-xs font-bold px-2.5 py-1 rounded-lg hover:opacity-80" style={{color,background:color+"18"}}>+ Agregar</button></div><div className="space-y-2">{!items.length&&<div className="text-xs text-gray-400 text-center py-3 border-2 border-dashed border-gray-100 rounded-xl">Sin {label.toLowerCase()}</div>}{items.map((h:string,i:number)=>(<div key={i} className="flex gap-2 items-start"><textarea value={h} onChange={(e:any)=>{const c=[...items];c[i]=e.target.value;set(c);}} rows={2} placeholder={placeholder} className="flex-1 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm bg-gray-50 resize-none focus:outline-none focus:border-amber-400 focus:bg-white transition-all"/><button onClick={()=>set(items.filter((_:any,j:number)=>j!==i))} className="mt-1.5 w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all text-base font-bold">×</button></div>))}</div></div>);

/* PhotoPicker: galería o cámara */
const PhotoBtns=({onPick,label}:{onPick:(mode:string)=>void,label:string})=>(
  <div className="flex gap-2">
    <button onClick={()=>onPick("gallery")} className="flex-1 py-2.5 border-2 border-gray-100 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1.5">🖼️ Galería</button>
    <button onClick={()=>onPick("camera")} className="flex-1 py-2.5 border-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-80" style={{borderColor:Y,color:Y,background:Y+"12"}}>📷 {label}</button>
  </div>
);

/* ══ LOGIN ══ */
export function SelectorView({onSelect,onVer,usuario}:any){
  return <div className="workspace-shell">
    <header className="workspace-header"><div className="workspace-header-inner"><Logo white/><span className="account-name">{usuario.nombre}</span></div></header>
    <main className="workspace-main"><button onClick={onVer} className="back-link">← Tipos de trabajo</button>
      <div className="workspace-intro"><div><p className="eyebrow">OPERACIÓN DE SITIOS</p><h1>Cada sitio, su propio informe.</h1><p className="intro-description">Selecciona la planta o estación para comenzar el registro de actividades.</p></div></div>
      <div className="service-grid">{Object.entries(PLANTAS).map(([clave,P]) => <button key={clave} onClick={()=>onSelect(clave)} className="service-card service-verde"><div className="service-card-top"><span className="service-icon"><Icono nombre="agua"/></span><Icono nombre="flecha" className="service-arrow"/></div><h3>{P.nombre}</h3><p>{P.lugar}</p><span className="service-detail">{P.agrupado?"Por visitas · FUPROVI":"Bisemanal · FUPROVI"}</span></button>)}</div>
    </main>
  </div>;
}
/* ══ NUEVO INFORME ══ */
export function NuevoView({planta,onCreate,onBack,usuario}:any){
  const P=PLANTAS[planta];
  const[codigo,setCod]=useState("");
  const[numInforme,setNum]=useState("1");
  const[fi,setFi]=useState(HOY);
  const[ff,setFf]=useState(HOY);
  const[numVisitas,setNV]=useState(2);
  const [creando, setCreando] = useState(false);

  const periodo=periodoTexto(fi,ff);
  const mesA=mesAnioTexto(ff);
  const tituloCorto = P.agrupado
    ? `Operación #${numInforme} de Estación de Bombeo Las Anas ${mesA}`
    : `Operaciones Bisemanal #${numInforme} ${mesA} ${P.nombre}`;
  const descripcion = "Informe de operación de " + P.nombre + ", " + P.lugar + ". Período " + periodo + ".";

  const go=async()=>{
    if(creando) return;
    if(!codigo.trim())return alert("Ingresa el código consecutivo (ej: INF-26-120-FUPROVI).");
    if (!fi || !ff || fi > ff) return alert("Selecciona un período válido.");
    if (!/^[1-9]\d*$/.test(numInforme)) return alert("Ingresa un número de informe válido.");
    const inf={
      id:crypto.randomUUID(), createdAt:Date.now(), tipo:"operacion", planta,
      codigo:codigo.trim(), numInforme, fechaInicio:fi, fechaFin:ff,
      tituloCorto, descripcion, periodo, propietario: P.nombre, direccion: P.lugar, fecha: ff,
      ingeniero:usuario.nombre, matricula:usuario.matricula || "",
      elementos:seedElementos(planta,numVisitas),
      checklistVersion: 1,
      resumen: [],
      finalizado:false,
    };
    setCreando(true);
    try { await onCreate(inf); } finally { setCreando(false); }
  };

  return(<div className="min-h-screen" style={{background:"#f8f9fb"}}>
    <header style={{background:DARK}} className="px-4 py-4 sticky top-0 z-10"><div className="flex items-center gap-3 max-w-lg mx-auto"><button onClick={onBack} className="text-white/60 hover:text-white text-xl">←</button><Logo sm white/><span className="font-bold text-white text-sm ml-1">{P.nombre}</span></div></header>
    <div className="p-4 max-w-lg mx-auto space-y-3 pb-28">
      <Card title="Identificación del informe" accent>
        <FI label="Código consecutivo *" value={codigo} onChange={(e:any)=>setCod(e.target.value)} placeholder="INF-26-120-FUPROVI"/>
        <FI label="Número de informe del periodo" value={numInforme} onChange={(e:any)=>setNum(e.target.value)} placeholder="1" type="number"/>
      </Card>
      <Card title="Periodo del reporte" accent>
        <div className="grid grid-cols-2 gap-3">
          <FI label="Fecha inicio *" value={fi} onChange={(e:any)=>setFi(e.target.value)} type="date"/>
          <FI label="Fecha fin *" value={ff} onChange={(e:any)=>setFf(e.target.value)} type="date"/>
        </div>
        <div className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">📅 Periodo: <b>{periodo}</b></div>
      </Card>
      {P.agrupado&&(
        <Card title="Visitas del periodo" accent>
          <div><label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Cantidad de visitas</label>
            <div className="flex gap-2">{[1,2,3,4].map(n=>(<button key={n} onClick={()=>setNV(n)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all" style={{borderColor:numVisitas===n?TEAL:"#e5e7eb",background:numVisitas===n?TEAL+"12":"white",color:numVisitas===n?TEAL:"#6b7280"}}>{n}</button>))}</div>
            <p className="text-[11px] text-gray-400 mt-2">Cada visita incluye su lista mínima y espacio para hallazgos. Podrás agregar visitas y trabajos adicionales.</p>
          </div>
        </Card>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Vista previa del título</p>
        <p className="text-sm font-bold text-gray-800">{codigo||"INF-26-XXX-FUPROVI"}-Informe de {tituloCorto}</p>
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{descripcion}</p>
      </div>
      <Btn onClick={go} disabled={creando} full color={P.color}>{creando ? "Guardando…" : "Crear informe"}</Btn>
    </div>
  </div>);
}

/* ══ MODAL DE ELEMENTO (tarea / hallazgo / extraordinario) ══ */
export function NuevoGenerador({ onCreate, onBack, usuario }: any) {
  const [plan, setPlan] = useState<PlanGenerador>("inspeccion");
  const [datos, setDatos] = useState({
    codigo: "", propietario: "", direccion: "", equipo: "", marca: "", modelo: "",
    potencia: "", fecha: new Date().toLocaleDateString("sv-SE"), tecnico: usuario.nombre || "",
  });
  const [guardando, setGuardando] = useState(false);
  const campo = (nombre: keyof typeof datos, etiqueta: string, requerido = false, tipo = "text") =>
    <label className="block text-xs font-semibold text-gray-700">
      {etiqueta}{requerido && " *"}
      <input type={tipo} required={requerido} value={datos[nombre]}
        onChange={e => setDatos(prev => ({ ...prev, [nombre]: e.target.value }))}
        className="block w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 mt-1 text-sm bg-gray-50" />
    </label>;
  const crear = async (event: React.FormEvent) => {
    event.preventDefault();
    if (guardando) return;
    const { codigo, propietario, direccion, equipo, marca, modelo, potencia, fecha, tecnico } = datos;
    if (![codigo, direccion, equipo, fecha, tecnico].every(valor => valor.trim())) {
      alert("Completa el código del informe, la sede, el código del equipo, la fecha y el responsable.");
      return;
    }
    const identificacion = [marca.trim(), modelo.trim()].filter(Boolean).join(" ");
    const detalles = [
      planesGenerador[plan], "Fecha de mantenimiento: " + fecha,
      propietario.trim() && "Cliente: " + propietario.trim(),
      "Sede: " + direccion.trim(), identificacion && "Equipo: " + identificacion,
      potencia.trim() && "Potencia: " + potencia.trim(), "Responsable: " + tecnico.trim(),
    ];
    setGuardando(true);
    try {
      await onCreate({
        ...datos, id: crypto.randomUUID(), createdAt: Date.now(), tipo: "generador",
        codigo: codigo.trim(), propietario: propietario.trim() || direccion.trim(), direccion: direccion.trim(),
        plan, tituloCorto: "Mantenimiento de generador " + equipo.trim(),
        descripcion: detalles.filter(Boolean).join(" · "), checklistVersion: 1,
        elementos: crearElementos(tareasGenerador[plan], [""]), resumen: [],
      });
    } finally {
      setGuardando(false);
    }
  };
  return <div className="min-h-screen bg-gray-50">
    <header className="bg-gray-900 text-white px-4 py-4">
      <div className="max-w-2xl mx-auto flex gap-3 items-center">
        <button onClick={onBack} aria-label="Volver a tipos de informe" className="text-xl">←</button>
        <h1 className="font-bold">Nuevo mantenimiento de generador</h1>
      </div>
    </header>
    <form onSubmit={crear} className="max-w-2xl mx-auto p-4 space-y-4">
      <Card title="Alcance del mantenimiento" accent>
        <label className="block text-xs font-semibold text-gray-700">
          Plan de mantenimiento
          <select value={plan} onChange={e => setPlan(e.target.value as PlanGenerador)} className="block w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 mt-1 text-sm bg-gray-50">
            {Object.entries(planesGenerador).map(([clave, nombre]) => <option key={clave} value={clave}>{nombre}</option>)}
          </select>
        </label>
        <p className="text-xs text-gray-600">{tareasGenerador[plan].length} tareas base. Los trabajos y hallazgos adicionales se registran dentro del informe.</p>
      </Card>
      <Card title="Identificación del informe y del equipo" accent>
        <div className="grid gap-3 sm:grid-cols-2">
          {campo("codigo", "Código del informe", true)}
          {campo("fecha", "Fecha de mantenimiento", true, "date")}
          {campo("propietario", "Cliente")}
          {campo("direccion", "Sede o ubicación", true)}
          {campo("equipo", "Código del generador", true)}
          {campo("tecnico", "Responsable", true)}
          {campo("marca", "Marca")}
          {campo("modelo", "Modelo")}
          {campo("potencia", "Potencia (valor y unidad)")}
        </div>
      </Card>
      <button disabled={guardando} type="submit" className="w-full p-3 bg-teal-900 text-white font-bold rounded-xl disabled:opacity-50">
        {guardando ? "Guardando borrador…" : "Crear informe"}
      </button>
    </form>
  </div>;
}

function ElementoModal({el,index,plantaColor,onSave,onClose,registro,esGenerador}:any){
  const[titulo,setT]=useState(el.titulo||"");
  const[desc,setD]=useState(el.desc||"");
  const[estado,setEstado]=useState(el.estado||"");
  const[lectura,setLectura]=useState(el.lectura||"");
  const[fotos,setFotos]=useState<any[]>(el.fotos||[]);
  const[obs,setObs]=useState<string[]>(el.obs||[]);
  const[acc,setAcc]=useState<string[]>(el.acc||[]);
  const[err,setErr]=useState<string|null>(null);
  const fRef=useRef<HTMLInputElement>(null);
  const ficha = { ...el, titulo, desc, estado, lectura, fotos, obs, acc };
  const { estado: estadoGuardado, esperarGuardado } = useAutoguardadoFicha(registro, ficha);
  const guardando = useRef(false);

  const pick=(mode:string)=>{const i=fRef.current;if(!i)return;if(mode==="camera")i.setAttribute("capture","environment");else i.removeAttribute("capture");i.click();};
  const onFile=async(e:any)=>{
    const f=e.target.files[0];e.target.value="";if(!f)return;setErr(null);
    try{
      const{url}=await processPhoto(f);
      setFotos(prev=>[...prev,esGenerador ? {url,pie:"Evidencia"} : {url}].slice(0,2));
      if (esGenerador) return;
      const ts=new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
      await savePhotoToDevice(url,`electrizar_op_${ts}.jpg`);
    }catch{setErr("Error al procesar la imagen.");}
  };
  const delFoto=(i:number)=>setFotos(prev=>prev.filter((_,j)=>j!==i));
  const save=async()=>{
    if (guardando.current) return;
    if(!titulo.trim()){setErr("El título es requerido.");return;}
    if (el.kind === "extra" && !desc.trim() && !fotos.length) {
      setErr("Agrega una descripción o una foto del trabajo.");
      return;
    }
    const detalle = el.requerido ? { estado, lectura: estado === "Realizado" ? lectura.trim() : "" } : {};
    guardando.current = true;
    try {
      await esperarGuardado();
      if (!await onSave({...el, ...detalle, titulo:titulo.trim(), desc:desc.trim(), fotos, obs, acc})) {
        setErr("No se pudo guardar el elemento. Vuelve a intentar.");
      }
    } finally { guardando.current = false; }
  };

  const isHall=el.kind==="hallazgo";
  const kindLabel=isHall?"Hallazgos":el.kind==="extra"?"Hoja extraordinaria":"Tarea";
  return(<div className="fixed inset-0 bg-black/70 z-40 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
    <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col" style={{maxHeight:"93vh"}}>
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0"><button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 font-bold text-lg">✕</button><span className="font-bold text-gray-800">{kindLabel} <span className="font-mono text-gray-400">({index+1})</span></span><Btn onClick={save} sm color={plantaColor}>Guardar ✓</Btn></div>
      <div className="overflow-y-auto p-4 space-y-4 pb-6">
        {estadoGuardado && <p role="status" className="text-xs text-gray-600">{estadoGuardado}</p>}
        {el.grupo&&<div className="text-[11px] font-bold px-2.5 py-1 rounded-lg inline-block" style={{background:plantaColor+"18",color:plantaColor}}>{el.grupo}</div>}
        <FI label="Título *" value={titulo} onChange={(e:any)=>{setT(e.target.value);setErr(null);}} placeholder="Título del elemento" readOnly={el.requerido}/>
        {el.requerido && (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-gray-600">
              Estado
              <select value={estado} onChange={e => setEstado(e.target.value)} className="block w-full mt-1 p-2 rounded-xl border border-gray-200">
                <option value="">Pendiente de registrar</option>
                {ESTADOS.map(opcion => <option key={opcion}>{opcion}</option>)}
              </select>
            </label>
            {el.opciones && estado === "Realizado" && <label className="block text-xs font-semibold text-gray-600">
              Modo registrado
              <select value={lectura} onChange={e=>setLectura(e.target.value)} className="block w-full mt-1 p-2 rounded-xl border border-gray-200">
                <option value="">Seleccionar</option>
                {el.opciones.map((modo:string)=><option key={modo}>{modo}</option>)}
              </select>
            </label>}
            {el.unidad && estado === "Realizado" && <FI label={"Lectura (" + el.unidad + ")"} value={lectura} onChange={(e:any) => setLectura(e.target.value)} inputMode="decimal"/>}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Fotografías (máx. 2)</label>
          {fotos.length>0&&(
            <div className="grid grid-cols-2 gap-2 mb-2">
              {fotos.map((f:any,i:number)=>(<div key={i} className="relative"><img src={f.url} className="w-full h-32 object-cover rounded-xl border-2 border-gray-100"/><button onClick={()=>delFoto(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs font-bold">×</button>{!esGenerador&&fotos.length===2&&<span className="absolute bottom-1 left-1 text-[10px] font-bold px-2 py-0.5 rounded bg-black/60 text-white">{i===0?"ANTES":"DESPUÉS"}</span>}</div>))}
            </div>
          )}
          {fotos.length<2&&<PhotoBtns onPick={pick} label={fotos.length===0?"Cámara":"Añadir 2ª foto"}/>}
          {esGenerador && fotos.map((f:any,i:number)=><label key={i} className="flex items-center gap-2 text-xs text-gray-600 mb-2">
            Foto {i+1}
            <select value={f.pie || "Evidencia"} onChange={e=>setFotos(prev=>prev.map((foto,j)=>j===i ? {...foto,pie:e.target.value} : foto))} className="border rounded-lg p-1">
              {["Evidencia","Antes","Después","Lectura"].map(tipo=><option key={tipo}>{tipo}</option>)}
            </select>
          </label>)}
          {!esGenerador&&fotos.length===2&&<p className="text-[11px] text-center text-gray-400">Con 2 fotos se muestran como ANTES / DESPUÉS.</p>}
          <input ref={fRef} type="file" accept="image/*" className="hidden" onChange={onFile}/>
        </div>

        {err&&<div className="bg-red-50 border-2 border-red-100 rounded-2xl p-3 text-xs text-red-600 font-medium">⚠️ {err}</div>}

        {isHall?(
          <>
            <ListEditor label="Observaciones" items={obs} set={setObs} placeholder={esGenerador ? "Ej. La prueba de batería resultó insatisfactoria." : "Ej: Se reporta variador #3 en fallo."} color={plantaColor}/>
            <ListEditor label="Acciones Recomendadas" items={acc} set={setAcc} placeholder={esGenerador ? "Ej. Programar la sustitución de la batería." : "Ej: Programar mantenimiento general del generador…"} color={plantaColor}/>
          </>
        ):(
          <div><label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Descripción</label>
            <textarea value={desc} onChange={(e:any)=>setD(e.target.value)} rows={3} placeholder={el.indicacion || "Descripción de la tarea realizada…"} className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm bg-gray-50 resize-none focus:outline-none focus:border-amber-400 focus:bg-white transition-all"/>
            {el.indicacion && estado === "Realizado" && <p className="text-xs text-gray-600 mt-1">{el.indicacion}</p>}
            {el.requerido && estado && estado !== "Realizado" && <p className="text-xs text-gray-500 mt-1">Indica el motivo en la descripción.</p>}
          </div>
        )}
      </div>
    </div>
  </div>);
}

/* ══ MODAL RESUMEN GENERAL ══ */
function ResumenModal({resumen,esChecklist,plantaColor,onSave,onClose}:any){
  const[items,setItems]=useState<string[]>(resumen||[]);
  return(<div className="fixed inset-0 bg-black/70 z-40 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
    <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col" style={{maxHeight:"93vh"}}>
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0"><button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 font-bold text-lg">✕</button><span className="font-bold text-gray-800">Resumen General</span><Btn onClick={()=>onSave(items)} sm color={plantaColor}>Guardar ✓</Btn></div>
      <div className="overflow-y-auto p-4 pb-6">
        {esChecklist && <p className="text-sm text-gray-600 mb-3">El informe incluye automáticamente las tareas realizadas. Aquí puedes agregar notas de cierre.</p>}
        <ListEditor label={esChecklist ? "Notas de cierre" : "Acciones realizadas"} items={items} set={setItems} placeholder={esChecklist ? "Agrega una nota…" : "Acción realizada durante el período…"} color={plantaColor}/>
      </div>
    </div>
  </div>);
}

/* ══ VISTA DEL INFORME (edición) ══ */
export function InformeView({informe,onUpdate,onBack,guardado,cuenta}:any){
  const P=perfilInforme(informe);
  const esGenerador = informe.tipo === "generador";
  const[editIdx,setEditIdx]=useState<number|null>(null);
  const[extra,setExtra]=useState<any>(null);
  const[resM,setResM]=useState(false);
  const[gen,setGen]=useState<string|null>(null);

  const els=informe.elementos||[];
  const grupos:string[]=P.agrupado?Array.from(new Set(els.map((e:any)=>e.grupo as string))):[""];
  const conFoto=els.filter((e:any)=>(e.fotos||[]).length>0).length;
  const requeridas = els.filter((el: any) => el.requerido);
  const pendientes = requeridas.filter((el: any) => !tareaCompleta(el)).length;

  const commit=onUpdate;
  const claveFicha = editIdx !== null ? informe.id + "/" + informe.tipo + "/" + els[editIdx].id : "";
  const claveExtra = extra ? informe.id + "/extra/" + extra.grupo : "";
  const saveEl = async (el: any) => {
    const ok = await commit({ ...informe, elementos: els.map((e:any,i:number) => i === editIdx ? el : e) }, claveFicha);
    if (ok) setEditIdx(null);
    return ok;
  };
  const delEl=(i:number)=>{ if(!confirm("¿Eliminar este elemento?"))return; commit({...informe,elementos:els.filter((_:any,j:number)=>j!==i)}); };
  const addExtra = (grupo: string) => {
    setExtra({ id: uid(), kind: "extra", grupo, titulo: "", desc: "", fotos: [], obs: [], acc: [] });
  };
  const saveExtra = async (el: any) => {
    const elementos = [...els];
    const ultimo = elementos.map((item: any) => item.grupo || "").lastIndexOf(el.grupo);
    elementos.splice(ultimo < 0 ? elementos.length : ultimo + 1, 0, el);
    const ok = await commit({ ...informe, elementos }, claveExtra);
    if (ok) setExtra(null);
    return ok;
  };
  const addVisita=()=>{
    const n=grupos.length+1; const g=`Visita #${n}`;
    const nuevos=seedElementos("lasanas",1,!!informe.checklistVersion).map((e:any)=>({...e,grupo:g}));
    commit({...informe,elementos:[...els,...nuevos]});
  };
  const saveResumen=(items:string[])=>{ commit({...informe,resumen:items}); setResM(false); };

  const doGen=async(fmt:string)=>{
    if (pendientes) return;
    setGen(fmt);
    try{ if(fmt==="pdf") generatePDF(informe); else await generateWord(informe); }
    catch(e:any){ alert("Error al generar: "+(e.message||e)); }
    finally{ setGen(null); }
  };

  // agrupar índices por grupo para render
  const renderGrupos=grupos.map((g:string)=>({grupo:g,items:els.map((e:any,i:number)=>({e,i})).filter((x:any)=>x.e.grupo===g)}));

  return(<div className="min-h-screen" style={{background:"#f8f9fb"}}>
    <header style={{background:DARK}} className="px-4 py-4 sticky top-0 z-10 shadow-lg"><div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-2"><button onClick={onBack} className="text-white/60 hover:text-white text-xl">←</button><Logo sm white/><span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-lg" style={{background:P.color+"30",color:P.color}}>{P.icon} {P.nombre.toUpperCase()}</span></div>
      <div className="ml-1"><div className="font-mono text-[11px] text-white/40">{informe.codigo}</div><div className="font-bold text-white text-sm">{esGenerador ? informe.tituloCorto : `Informe #${informe.numInforme} · ${mesAnioTexto(informe.fechaFin)}`}</div></div>
    </div></header>

    <div className="bg-white border-b border-gray-100 px-4 py-2"><div className="max-w-2xl mx-auto flex gap-5 text-xs flex-wrap"><span className="text-gray-500">📷 <b className="text-gray-700">{conFoto}/{els.length}</b> con foto</span><span className="text-gray-500">📅 {esGenerador ? informe.fecha : informe.periodo}</span>{esGenerador && <span className="font-semibold text-teal-900">{planesGenerador[informe.plan as PlanGenerador]}</span>}{!!requeridas.length && <span className="font-semibold text-gray-700">{requeridas.length-pendientes}/{requeridas.length} tareas registradas</span>}</div></div>

    <div className="p-4 max-w-2xl mx-auto pb-40 space-y-5">
      {guardado}
      {renderGrupos.map(({grupo,items}:any)=>(
        <div key={grupo||"gen"} className="space-y-3">
          {grupo&&<div className="flex items-center gap-2 pt-1"><div className="w-1.5 h-5 rounded-full" style={{background:P.color}}/><h2 className="font-extrabold text-gray-800">{grupo}</h2></div>}
          {items.map(({e,i}:any)=>(
            <div key={e.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex gap-3 p-3">
                {(e.fotos||[]).length>0
                  ?<div className="flex gap-1 shrink-0">{e.fotos.slice(0,2).map((f:any,k:number)=>(<img key={k} src={f.url} className="w-16 h-16 object-cover rounded-lg"/>))}</div>
                  :<div className="w-16 h-16 bg-gray-100 rounded-lg shrink-0 flex items-center justify-center text-2xl">📷</div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1"><span className="font-mono text-[10px] text-gray-300">({i+1})</span>{e.kind==="hallazgo"&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600">HALLAZGOS</span>}{e.kind==="extra"&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">EXTRAORDINARIO</span>}</div>
                  <div className="font-bold text-sm text-gray-800 leading-snug">{e.titulo}</div>
                  {e.kind==="hallazgo"?<div className="text-xs text-gray-400 mt-1">{(e.obs||[]).filter((x:string)=>x.trim()).length} obs · {(e.acc||[]).filter((x:string)=>x.trim()).length} acciones</div>:<div className="text-xs text-gray-400 mt-1 truncate">{e.requerido ? (tareaCompleta(e) ? detalleElemento(e) : "Pendiente de completar") : (e.desc||"Sin descripción")}</div>}
                </div>
              </div>
              <div className="flex border-t border-gray-50 divide-x divide-gray-50 text-xs">
                <button onClick={()=>setEditIdx(i)} className="flex-1 py-2.5 text-gray-500 hover:bg-gray-50 font-semibold">✏️ Editar / Fotos</button>
                {e.kind==="extra"&&<button onClick={()=>delEl(i)} className="flex-1 py-2.5 text-red-400 hover:bg-red-50 font-semibold">🗑️ Eliminar</button>}
              </div>
            </div>
          ))}
          <button onClick={()=>addExtra(grupo)} className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-xs font-bold text-gray-400 hover:border-gray-300 hover:text-gray-500">+ Agregar trabajo o evidencia{grupo?` en ${grupo}`:""}</button>
        </div>
      ))}

      {P.agrupado&&<button onClick={addVisita} className="w-full py-2.5 rounded-xl text-xs font-bold text-white" style={{background:TEAL}}>+ Agregar otra visita</button>}

      {/* Resumen */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4"><div className="flex items-center justify-between"><div><p className="font-bold text-gray-800 text-sm">📋 Resumen General</p><p className="text-xs text-gray-400 mt-0.5">{(informe.resumen||[]).filter((x:string)=>x.trim()).length} {informe.checklistVersion ? "notas de resumen" : "acciones realizadas"}</p></div><Btn onClick={()=>setResM(true)} sm color={P.color}>Editar</Btn></div></div>
      </div>

      {/* Generar */}
      <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-4">
        <p className="font-bold text-gray-600 text-sm mb-1">Generar informe para el cliente</p>
        <p className="text-xs text-gray-400 mb-4">Documento apaisado con portada, hojas de tareas, hallazgos y resumen.</p>
        {!!pendientes && <p role="status" className="text-sm text-amber-700 mb-3">Completa las {pendientes} tareas pendientes para generar el informe.</p>}
        <div className="flex gap-2">
          <button onClick={()=>doGen("pdf")} disabled={!!gen || pendientes > 0} className="flex-1 py-3 rounded-xl font-extrabold text-white text-sm disabled:opacity-60" style={{background:DARK}}>{gen==="pdf"?"⏳…":"🖨️ PDF"}</button>
          <button onClick={()=>doGen("word")} disabled={!!gen || pendientes > 0} className="flex-1 py-3 rounded-xl font-extrabold text-sm border-2 disabled:opacity-60" style={{borderColor:P.color,color:P.color}}>{gen==="word"?"⏳…":"📝 Word"}</button>
        </div>
      </div>
    </div>

    {editIdx!==null&&<FichaLocal key={claveFicha} cuenta={cuenta} clave={claveFicha} cerrar={()=>setEditIdx(null)}>
      {(datos, registro) => <ElementoModal esGenerador={esGenerador} registro={registro} el={datos ?? els[editIdx]} index={editIdx} plantaColor={P.color} onSave={saveEl} onClose={()=>setEditIdx(null)}/>}
    </FichaLocal>}
    {extra && <FichaLocal key={claveExtra} cuenta={cuenta} clave={claveExtra} cerrar={()=>setExtra(null)}>
      {(datos, registro) => <ElementoModal esGenerador={esGenerador} registro={registro} el={datos ?? extra} index={els.length} plantaColor={P.color} onSave={saveExtra} onClose={()=>setExtra(null)}/>}
    </FichaLocal>}
    {resM&&<ResumenModal resumen={informe.resumen} esChecklist={!!informe.checklistVersion} plantaColor={P.color} onSave={saveResumen} onClose={()=>setResM(false)}/>}
  </div>);
}

