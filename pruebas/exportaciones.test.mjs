import { createHash } from "node:crypto";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import JSZip from 'jszip';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { avanzar } from '../bot/conversacion.mjs';

const require = createRequire(import.meta.url);
const cache = new Map();

test('los tres nuevos informes de Telegram se exportan con sus evidencias y datos en PDF y Word',async()=>{
  const app=modulo('App'),ops=modulo('Operaciones');
  const foto='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const operario={uid:'tecnico',nombre:'Técnico Telegram'};
  function enviar(s,texto,imagen){const r=avanzar(s,texto,imagen,operario,'bot');if(r.sesion.pendiente){r.sesion.base=r.sesion.revision;r.sesion.pendiente=false;}return r.sesion;}
  let html,documento;
  const crearURL=URL.createObjectURL,revocarURL=URL.revokeObjectURL;
  globalThis.window={open:()=>({document:{write:v=>{html=v;}}})};
  URL.createObjectURL=blob=>{documento=blob;return 'blob:prueba';};URL.revokeObjectURL=()=>{};
  globalThis.document={createElement:()=>({click:()=>{}})};
  try{
    for(const servicio of ['Aires acondicionados','Alarmas contra incendio','Inspección eléctrica']){
      let s=enviar(null,servicio);
      for(const v of ['INF-TELEGRAM','Cliente Telegram','Sede Telegram','2026-11-26'])s=enviar(s,v);
      if(servicio==='Inspección eléctrica'){s=enviar(s,'Ingeniero asignado');s=enviar(s,'IE-PRUEBA');}else s=enviar(s,'Usar mi nombre');
      if(servicio==='Aires acondicionados'){
        s=enviar(s,'Agregar equipo');
        for(const v of ['AC Telegram','Zona Telegram','Limpieza registrada','Sin observaciones','Pendiente de revisión','Revisar vibración'])s=enviar(s,v);
        for(let i=0;i<4;i++)s=enviar(s,'',{url:foto,pie:'Evidencia'});
      }else if(servicio==='Alarmas contra incendio'){
        s=enviar(s,'Agregar actividad');
        for(const v of ['Detector Telegram','Zona Telegram','Realizado','Limpieza registrada','Indicador dañado','Revisar indicador'])s=enviar(s,v);
        s=enviar(s,'',{url:foto,pie:'Evidencia'});s=enviar(s,'Siguiente');
      }else{
        s=enviar(s,'Agregar elemento');
        for(const v of ['Tablero Telegram','Zona Telegram','Conductor expuesto','Revisar conexión','Alta'])s=enviar(s,v);
        s=enviar(s,'',{url:foto,pie:'Evidencia'});s=enviar(s,'Siguiente');
      }
      const informe=s.informe;
      assert.equal(informe.resultado,null);
      if(informe.tipo==='incendio'){
        assert.throws(()=>ops.generatePDF(informe),/firmas/);
        await assert.rejects(ops.generateWord(informe),/firmas/);
        informe.firmasIncendio={tecnico:{nombre:'Técnico Telegram',fecha:informe.fecha,firmaUrl:foto},cliente:{nombre:'Cliente que firma',fecha:informe.fecha,firmaUrl:foto}};
        ops.generatePDF(informe);await ops.generateWord(informe);
      }else if(informe.tipo==='ac'){app.generatePDFAC(informe);await app.generateWordAC(informe);}
      else{app.generatePDFElectrico(informe);await app.generateWordElectrico(informe);}
      const zip=await JSZip.loadAsync(await documento.arrayBuffer());
      const xml=await zip.file('word/document.xml').async('string');
      for(const dato of ['INF-TELEGRAM','Cliente Telegram','Zona Telegram',informe.tipo==='ac' ? 'Revisar vibración' : informe.tipo==='incendio' ? 'Indicador dañado' : 'Conductor expuesto']){
        assert(html.includes(dato),servicio+' PDF: '+dato);
        assert(xml.includes(dato),servicio+' Word: '+dato);
      }
      assert(html.includes(foto));
    }
  }finally{URL.createObjectURL=crearURL;URL.revokeObjectURL=revocarURL;}
});

function modulo(nombre) {
  if (cache.has(nombre)) return cache.get(nombre);
  const archivo = ['.tsx', '.ts'].map(ext => resolve('src', nombre + ext)).find(existsSync);
  let fuente = readFileSync(archivo, 'utf8').replaceAll('import.meta.env.VITE_HABILITAR_IA', 'false');
  if (nombre === 'App') fuente += '\nexport { generatePDFElectrico, generatePDFAC, generateWordAC, generateWordElectrico, TipoSelectorView };';
  if (nombre === 'Operaciones') fuente += '\nexport { generatePDF, generateWord };';
  const codigo = ts.transpileModule(fuente, { compilerOptions: { target:ts.ScriptTarget.ES2020, module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX } }).outputText;
  const salida = {};
  new Function('require', 'exports', codigo)(dep => {
    if (dep === './nube') return { nubeActiva: false };
    if (dep === './vistaPDF') return { abrirVistaPDF: html => window.open().document.write(html) };
    if (dep.startsWith('.')) return modulo(dep.slice(2).replace(/\.ts$/, ''));
    return require(dep);
  }, salida);
  cache.set(nombre, salida);
  return salida;
}

test('el selector conserva todos los servicios y el PDF eléctrico trata las notas como texto', () => {
  const app = modulo('App');
  const interfaz = renderToStaticMarkup(React.createElement(app.TipoSelectorView, {usuario:{nombre:'Prueba'}}));
  for (const palabra of ['Verificación', 'Inspección', 'Aires', 'Operación de sitios', 'Mantenimiento de generadores']) assert(interfaz.includes(palabra), palabra);
  let html;
  globalThis.window = {open:()=>({document:{write:valor=>{html=valor;},close:()=>{}}})};
  app.generatePDFElectrico({codigo:'INF-PRUEBA', tipo:'verificacion', propietario:'<script>prueba</script>', elementos:[]});
  assert(html.includes('&lt;script&gt;prueba&lt;/script&gt;'));
  assert(!html.includes('<script>prueba</script>'));
  app.generatePDFAC({codigo:'INF-PRUEBA', propietario:'Cliente', equipos:[]});
  assert(html.includes('INF-PRUEBA'));
});

test('aires exporta el nombre, fecha y firma del cliente a PDF y Word y distingue firmas pendientes', async () => {
  const app = modulo('App');
  const firma = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const informe = {codigo:'AC-001',tipo:'ac',propietario:'Cliente',fecha:'2026-11-15',equipos:[{nombre:'Equipo 1',fotos:{}}],
    recepcionCliente:{nombre:'María <Encargada>',fecha:'2026-11-15',firmaUrl:firma}};
  let html;
  globalThis.window = {open:()=>({document:{write:valor=>{html=valor;}}})};
  app.generatePDFAC(informe);
  assert(html.includes('María &lt;Encargada&gt;'));
  assert(html.includes('15 de noviembre de 2026'));
  assert(html.includes(`src="${firma}"`));
  assert(html.includes('página 4 de 4'));
  let documento;
  const crearURL = URL.createObjectURL, revocarURL = URL.revokeObjectURL;
  URL.createObjectURL = blob => {documento=blob;return 'blob:prueba';};
  URL.revokeObjectURL = ()=>{};
  globalThis.document = {createElement:()=>({click:()=>{}})};
  try {await app.generateWordAC(informe);} finally {URL.createObjectURL=crearURL;URL.revokeObjectURL=revocarURL;}
  const zip=await JSZip.loadAsync(await documento.arrayBuffer());
  const xml=await zip.file('word/document.xml').async('string');
  assert(xml.includes('María &lt;Encargada&gt;'));
  assert(xml.includes('15 de noviembre de 2026'));
  assert(xml.includes('Firma del responsable del cliente'));
  assert(xml.includes('<w:drawing>'));
  assert(!xml.includes('Icono'));
  app.generatePDFAC({...informe,recepcionCliente:undefined});
  assert(html.includes('Firma pendiente de registrar'));
  assert(!html.includes('María'));
});

test('los documentos de generador conservan lecturas, modo final y recomendaciones', async () => {
  const ops = modulo('Operaciones');
  const {crearElementos} = modulo('checklists');
  const {tareasGenerador} = modulo('plantillaGeneradores');
  const informe = {id:'prueba', codigo:'INF-PRUEBA', tipo:'generador', tituloCorto:'Generador C-01', descripcion:'Plan Energía',
    checklistVersion:1, elementos:crearElementos(tareasGenerador.energia,['']).map(el=>el.kind==='hallazgo'
      ? {...el,obs:['Batería con falla'],acc:['Sustituir batería']}
      : {...el,estado:'Realizado',desc:'Resultado registrado',lectura:el.unidad?'9,5':el.opciones?'Manual':''}),resumen:[]};
  let html;
  globalThis.window = {open:()=>({document:{write:valor=>{html=valor;},close:()=>{}}})};
  ops.generatePDF(informe);
  let documento;
  const crearURL = URL.createObjectURL;
  const revocarURL = URL.revokeObjectURL;
  URL.createObjectURL = blob => {documento=blob;return 'blob:prueba';};
  URL.revokeObjectURL = ()=>{};
  globalThis.document = {createElement:()=>({click:()=>{}})};
  try { await ops.generateWord(informe); }
  finally { URL.createObjectURL=crearURL; URL.revokeObjectURL=revocarURL; }
  const zip = await JSZip.loadAsync(await documento.arrayBuffer());
  const xml = await zip.file('word/document.xml').async('string');
  for (const dato of ['Plan Energía','9,5 min','Manual','Sustituir batería','Batería con falla']) {
    assert(html.includes(dato), dato);
    assert(xml.includes(dato), dato);
  }
});

test('contra incendio ofrece tres sistemas y exporta ambas firmas con las evidencias', async()=>{
  const ops=modulo('Operaciones');
  const incendio=modulo('Incendio');
  const app=modulo('App');
  const selector=renderToStaticMarkup(React.createElement(incendio.SelectorIncendio,{usuario:{nombre:'Técnico'}}));
  const inicio=renderToStaticMarkup(React.createElement(app.TipoSelectorView,{usuario:{nombre:'Técnico'}}));
  assert(inicio.includes('Mantenimiento de Sistemas Contra Incendio'));
  assert.equal(Object.keys(incendio.sistemasIncendio).length,3);
  const firma='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const firmas={tecnico:{nombre:'Técnico <Uno>',fecha:'2026-11-17',firmaUrl:firma},cliente:{nombre:'Cliente Dos',fecha:'2026-11-17',firmaUrl:firma}};
  assert(incendio.firmasIncendioCompletas(firmas));
  assert(!incendio.firmasIncendioCompletas({...firmas,cliente:{...firmas.cliente,firmaUrl:''}}));
  let html,documento;
  globalThis.window={open:()=>({document:{write:valor=>{html=valor;}}})};
  const crearURL=URL.createObjectURL,revocarURL=URL.revokeObjectURL;
  URL.createObjectURL=blob=>{documento=blob;return 'blob:prueba';};URL.revokeObjectURL=()=>{};
  globalThis.document={createElement:()=>({click:()=>{}})};
  try{
    for(const [clave,sistema] of Object.entries(incendio.sistemasIncendio)){
      assert(selector.includes(sistema.nombre));
      const formulario=renderToStaticMarkup(React.createElement(incendio.NuevoIncendio,{sistema:clave,usuario:{nombre:'Técnico de ejemplo'},codigoSugerido:'SCI-001'}));
      assert(formulario.includes('Nombre del técnico *'));
      assert(formulario.includes('Técnico de ejemplo'));
      const informe={id:'demo',tipo:'incendio',sistemaIncendio:clave,codigo:'SCI-001',propietario:'Edificio de ejemplo',fecha:'2026-11-17',tecnico:firmas.tecnico.nombre,tituloCorto:'Mantenimiento de '+sistema.nombre,
        elementos:[{id:'e1',kind:'extra',grupo:'',titulo:'Evidencia del mantenimiento',desc:'Trabajo realizado',fotos:[{url:firma,pie:'Después del mantenimiento'}]}],resumen:['Visita concluida'],firmasIncendio:firmas};
      informe.descripcion=incendio.descripcionIncendio(informe);
      assert.throws(()=>ops.generatePDF({...informe,firmasIncendio:undefined}),/firmas/);
      await assert.rejects(ops.generateWord({...informe,firmasIncendio:undefined}),/firmas/);
      ops.generatePDF(informe);
      for(const texto of [sistema.nombre,'Evidencia del mantenimiento','Después del mantenimiento','Técnico &lt;Uno&gt;','Cliente Dos','17/11/2026','página 4 de 4'])assert(html.includes(texto),texto);
      await ops.generateWord(informe);
      const zip=await JSZip.loadAsync(await documento.arrayBuffer());
      const xml=await zip.file('word/document.xml').async('string');
      for(const texto of [sistema.nombre,'Evidencia del mantenimiento','Técnico &lt;Uno&gt;','Cliente Dos','17/11/2026','Cierre del mantenimiento'])assert(xml.includes(texto),texto);
      assert.equal((xml.match(/<w:drawing>/g)||[]).length,4,'portada, evidencia y dos firmas');
    }
  }finally{URL.createObjectURL=crearURL;URL.revokeObjectURL=revocarURL;}
});

test('un elemento con más de dos fotos conserva todas sus evidencias en PDF y Word',async()=>{
  const ops=modulo('Operaciones');
  const foto='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const informe={id:'muchas-fotos',tipo:'operacion',planta:'esfuerzo',codigo:'INF-FOTOS',tituloCorto:'Mantenimiento',descripcion:'Evidencias de dos operarios',
    elementos:[{id:'e1',kind:'extra',grupo:'',titulo:'Alarma del piso',desc:'Trabajo realizado',fotos:[1,2,3,4,5].map(i=>({url:foto,pie:'Evidencia número '+i}))}],resumen:[]};
  let html,documento;
  globalThis.window={open:()=>({document:{write:valor=>{html=valor;}}})};
  ops.generatePDF(informe);
  for(let i=1;i<=5;i++)assert(html.includes('Evidencia número '+i));
  assert(html.includes('página 4 de 4'));
  const crearURL=URL.createObjectURL,revocarURL=URL.revokeObjectURL;
  URL.createObjectURL=blob=>{documento=blob;return 'blob:prueba';};URL.revokeObjectURL=()=>{};
  globalThis.document={createElement:()=>({click:()=>{}})};
  try{await ops.generateWord(informe);}finally{URL.createObjectURL=crearURL;URL.revokeObjectURL=revocarURL;}
  const zip=await JSZip.loadAsync(await documento.arrayBuffer()),xml=await zip.file('word/document.xml').async('string');
  for(let i=1;i<=5;i++)assert(xml.includes('Evidencia número '+i));
  assert.equal((xml.match(/<w:drawing>/g)||[]).length,6);
});

test('el código y título editados aparecen en todos los tipos de exportación',async()=>{
  const app=modulo('App'),ops=modulo('Operaciones');
  const foto='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const firmado={nombre:'Responsable',fecha:'2026-11-18',firmaUrl:foto};
  let html,documento;
  globalThis.window={open:()=>({document:{write:valor=>{html=valor;}}})};
  const crearURL=URL.createObjectURL,revocarURL=URL.revokeObjectURL;
  URL.createObjectURL=blob=>{documento=blob;return 'blob:prueba';};URL.revokeObjectURL=()=>{};
  globalThis.document={createElement:()=>({click:()=>{}})};
  try{
    for(const tipo of ['inspeccion','verificacion','ac','operacion','generador','incendio']){
      const informe={id:'existente',tipo,codigo:'CODIGO-EDITADO',tituloInforme:'Título corregido de '+tipo,propietario:'Cliente',fecha:'2026-11-18',elementos:[],equipos:[],resumen:[],planta:'esfuerzo',sistemaIncendio:'alarma',tituloCorto:'Anterior',descripcion:'Prueba',firmasIncendio:{tecnico:firmado,cliente:firmado}};
      const operaciones=['operacion','generador','incendio'].includes(tipo);
      (operaciones?ops.generatePDF:tipo==='ac'?app.generatePDFAC:app.generatePDFElectrico)(informe);
      assert(html.includes(informe.codigo),tipo);assert(html.includes(informe.tituloInforme),tipo);
      await (operaciones?ops.generateWord:tipo==='ac'?app.generateWordAC:app.generateWordElectrico)(informe);
      const zip=await JSZip.loadAsync(await documento.arrayBuffer()),xml=await zip.file('word/document.xml').async('string');
      assert(xml.includes(informe.codigo),tipo);assert(xml.includes(informe.tituloInforme),tipo);
      const portada=(xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)||[]).find(p=>p.includes('<w:drawing>'));
      assert(portada?.includes('<w:jc w:val="center"/>'),'logo centrado: '+tipo);
    }
  }finally{URL.createObjectURL=crearURL;URL.revokeObjectURL=revocarURL;}
});

test('el PDF compacto conserva las dos líneas de un hallazgo y de su recomendación',()=>{
  const ops=modulo('Operaciones');let html;
  globalThis.window={open:()=>({document:{write:valor=>{html=valor;}}})};
  ops.generatePDF({id:'multilinea',tipo:'operacion',planta:'esfuerzo',codigo:'INF-PRUEBA',tituloCorto:'Mantenimiento',descripcion:'Prueba',resumen:[],elementos:[
    {id:'h1',kind:'hallazgo',titulo:'Hallazgo de dos líneas',fotos:[],obs:['Primera línea del hallazgo\nSegunda línea del hallazgo'],acc:['Primera acción\nSegunda acción']},
    {id:'e1',kind:'extra',titulo:'Trabajo realizado',fotos:[],desc:'Primera descripción\nSegunda descripción'},
  ]});
  assert(html.includes('Primera línea del hallazgo<br/>Segunda línea del hallazgo'));
  assert(html.includes('Primera acción<br/>Segunda acción'));
  assert(html.includes('Primera descripción<br/>Segunda descripción'));
  assert.equal((html.match(/<article class="evidencia">/g)||[]).length,2);
  assert(html.includes('página 3 de 3'));
});

test('la portada usa el logo oficial completo y elimina el bloque genérico de constructora',()=>{
  const ops=modulo('Operaciones'),logos=modulo('logos');let html;
  globalThis.window={open:()=>({document:{write:valor=>{html=valor;}}})};
  ops.generatePDF({id:'marca',tipo:'operacion',planta:'esfuerzo',codigo:'CODIGO-01',tituloCorto:'Mantenimiento',tituloInforme:'Mantenimiento de prueba',descripcion:'Descripción',elementos:[],resumen:[]});
  assert(html.includes(`src="data:image/jpeg;base64,${logos.LOGO_PORTADA_B64}"`));
  assert(html.includes('alt="Electrizar Electromecánica"'));
  assert(html.includes('margin:0 auto 30px'));
  assert.equal(createHash("sha256").update(Buffer.from(logos.LOGO_PORTADA_B64,"base64")).digest("hex"),"cd59b7ee869c0ca4cad851021242a3684bd6332071b9f3e8fb7311ca6208eaea");
  assert(!html.includes('<div class="cover-band">'));
  assert(html.includes('<div class="cover-code">CODIGO-01</div>'));
  assert(html.includes('<div class="cover-title">Mantenimiento de prueba</div>'));
});
