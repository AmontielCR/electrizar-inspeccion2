import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import JSZip from 'jszip';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const cache = new Map();
function modulo(nombre) {
  if (cache.has(nombre)) return cache.get(nombre);
  const archivo = ['.tsx', '.ts'].map(ext => resolve('src', nombre + ext)).find(existsSync);
  let fuente = readFileSync(archivo, 'utf8').replaceAll('import.meta.env.VITE_HABILITAR_IA', 'false');
  if (nombre === 'App') fuente += '\nexport { generatePDFElectrico, generatePDFAC, TipoSelectorView };';
  if (nombre === 'Operaciones') fuente += '\nexport { generatePDF, generateWord };';
  const codigo = ts.transpileModule(fuente, { compilerOptions: { target:ts.ScriptTarget.ES2020, module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX } }).outputText;
  const salida = {};
  new Function('require', 'exports', codigo)(dep => {
    if (dep === './nube') return { nubeActiva: false };
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
