import test from 'node:test';
import assert from 'node:assert/strict';
import { avanzar } from '../bot/conversacion.mjs';
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
  assert.equal(sesion.etapa, 'cerrado');
  assert(sesion.informe.elementos.at(-1).acc.includes('Programar sustitución del medidor'));
  assert.equal(entrada(sesion, '/nuevo').sesion.etapa, 'datos');
});

test('la visita no se reinicia por accidente y las fechas imposibles se rechazan', () => {
  let {sesion} = entrada(null, '/nuevo');
  for (const valor of ['INF-X', 'Sede', 'Equipo', '/omitir', '/omitir', '/omitir']) sesion = entrada(sesion, valor).sesion;
  assert.equal(entrada(sesion, '2026-02-31').sesion.campo, sesion.campo);
  assert.equal(entrada(sesion, '/nuevo').sesion.campo, sesion.campo);
});
