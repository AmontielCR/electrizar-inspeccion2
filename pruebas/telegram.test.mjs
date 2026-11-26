import test from 'node:test';
import assert from 'node:assert/strict';
import { avanzar, pregunta, teclado } from '../bot/conversacion.mjs';
import { tareaCompleta } from '../src/checklists.ts';

const operario = { uid: 'usuario-prueba', nombre: 'Técnico de prueba' };
function entrada(sesion, texto, foto) { return avanzar(sesion, texto, foto, operario, 'bot-prueba'); }
function confirmar(sesion) {
  if (sesion.pendiente) { sesion.base = sesion.revision; sesion.pendiente = false; }
  return sesion;
}
function iniciar(plan = 'Energia') {
  let { sesion } = entrada(null, '/nuevo');
  for (const valor of ['INF-PRUEBA', 'Orokay II', 'C-01', '/omitir', '/omitir', '/omitir', '2026-11-11', plan]) {
    sesion = confirmar(entrada(sesion, valor).sesion);
  }
  return sesion;
}

test('los planes comparten las listas de la aplicación y generan un borrador identificable', () => {
  const energia = iniciar();
  const inspeccion = iniciar('Inspeccion');
  assert.equal(energia.informe.tipo, 'generador');
  assert.match(energia.informe.id, /^tg_bot-prueba_/);
  assert.equal(energia.informe.telegramOperario, operario.uid);
  assert(energia.informe.elementos.some(el => el.titulo === 'Cambio de filtros'));
  assert(!inspeccion.informe.elementos.some(el => el.titulo === 'Cambio de filtros'));
});

test('una visita pendiente de sincronizar conserva su revisión y exige reintentar', () => {
  const sesion = iniciar();
  const pendiente = entrada(sesion, 'Realizado').sesion;
  const antes = JSON.stringify(pendiente);
  const siguiente = entrada(pendiente, 'Texto que no se debe perder silenciosamente');
  assert.match(siguiente.texto, /reintentar/);
  assert.equal(JSON.stringify(siguiente.sesion), antes);
  assert.equal(entrada(pendiente, '/reintentar').sesion.revision, pendiente.revision);
});

test('las fotos quedan en su tarea, el modo final se confirma y el informe cierra con hallazgos', () => {
  let sesion = iniciar();
  while (sesion.etapa !== 'hallazgos') {
    if (sesion.etapa === 'estado') sesion = confirmar(entrada(sesion, 'Realizado').sesion);
    else if (sesion.etapa === 'detalle') sesion = confirmar(entrada(sesion, 'Resultado registrado por el técnico').sesion);
    else if (sesion.etapa === 'lectura') {
      const el = sesion.informe.elementos[sesion.indice];
      if (el.unidad) {
        const invalido = entrada(sesion, '0');
        assert.equal(invalido.sesion.etapa, 'lectura');
        sesion = confirmar(entrada(sesion, '9,5').sesion);
      } else sesion = confirmar(entrada(sesion, 'Manual').sesion);
    } else if (sesion.etapa === 'fotos') {
      if (sesion.indice === 0) sesion = confirmar(entrada(sesion, '', {url:'data:image/jpeg;base64,TEST', pie:'Antes'}).sesion);
      sesion = confirmar(entrada(sesion, '/siguiente').sesion);
    } else assert.fail('Etapa inesperada');
  }
  assert(sesion.informe.elementos.filter(el => el.requerido).every(tareaCompleta));
  assert.equal(sesion.informe.elementos[0].fotos.length, 1);
  assert.equal(sesion.informe.elementos[1].fotos.length, 0);
  assert.equal(sesion.informe.elementos.find(el => el.opciones).lectura, 'Manual');
  sesion = confirmar(entrada(sesion, 'Medidor de combustible dañado').sesion);
  sesion = confirmar(entrada(sesion, 'Programar sustitución del medidor').sesion);
  sesion = confirmar(entrada(sesion, '/finalizar').sesion);
  assert.equal(sesion.etapa, 'revision');
  sesion = confirmar(entrada(sesion, 'Entregar borrador').sesion);
  assert.equal(sesion.etapa, 'cerrado');
  assert(sesion.informe.elementos.at(-1).acc.includes('Programar sustitución del medidor'));
  assert.equal(entrada(sesion, '/nuevo').sesion.etapa, 'datos');
});

test('los botones guían los datos y Volver permite corregirlos sin reiniciar la visita', () => {
  let r = entrada(null,'Nuevo informe');
  assert.match(r.texto,/Paso 1 de 8/);
  let s = entrada(r.sesion,'INF-ORIGINAL').sesion;
  assert.match(pregunta(s),/BeeLiv/);
  s = entrada(s,'Sede original').sesion;
  s = entrada(s,'Volver').sesion;
  assert.equal(s.campo,1);
  assert.equal(s.datos.codigo,'INF-ORIGINAL');
  s = entrada(s,'Sede corregida').sesion;
  assert.equal(s.datos.direccion,'Sede corregida');
  const antes = JSON.stringify(s);
  assert.match(entrada(s,'Ayuda').texto,/un dato por mensaje/);
  assert.equal(JSON.stringify(entrada(s,'Ver avance').sesion),antes);
  assert(teclado(s).keyboard.flat().includes('Ayuda'));
});

test('corregir metadatos actualiza el informe y conserva fotos, actividades, ID y plan', () => {
  let s = iniciar();
  s.informe.elementos[0].fotos.push({url:'foto-conservada',pie:'Antes'});
  const id = s.informe.id;
  const tareasAntes = JSON.stringify(s.informe.elementos);
  s = entrada(s,'Corregir datos').sesion;
  s = entrada(s,'Código').sesion;
  s = confirmar(entrada(s,'INF-CORREGIDO').sesion);
  assert.equal(s.informe.codigo,'INF-CORREGIDO');
  assert.equal(s.informe.id,id);
  assert.equal(s.informe.plan,'energia');
  assert.equal(JSON.stringify(s.informe.elementos),tareasAntes);
  s = entrada(s,'Corregir datos').sesion;
  s = entrada(s,'Sede').sesion;
  s = confirmar(entrada(s,'Nueva sede').sesion);
  assert.equal(s.informe.propietario,'Nueva sede');
  assert.match(s.informe.descripcion,/Nueva sede/);
});

test('revisar una actividad y regresar conserva sus fotos y exige detallar No aplica', () => {
  let s = iniciar();
  s.informe.elementos[0].fotos.push({url:'foto-previa',pie:'Lectura'});
  s = entrada(s,'Revisar informe').sesion;
  s = entrada(s,'Revisar actividades').sesion;
  assert.equal(entrada(s,'99').sesion.etapa,'actividades');
  s = entrada(s,'1').sesion;
  s = confirmar(entrada(s,'No aplica').sesion);
  assert.equal(s.etapa,'detalle');
  assert.match(pregunta(s),/motivo/);
  s = confirmar(entrada(s,'Equipo fuera del alcance de esta visita').sesion);
  s = entrada(s,'Volver').sesion;
  assert.equal(s.etapa,'detalle');
  assert.equal(s.informe.elementos[0].fotos[0].url,'foto-previa');
  s = entrada(s,'Volver').sesion;
  assert.equal(s.etapa,'estado');
});

test('la entrega requiere revisión visible, informa pendientes y deja un borrador', () => {
  let s = iniciar();
  const r = entrada(s,'Revisar informe');
  assert.match(r.texto,/actividades pendientes/);
  assert.match(r.texto,/Actividades sin foto/);
  assert.equal(r.sesion.etapa,'revision');
  assert.equal(entrada(s,'Entregar borrador').sesion.etapa,'estado');
  s = confirmar(entrada(r.sesion,'Entregar borrador').sesion);
  assert.equal(s.etapa,'cerrado');
  assert.match(pregunta(s),/revisar evidencias/);
  assert.equal(s.informe.resultado,undefined);
});

test('los teclados de lectura usan opciones reales y los botones no se guardan como detalles', () => {
  let s = iniciar();
  s.indice = s.informe.elementos.findIndex(el => el.opciones);
  s.etapa = 'lectura';
  assert(teclado(s).keyboard.flat().includes('Automático'));
  s.etapa = 'detalle';
  s.informe.elementos[s.indice].estado = 'Realizado';
  assert.equal(entrada(s,'Ayuda').sesion.informe.elementos[s.indice].desc,'');
  const antes = JSON.stringify(s);
  const p = {...s,pendiente:true};
  assert.equal(entrada(p,'Volver').sesion.etapa,'detalle');
  assert(teclado(p).keyboard.flat().includes('Reintentar'));
  assert.equal(JSON.stringify(s),antes);
});

test('una observación agregada desde el resumen queda en hallazgos y exige una acción', () => {
  let s = iniciar();
  s = entrada(s,'Revisar informe').sesion;
  s = entrada(s,'Agregar observación').sesion;
  s = confirmar(entrada(s,'Se observa una fuga').sesion);
  assert.equal(entrada(s,'Revisar informe').sesion.etapa,'acciones');
  s = confirmar(entrada(s,'Pendiente de evaluación por el ingeniero').sesion);
  s = entrada(s,'Sin hallazgos').sesion;
  assert.equal(s.etapa,'revision');
  assert(s.informe.elementos.at(-1).obs.includes('Se observa una fuga'));
  assert(s.informe.elementos.at(-1).acc.includes('Pendiente de evaluación por el ingeniero'));
});

test('la visita no se reinicia por accidente y las fechas imposibles se rechazan', () => {
  let {sesion} = entrada(null, '/nuevo');
  for (const valor of ['INF-X', 'Sede', 'Equipo', '/omitir', '/omitir', '/omitir']) sesion = entrada(sesion, valor).sesion;
  assert.equal(entrada(sesion, '2026-02-31').sesion.campo, sesion.campo);
  assert.equal(entrada(sesion, '/nuevo').sesion.campo, sesion.campo);
});
