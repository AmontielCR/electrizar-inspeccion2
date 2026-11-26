import test from 'node:test';
import assert from 'node:assert/strict';
import { avanzar, pregunta, teclado, iniciaNuevaVisita } from '../bot/conversacion.mjs';
import { resumirSesion, identificadorEvento } from '../api/telegram.js';

const operario={uid:'tecnico-1',nombre:'Técnico Uno'};
function enviar(s,texto,foto) {
  const r=avanzar(s,texto,foto,operario,'bot-prueba');
  if(r.sesion?.pendiente){r.sesion.base=r.sesion.revision;r.sesion.pendiente=false;}
  return r.sesion;
}
function iniciar(servicio) {
  let s=enviar(null,'/nuevo');s=enviar(s,servicio);
  for(const valor of ['INF-26-200','Cliente de prueba','Sede y edificio','2026-11-26'])s=enviar(s,valor);
  if(servicio === 'Inspección eléctrica'){s=enviar(s,'/omitir');s=enviar(s,'/omitir');}
  else s=enviar(s,'Usar mi nombre');
  return s;
}
const foto=n=>({url:'data:image/jpeg;base64,FOTO'+n,pie:'Evidencia'});
function acEquipo(s,nombre='AC-01') {
  s=enviar(s,'Agregar equipo');
  for(const valor of [nombre,'Piso 1','Limpieza y medición registradas','Sin observaciones','Aprobado','Sin acciones'])s=enviar(s,valor);
  return s;
}

test('el selector ofrece cuatro servicios y respeta las sesiones antiguas de generador',()=>{
  const menu=enviar(null,'/nuevo');
  for(const texto of ['Generadores','Aires acondicionados','Alarmas contra incendio','Inspección eléctrica'])assert(teclado(menu).keyboard.flat().includes(texto));
  const antigua={etapa:'datos',campo:1,datos:{codigo:'INF-ANT'},indice:0,base:'',pendiente:false};
  const continuada=enviar(antigua,'Sede conservada');
  assert.equal(continuada.datos.codigo,'INF-ANT');
  assert.equal(continuada.campo,2);
  assert.equal(enviar(continuada,'/nuevo').pausada.campo,2);
  assert(iniciaNuevaVisita('Nuevo informe'));
});

test('AC guarda varios equipos con las cuatro claves de fotos usadas por la aplicación',()=>{
  let s=acEquipo(iniciar('Aires acondicionados'));
  assert.equal(s.etapa,'fotos');
  for(let i=0;i<4;i++)s=enviar(s,'',foto(i));
  assert.equal(s.etapa,'entre');
  assert.deepEqual(Object.keys(s.informe.equipos[0].fotos),['evaporadora','condensadora','tuberia','presiones']);
  assert.match(s.informe.equipos[0].observaciones,/Limpieza y medición/);
  s=acEquipo(s,'AC-02');
  for(let i=0;i<4;i++)s=enviar(s,'Siguiente');
  assert.equal(s.informe.equipos.length,2);
  assert.deepEqual(s.informe.equipos.map(eq=>eq.num),[1,2]);
  assert.equal(s.informe.tecnico,'Técnico Uno');
  s=enviar(s,'Revisar informe');
  assert.match(pregunta(s),/Registros con menos de 4 foto\(s\): 1/);
  s=enviar(s,'Entregar borrador');
  assert.equal(s.etapa,'cerrado');
  assert.equal(s.informe.resultado,null);
  assert.equal(s.informe.recepcionCliente,undefined);
  assert.match(pregunta(s),/firma del representante/);
});

test('AC no acepta aprobación inventada y exige acción si el equipo no fue aprobado',()=>{
  let s=enviar(iniciar('Aires acondicionados'),'Agregar equipo');
  for(const v of ['AC-X','Zona norte','Trabajo registrado','Fuga detectada'])s=enviar(s,v);
  assert.equal(enviar(s,'Todo bien').campoElemento,s.campoElemento);
  s=enviar(s,'No Aprobado');
  assert(!teclado(s).keyboard.flat().includes('Sin acciones'));
  assert.equal(enviar(s,'Sin acciones').campoElemento,s.campoElemento);
  s=enviar(s,'Revisar y reparar la fuga');
  assert.deepEqual(s.informe.equipos[0].acciones,['Revisar y reparar la fuga']);
});

test('alarmas registra actividades por zona con hallazgos, acciones y hasta dos fotos',()=>{
  let s=enviar(iniciar('Alarmas contra incendio'),'Agregar actividad');
  for(const v of ['Limpieza de detectores','Piso 2','No realizado','Acceso pendiente de coordinar','Detector dañado','Programar sustitución'])s=enviar(s,v);
  assert.equal(s.etapa,'fotos');
  s=enviar(s,'',foto(1));s=enviar(s,'',foto(2));s=enviar(s,'',foto(3));
  assert.equal(s.informe.elementos[0].fotos.length,2);
  s=enviar(s,'Siguiente');
  s=enviar(s,'Revisar informe');s=enviar(s,'Entregar borrador');
  assert.equal(s.informe.tipo,'incendio');
  assert.equal(s.informe.sistemaIncendio,'alarma');
  assert.match(s.informe.elementos[0].desc,/No realizado\nAcceso pendiente/);
  assert.deepEqual(s.informe.elementos[0].obs,['Detector dañado']);
  assert.deepEqual(s.informe.elementos[0].acc,['Programar sustitución']);
  assert.equal(s.informe.firmasIncendio,undefined);
  assert.equal(s.informe.resultado,null);
  assert.match(pregunta(s),/firma del técnico/);
});

test('inspección captura hallazgos y prioridad manual sin asignar ingeniero ni aprobar',()=>{
  let s=enviar(iniciar('Inspección eléctrica'),'Agregar elemento');
  for(const v of ['Tablero principal','Cuarto eléctrico','Conductor expuesto','Corregir conexión','Alta'])s=enviar(s,v);
  assert.equal(s.etapa,'fotos');
  s=enviar(s,'',foto(1));s=enviar(s,'Siguiente');
  s=enviar(s,'Revisar informe');s=enviar(s,'Entregar borrador');
  const el=s.informe.elementos[0];
  assert.equal(s.informe.tipo,'inspeccion');
  assert.equal(el.prioridad,'alta');
  assert.deepEqual(el.hallazgos,['Conductor expuesto']);
  assert.deepEqual(el.acciones,['Corregir conexión']);
  assert.equal(el.url,foto(1).url);
  assert.match(el.notas[0],/Cuarto eléctrico/);
  assert.equal(s.informe.ingeniero,'');
  assert.equal(s.informe.matricula,'');
  assert.equal(s.informe.resultado,null);
  assert.equal(s.informe.firma,undefined);
});

test('corregir un registro conserva fotos y no crea otro equipo, y metadatos actualizan cliente',()=>{
  let s=acEquipo(iniciar('Aires acondicionados'));
  for(let i=0;i<4;i++)s=enviar(s,'',foto(i));
  const antes=structuredClone(s.informe.equipos[0]);
  s=enviar(s,'Revisar informe');s=enviar(s,'Revisar registros');
  assert.equal(enviar(s,'99').etapa,'elegirRegistro');
  s=enviar(s,'1');s=enviar(s,'AC-Corregido');
  assert.equal(s.informe.equipos.length,1);
  assert.equal(s.informe.equipos[0].id,antes.id);
  assert.deepEqual(s.informe.equipos[0].fotos,antes.fotos);
  s=enviar(s,'Corregir datos');s=enviar(s,'Cliente');s=enviar(s,'Cliente corregido');
  assert.equal(s.informe.propietario,'Cliente corregido');
  assert.equal(s.etapa,'revision');
});

test('fotos omitidas, pendientes y ayuda no inventan información ni borran evidencias',()=>{
  let s=acEquipo(iniciar('Aires acondicionados'));
  s=enviar(s,'',foto(1));
  s=enviar(s,'Volver');
  assert.equal(s.indiceFoto,0);
  const antes=JSON.stringify(s.informe);
  assert.equal(JSON.stringify(enviar(s,'Ayuda').informe),antes);
  assert.equal(JSON.stringify(enviar(s,'Ver avance').informe),antes);
  const pendiente={...s,pendiente:true};
  assert.equal(avanzar(pendiente,'Siguiente',null,operario,'bot').sesion.indiceFoto,0);
  s=enviar(s,'Siguiente');
  assert.equal(s.informe.equipos[0].fotos.evaporadora,foto(1).url);
  s=enviar(s,'Revisar informe');
  assert.match(pregunta(s),/Registros con menos de 4/);
  assert.equal(s.informe.resultado,null);
});

test('las sesiones livianas no guardan imágenes y una nueva visita descarta el ID anterior',()=>{
  let s=acEquipo(iniciar('Aires acondicionados'));
  s=enviar(s,'',foto(1));
  const liviana=resumirSesion(s);
  assert(!JSON.stringify(liviana).includes(foto(1).url));
  s=enviar(s,'Revisar informe');s=enviar(s,'Entregar borrador');
  const nueva=enviar(resumirSesion(s),'Nuevo informe');
  assert.equal(nueva.etapa,'servicio');
  assert.equal(nueva.informeId,undefined);
  assert.equal(nueva.informe,undefined);
  assert.equal(enviar(nueva,'Alarmas contra incendio').servicio,'alarma');
});

test('fechas inválidas no avanzan y técnicos distintos mantienen IDs y autores separados',()=>{
  let s=enviar(null,'Aires acondicionados');
  for(const v of ['INF-X','Cliente','Sede'])s=enviar(s,v);
  assert.equal(enviar(s,'2026-02-31').campo,s.campo);
  s=enviar(s,'2026-11-26');
  const a=avanzar(s,'Usar mi nombre',null,operario,'bot',identificadorEvento(10)).sesion;
  const b=avanzar(s,'Usar mi nombre',null,{uid:'tecnico-2',nombre:'Técnico Dos'},'bot',identificadorEvento(11)).sesion;
  assert.notEqual(a.informe.id,b.informe.id);
  assert.equal(a.informe.telegramOperario,'tecnico-1');
  assert.equal(b.informe.telegramOperario,'tecnico-2');
});
