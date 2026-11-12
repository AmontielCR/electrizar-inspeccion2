import { randomUUID } from 'node:crypto';
import { crearElementos, tareaCompleta } from '../src/checklists.ts';
import { tareasGenerador, planesGenerador } from '../src/plantillaGeneradores.ts';

const campos = [
  ['codigo', 'Escribe el código del informe, por ejemplo INF-26-160.'],
  ['direccion', '¿En qué sede está el generador?'],
  ['equipo', 'Escribe el código del generador, por ejemplo C-01.'],
  ['marca', 'Escribe la marca o /omitir si no la tienes.'],
  ['modelo', 'Escribe el modelo o /omitir.'],
  ['potencia', 'Escribe la potencia con su unidad, por ejemplo 33 kW, o /omitir.'],
  ['fecha', 'Escribe la fecha del mantenimiento con el formato AAAA-MM-DD.'],
  ['plan', 'Selecciona el plan escribiendo Energia o Inspeccion.'],
];
const normalizar = texto => texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const actual = sesion => sesion.informe.elementos[sesion.indice];
export function pregunta(sesion) {
  if (sesion.etapa === 'datos') return campos[sesion.campo][1];
  if (sesion.etapa === 'cerrado') return 'Borrador entregado. Abre el historial de Electrizar para revisarlo. Escribe /nuevo para otra visita.';
  if (sesion.etapa === 'hallazgos') return '¿Encontraste alguna falla? Escríbela o usa /ninguno.';
  if (sesion.etapa === 'acciones') return '¿Qué acción recomiendas para ese hallazgo?';
  const el = actual(sesion);
  const encabezado = `${sesion.indice + 1}. ${el.titulo}\n`;
  if (sesion.etapa === 'estado') return encabezado + 'Responde Realizado, No realizado o No aplica.';
  if (sesion.etapa === 'detalle') return encabezado + (el.estado === 'Realizado'
    ? el.indicacion || 'Describe el trabajo realizado.' : 'Indica el motivo.');
  if (sesion.etapa === 'lectura') return encabezado + (el.opciones
    ? 'Selecciona el modo final: ' + el.opciones.join(', ') + '.'
    : `¿Cuál fue la duración real en ${el.unidad}? Escribe solo el número.`);
  return encabezado + `Envía hasta dos fotos de esta tarea (${el.fotos.length}/2 recibidas). Después escribe /siguiente. Puedes usar el pie de foto para indicar Antes, Después o Lectura.`;
}

function cambiar(sesion, uuid) {
  if (sesion.informe) {
    sesion.revision = uuid();
    sesion.pendiente = true;
  }
}

export function avanzar(previamente, texto, foto, operario, botUid, uuid = randomUUID) {
  const sesion = previamente ? structuredClone(previamente) : null;
  const comando = normalizar(texto);
  if (comando === '/nuevo') {
    if (sesion && sesion.etapa !== 'cerrado') return { sesion, texto: 'Ya hay una visita abierta. Usa /estado para retomarla.' };
    const nueva = { etapa: 'datos', campo: 0, datos: {}, indice: 0, base: '', pendiente: false };
    return { sesion: nueva, texto: pregunta(nueva) };
  }
  if (!sesion) return { sesion, texto: 'Escribe /nuevo para iniciar un mantenimiento de generador.' };
  if (comando === '/estado' || comando === '/start') return { sesion, texto: pregunta(sesion) };
  if (comando === '/reintentar') return { sesion, texto: 'Comprobando el guardado.' };
  if (sesion.pendiente) return { sesion, texto: 'El último cambio está pendiente de sincronizar. Usa /reintentar antes de continuar.' };
  if (sesion.etapa === 'cerrado') return { sesion, texto: pregunta(sesion) };
  if (sesion.etapa === 'datos') {
    const [campo] = campos[sesion.campo];
    if (!texto.trim() || foto) return { sesion, texto: pregunta(sesion) };
    if (comando.startsWith('/') && comando !== '/omitir') return { sesion, texto: pregunta(sesion) };
    if (comando === '/omitir' && !['marca', 'modelo', 'potencia'].includes(campo)) return { sesion, texto: 'Este dato es obligatorio.\n' + pregunta(sesion) };
    let valor = texto.trim();
    const maximo = campo === 'direccion' ? 200 : 100;
    if (valor.length > maximo) return { sesion, texto: `Usa hasta ${maximo} caracteres para este dato.\n` + pregunta(sesion) };
    if (campo === 'fecha' && (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(valor)) || new Date(valor).toISOString().slice(0,10) !== valor)) {
      return { sesion, texto: 'Revisa la fecha. Usa AAAA-MM-DD.' };
    }
    if (campo === 'plan') {
      valor = comando;
      if (!planesGenerador[valor]) return { sesion, texto: pregunta(sesion) };
    }
    sesion.datos[campo] = comando === '/omitir' ? '' : valor;
    sesion.campo++;
    if (sesion.campo === campos.length) {
      const d = sesion.datos;
      sesion.informe = {
        ...d, id: `tg_${botUid}_${uuid()}`, createdAt: Date.now(), tipo: 'generador',
        propietario: d.direccion, tecnico: operario.nombre, origenTelegram: true, telegramOperario: operario.uid,
        tituloCorto: `Mantenimiento de generador ${d.equipo}`,
        descripcion: [planesGenerador[d.plan], `Sede: ${d.direccion}`, `Fecha: ${d.fecha}`, d.marca, d.modelo, d.potencia, `Responsable: ${operario.nombre}`].filter(Boolean).join(' · '),
        checklistVersion: 1, elementos: crearElementos(tareasGenerador[d.plan], ['']), resumen: [],
      };
      sesion.etapa = 'estado';
      cambiar(sesion, uuid);
    }
    return { sesion, texto: pregunta(sesion) };
  }
  if (sesion.etapa === 'estado') {
    const opciones = { realizado: 'Realizado', 'no realizado': 'No realizado', 'no aplica': 'No aplica' };
    if (!opciones[comando] || foto) return { sesion, texto: pregunta(sesion) };
    actual(sesion).estado = opciones[comando];
    sesion.etapa = 'detalle';
  } else if (sesion.etapa === 'detalle') {
    if (!texto.trim() || comando.startsWith('/') || foto) return { sesion, texto: pregunta(sesion) };
    const el = actual(sesion);
    el.desc = texto.trim();
    sesion.etapa = el.estado === 'Realizado' && (el.unidad || el.opciones) ? 'lectura' : 'fotos';
  } else if (sesion.etapa === 'lectura') {
    const el = actual(sesion);
    el.lectura = el.opciones ? el.opciones.find(opcion => normalizar(opcion) === comando) || '' : texto.trim();
    if (foto || !tareaCompleta(el)) return { sesion: previamente, texto: 'Revisa el valor.\n' + pregunta(previamente) };
    sesion.etapa = 'fotos';
  } else if (sesion.etapa === 'fotos') {
    const el = actual(sesion);
    if (foto && el.fotos.length < 2) el.fotos.push(foto);
    else if (comando === '/siguiente') {
      if (!tareaCompleta(el)) return { sesion, texto: 'Falta completar el resultado de esta tarea.' };
      sesion.indice++;
      sesion.etapa = actual(sesion)?.requerido ? 'estado' : 'hallazgos';
    } else return { sesion, texto: pregunta(sesion) };
  } else if (sesion.etapa === 'hallazgos') {
    if (comando === '/ninguno' || comando === '/finalizar') {
      sesion.etapa = 'cerrado';
    } else if (texto.trim() && !comando.startsWith('/') && !foto) {
      actual(sesion).obs.push(texto.trim());
      sesion.etapa = 'acciones';
    } else return { sesion, texto: pregunta(sesion) };
  } else if (sesion.etapa === 'acciones') {
    if (!texto.trim() || comando.startsWith('/') || foto) return { sesion, texto: pregunta(sesion) };
    actual(sesion).acc.push(texto.trim());
    sesion.etapa = 'hallazgos';
  }
  cambiar(sesion, uuid);
  return { sesion, texto: pregunta(sesion) };
}
