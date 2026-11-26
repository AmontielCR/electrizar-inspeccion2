import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { almacenSimulado } from './soporteAlmacen.mjs';
import { normalizar } from '../bot/servicios.mjs';
import { sesionDesdeInforme } from '../bot/gestion.mjs';
import { avanzar, pregunta } from '../bot/conversacion.mjs';

function soporte() {
  const a=almacenSimulado();
  const nombres=['collection','doc','getDoc','getDocs','query','where','orderBy','limit','startAfter','documentId','interpretarCodigo','sugerirCodigo','reservarCodigo','leerRemoto','normalizar','sesionDesdeInforme'];
  const valores=nombres.map(n=>n==='normalizar'?normalizar:n==='sesionDesdeInforme'?sesionDesdeInforme:a.sdk[n]||a[n]);
  const fuente=readFileSync(new URL('../bot/catalogo.mjs',import.meta.url),'utf8').replace(/^import .+;\r?$/gm,'').replace(/^export /gm,'');
  const catalogo=new Function(...nombres,fuente+'\nreturn {navegarInformes,procesarCodigo,sugerenciaInicial};')(...valores);
  return {...a,...catalogo};
}
const tecnico={uid:'t1',nombre:'Técnico 1'};
function editar(s,texto,foto) {return avanzar(s,texto,foto,tecnico,'bot',randomUUID).sesion;}
async function guardar(a,s) {
  if(s.pendiente){await a.guardarRemoto({}, {id:s.informe.id,informe:s.informe,base:s.base,revision:s.revision,pendiente:true},{exigirBase:true});s.base=s.revision;s.pendiente=false;}
  return s;
}
const baseAC={id:'web-ac',codigo:'INF-26-190',tipo:'ac',createdAt:1,propietario:'Cliente',fecha:'2026-11-26',tecnico:'Responsable',resultado:null,equipos:[{id:'eq1',num:1,nombre:'AC original',ubicacion:'Piso 1',resultado:'Aprobado',observaciones:'Texto original',acciones:['Acción original'],fotos:{evaporadora:'foto-e',condensadora:'foto-c',tuberia:'foto-t',presiones:'foto-p'}}]};

test('abre un informe de la web por código, corrige un texto y conserva su identidad y fotos',async()=>{
  const a=soporte();await a.guardarRemoto({}, {id:baseAC.id,informe:baseAC,revision:'r1',base:'',pendiente:true});
  let s=(await a.navegarInformes({},null,'/abrir INF-26-190')).sesion;
  assert.equal(s.informe.id,'web-ac');assert.equal(s.etapa,'gestion');
  s=editar(s,'Editar textos');s=editar(s,'1');s=editar(s,'Trabajo y observaciones');s=editar(s,'Texto corregido\nSegunda línea');
  await guardar(a,s);
  const inf=await a.leerRemoto({},'web-ac');
  assert.equal(inf.equipos[0].observaciones,'Texto corregido\nSegunda línea');
  assert.deepEqual(inf.equipos[0].fotos,baseAC.equipos[0].fotos);
  assert.equal(inf.equipos[0].id,'eq1');assert.equal(inf.equipos.length,1);
});

test('reemplaza o elimina solo la foto seleccionada y pide confirmar la eliminación',async()=>{
  const a=soporte();await a.guardarRemoto({}, {id:baseAC.id,informe:baseAC,revision:'r1',base:'',pendiente:true});
  let s=(await a.navegarInformes({},null,'/abrir INF-26-190')).sesion;
  s=editar(s,'Editar fotos');s=editar(s,'1');s=editar(s,'Condensadora');
  s=editar(s,'',{url:'foto-c-corregida',pie:'Después'});await guardar(a,s);
  assert.equal(s.informe.equipos[0].fotos.condensadora,'foto-c-corregida');
  assert.equal(s.informe.equipos[0].fotos.evaporadora,'foto-e');
  s=editar(s,'Evaporadora');s=editar(s,'Eliminar foto');
  assert.equal(s.etapa,'fotoBorrar');assert.equal(s.informe.equipos[0].fotos.evaporadora,'foto-e');
  s=editar(s,'Confirmar eliminación');await guardar(a,s);
  assert.equal(s.informe.equipos[0].fotos.evaporadora,undefined);
  assert.equal(s.informe.equipos[0].fotos.presiones,'foto-p');
});

test('un informe firmado se reabre solo al confirmar y conserva el cierre anterior en el historial',()=>{
  const inf={...structuredClone(baseAC),resultado:'Completado',versionRemota:'r1',recepcionCliente:{nombre:'Cliente',fecha:'2026-11-26',firmaUrl:'firma-original'},finalizadoAt:123};
  let s=sesionDesdeInforme(inf);
  assert.equal(s.etapa,'reabrirConfirmar');
  assert.equal(editar(s,'Editar textos').informe.resultado,'Completado');
  s=editar(s,'Reabrir para editar');
  assert.equal(s.informe.resultado,null);assert.equal(s.informe.recepcionCliente,undefined);
  assert.equal(s.informe.historialCierres[0].recepcionCliente.firmaUrl,'firma-original');
  assert.equal(inf.recepcionCliente.firmaUrl,'firma-original');
});

test('el catálogo permite listar, abrir, cambiar de informe y continuar el anterior sin duplicarlo',async()=>{
  const a=soporte();await a.guardarRemoto({}, {id:baseAC.id,informe:baseAC,revision:'r1',base:'',pendiente:true});
  const actual=sesionDesdeInforme(await a.leerRemoto({},baseAC.id));
  const menu=await a.navegarInformes({},actual,'Menú');
  assert.equal(menu.sesion.pausada.informeId,baseAC.id);
  const lista=await a.navegarInformes({},menu.sesion,'Mis informes');
  assert.match(lista.texto,/INF-26-190/);
  assert.equal((await a.navegarInformes({},lista.sesion,'1')).sesion.informe.id,baseAC.id);
  assert.equal((await a.navegarInformes({},menu.sesion,'Continuar informe')).sesion.informe.id,baseAC.id);
  assert.equal((await a.navegarInformes({},null,'/abrir INF-26-999')).sesion.etapa,'buscarInforme');
});

test('sugiere y reserva el consecutivo compartido y rechaza un código ya existente',async()=>{
  const a=soporte();await a.guardarRemoto({}, {id:baseAC.id,informe:baseAC,revision:'r1',base:'',pendiente:true});
  let s=avanzar(null,'Aires acondicionados',null,tecnico,'bot').sesion;
  s=await a.sugerenciaInicial({},s);
  assert.equal(s.codigoSugerido,'INF-26-191');
  const duplicado=await a.procesarCodigo({},s,'INF-26-190','bot',randomUUID);
  assert.match(duplicado.texto,/ya existe/);assert.equal(duplicado.sesion.campo,0);
  const aceptado=await a.procesarCodigo({},s,'Usar INF-26-191','bot',randomUUID);
  s=avanzar(aceptado.sesion,aceptado.valor,null,tecnico,'bot').sesion;
  for(const v of ['Otro cliente','Otra sede','2026-11-26','Usar mi nombre'])s=avanzar(s,v,null,tecnico,'bot').sesion;
  assert.equal(s.informe.id,aceptado.sesion.idReservado);
  await guardar(a,s);
  assert.equal(await a.sugerirCodigo({},'26'),'INF-26-192');
});

test('la edición de fotos de alarma y generador conserva evidencias adicionales y el texto',()=>{
  for(const tipo of ['incendio','generador']) {
    const inf={id:tipo,codigo:'INF-26-200',tipo,sistemaIncendio:'alarma',resultado:null,versionRemota:'r1',elementos:[{id:'el1',kind:'extra',titulo:'Actividad',desc:'Texto conservado',fotos:[{url:'f1'},{url:'f2'},{url:'f3'}],obs:[],acc:[]}]};
    let s=sesionDesdeInforme(inf);s=editar(s,'Editar fotos');s=editar(s,'1');s=editar(s,'2');s=editar(s,'',{url:'foto nueva',pie:'Lectura'});
    assert.deepEqual(s.informe.elementos[0].fotos.map(f=>f.url),['f1','foto nueva','f3']);
    assert.equal(s.informe.elementos[0].desc,'Texto conservado');
  }
});

test('permite cambiar datos del informe sin alterar equipos ni códigos anteriores ya reservados',async()=>{
  const a=soporte();await a.guardarRemoto({}, {id:baseAC.id,informe:baseAC,revision:'r1',base:'',pendiente:true});
  let s=(await a.navegarInformes({},null,'/abrir INF-26-190')).sesion;
  s=editar(s,'Datos del informe');s=editar(s,'Código');
  const r=await a.procesarCodigo({},s,'INF-26-191','bot',randomUUID);
  s=editar(r.sesion,r.valor);await guardar(a,s);
  assert.equal(s.informe.codigo,'INF-26-191');
  assert.equal(s.informe.equipos[0].nombre,'AC original');
  await assert.rejects(a.reservarCodigo({},'INF-26-190','otro'),e=>e.code==='codigo-duplicado');
});

test('el catálogo pagina sin repetir resultados y un inicio incompleto se puede retomar',async()=>{
  const a=soporte();
  for(let n=1;n<=14;n++)a.documentos.set('informes/id-'+n,{id:'id-'+n,codigo:'INF-26-'+String(n).padStart(3,'0'),tipo:'ac',equipos:[],createdAt:n});
  const s={etapa:'datos',servicio:'ac',campo:2,datos:{codigo:'INF-26-015',propietario:'Cliente sin terminar'},base:'',pendiente:false};
  const primero=await a.navegarInformes({},s,'Mis informes');
  const segundo=await a.navegarInformes({},primero.sesion,'Más informes');
  assert.equal(primero.sesion.selecciones.length,12);assert.equal(segundo.sesion.selecciones.length,2);
  assert(!primero.sesion.selecciones.some(p=>segundo.sesion.selecciones.some(q=>p.id===q.id)));
  const continuar=await a.navegarInformes({},segundo.sesion,'Continuar informe');
  assert.equal(continuar.sesion.campo,2);assert.equal(continuar.sesion.datos.propietario,'Cliente sin terminar');
});

test('un informe eliminado no se recrea ni deja bloqueada la navegación para retomar',async()=>{
  const a=soporte();await a.guardarRemoto({}, {id:baseAC.id,informe:baseAC,revision:'r1',base:'',pendiente:true});
  const s=sesionDesdeInforme(await a.leerRemoto({},baseAC.id));
  await a.eliminarRemoto({},baseAC.id,'r1');
  const r=await a.navegarInformes({},s,'Retomar informe');
  assert.equal(r.sesion.etapa,'inicio');assert.match(r.texto,/ya no está disponible/);
  await assert.rejects(a.guardarRemoto({}, {id:baseAC.id,informe:baseAC,revision:'r2',base:'r1',pendiente:true},{exigirBase:true}),e=>e.code==='informe-eliminado');
});
