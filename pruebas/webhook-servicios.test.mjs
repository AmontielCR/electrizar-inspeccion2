import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { avanzar, teclado, iniciaNuevaVisita, pregunta } from '../bot/conversacion.mjs';
import { sesionDesdeInforme } from '../bot/gestion.mjs';

test('el webhook guarda teclados compatibles con Firestore y cambia de servicio sin heredar el informe anterior',async()=>{
  const documentos=new Map(),informes=new Map(),enviados=[];
  const copia=v=>v===undefined ? v : structuredClone(v);
  function validar(v) {
    if(Array.isArray(v)){assert(!v.some(Array.isArray),'Firestore no admite matrices anidadas');v.forEach(validar);}
    else if(v && typeof v==='object')Object.values(v).forEach(validar);
  }
  function combinar(a,b){const r={...a};for(const [k,v]of Object.entries(b))r[k]=v&&typeof v==='object'&&!Array.isArray(v)?combinar(r[k]||{},v):v;return r;}
  const sdk={
    doc:(_db,...partes)=>partes.join('/'),
    getDoc:async ref=>({data:()=>ref==='equipo/bot' ? {rol:'bot_telegram'} : copia(documentos.get(ref))}),
    setDoc:async(ref,valor,opciones)=>{
      validar(valor);
      documentos.set(ref,opciones?.merge ? combinar(documentos.get(ref)||{},valor) : opciones?.mergeFields ? {...documentos.get(ref),...copia(valor)} : copia(valor));
    },
    runTransaction:async(_db,ejecutar)=>ejecutar({
      get:async ref=>({data:()=>copia(documentos.get(ref))}),
      set:(ref,valor,opciones)=>{validar(valor);documentos.set(ref,opciones?.merge ? combinar(documentos.get(ref)||{},valor) : copia(valor));},
    }),
  };
  const guardarRemoto=async(_db,b)=>{informes.set(b.id,{...copia(b.informe),versionRemota:b.revision});};
  const leerRemoto=async(_db,id)=>{assert(informes.has(id));return copia(informes.get(id));};
  const fuente=readFileSync(new URL('../api/telegram.js',import.meta.url),'utf8')
    .replace(/^import .+;\r?$/gm,'').replaceAll('export function ','function ').replace('export default async function handler','async function handler');
  const nombres=['createHash','randomUUID','timingSafeEqual','doc','getDoc','runTransaction','setDoc','conectarFirebase','avanzar','teclado','iniciaNuevaVisita','guardarRemoto','leerRemoto','pregunta','navegarInformes','procesarCodigo','sugerenciaInicial','pideCodigo','sesionDesdeInforme'];
  const handler=new Function(...nombres,fuente+'\nreturn handler;')(createHash,randomUUID,timingSafeEqual,sdk.doc,sdk.getDoc,sdk.runTransaction,sdk.setDoc,async()=>({db:{},uid:'bot'}),avanzar,teclado,iniciaNuevaVisita,guardarRemoto,leerRemoto,pregunta,async()=>null,async()=>null,async (_db,s)=>s,()=>false,sesionDesdeInforme);
  const cambios={TELEGRAM_WEBHOOK_SECRET:'s'.repeat(40),TELEGRAM_TOKEN:'token-prueba',TELEGRAM_OPERARIOS:JSON.stringify({'123':{uid:'tecnico',nombre:'Técnico Prueba'}})};
  const originales=Object.fromEntries(Object.keys(cambios).map(k=>[k,process.env[k]])),fetchAnterior=globalThis.fetch;
  Object.assign(process.env,cambios);
  globalThis.fetch=async(_url,config)=>{enviados.push(JSON.parse(config.body));return {ok:true,json:async()=>({ok:true,result:{}})};};
  let id=0;
  async function mensaje(texto) {
    const res={status(c){this.codigo=c;return this;},json(v){this.datos=v;return this;}};
    await handler({method:'POST',headers:{'x-telegram-bot-api-secret-token':cambios.TELEGRAM_WEBHOOK_SECRET},body:{update_id:++id,message:{from:{id:123},chat:{id:123,type:'private'},text:texto}}},res);
    assert.equal(res.codigo,200,JSON.stringify(res.datos));
    return documentos.get('telegramSesiones/bot/usuarios/123').estado;
  }
  try {
    await mensaje('/nuevo');await mensaje('Aires acondicionados');
    for(const v of ['AC-TEST','Cliente','Sede','2026-11-26','Usar mi nombre'])await mensaje(v);
    const anterior=(await mensaje('Revisar informe')).informeId;
    await mensaje('Entregar borrador');
    informes.get(anterior).versionRemota='editado-en-web';
    const nuevo=await mensaje('Nuevo informe');
    assert.equal(nuevo.etapa,'servicio');
    assert.equal(nuevo.informeId,'');
    await mensaje('Alarmas contra incendio');
    for(const v of ['SCI-TEST','Otro cliente','Otro sitio','2026-11-26','Usar mi nombre'])await mensaje(v);
    const estado=await mensaje('Agregar actividad');
    assert.notEqual(estado.informeId,anterior);
    assert.equal(informes.size,2);
    const alarma=informes.get(estado.informeId);
    assert.equal(alarma.tipo,'incendio');
    assert.equal(alarma.sistemaIncendio,'alarma');
    assert.equal(alarma.equipos,undefined);
    assert.equal(enviados.at(-1).reply_markup.resize_keyboard,true);
    assert.equal(documentos.get('telegramSesiones/bot/usuarios/123').pendiente,null);
    informes.get(estado.informeId).versionRemota='cambio-web-reciente';
    const actualizado=await mensaje('Texto escrito sobre una versión anterior');
    assert.equal(actualizado.etapa,'gestion');
    assert.equal(informes.get(estado.informeId).elementos[0].titulo,'');
    assert.match(enviados.at(-1).text,/no se aplicó/);
  }finally{
    globalThis.fetch=fetchAnterior;
    for(const [k,v]of Object.entries(originales)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  }
});
