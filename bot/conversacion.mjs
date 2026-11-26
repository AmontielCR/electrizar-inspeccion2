import { randomUUID } from 'node:crypto';
import { crearElementos, tareaCompleta } from '../src/checklists.ts';
import { tareasGenerador, planesGenerador } from '../src/plantillaGeneradores.ts';

const campos = [
  ['codigo', 'Código del informe', 'Escribe el código asignado a esta visita. Ejemplo: INF-26-160.'],
  ['direccion', 'Sede y ubicación', '¿En qué sede está el generador? Incluye edificio y ubicación del equipo. Ejemplo: BeeLiv, sótano 1, cuarto de generadores.'],
  ['equipo', 'Identificación del equipo', 'Escribe el código o identificación del generador. Ejemplo: C-01.'],
  ['marca', 'Marca', 'Escribe la marca indicada en la placa del equipo. Si no está disponible, pulsa Omitir.'],
  ['modelo', 'Modelo', 'Escribe el modelo indicado en la placa. Si no está disponible, pulsa Omitir.'],
  ['potencia', 'Potencia', 'Escribe la potencia con su unidad. Ejemplo: 33 kW. Si no está disponible, pulsa Omitir.'],
  ['fecha', 'Fecha de mantenimiento', 'Escribe la fecha del trabajo en formato AAAA-MM-DD. Ejemplo: 2026-11-25.'],
  ['plan', 'Plan de mantenimiento', 'Elige el plan acordado para la visita:\n• Plan Inspección: revisiones, limpieza y arranque controlado.\n• Plan Energía: incluye cambios de filtros y aceite y pruebas adicionales.'],
];
const normalizar = texto => texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const actual = sesion => sesion.informe.elementos[sesion.indice];
const tareas = sesion => sesion.informe.elementos.filter(el => el.requerido);
const alias = { 'nuevo informe':'/nuevo', continuar:'/estado', 'ver avance':'/avance', ayuda:'/ayuda', volver:'/volver', omitir:'/omitir', siguiente:'/siguiente', 'revisar informe':'/resumen', 'corregir datos':'/corregir', 'revisar actividades':'/actividades', 'agregar observacion':'/observacion', 'entregar borrador':'/finalizar', 'sin hallazgos':'/ninguno', reintentar:'/reintentar', 'plan energia':'energia', 'plan inspeccion':'inspeccion' };

export function teclado(sesion) {
  let filas;
  if (!sesion || sesion.etapa === 'cerrado') filas = [['Nuevo informe', 'Ayuda']];
  else if (sesion.pendiente) filas = [['Reintentar', 'Ayuda']];
  else if (sesion.etapa === 'datos') filas = sesion.campo === 7 ? [['Plan Inspección', 'Plan Energía']] : [(['marca','modelo','potencia'].includes(campos[sesion.campo][0]) ? ['Omitir', 'Volver'] : ['Volver'])];
  else if (sesion.etapa === 'estado') filas = [['Realizado'], ['No realizado', 'No aplica'], ['Volver', 'Corregir datos']];
  else if (sesion.etapa === 'lectura' && sesion.informe && actual(sesion)?.opciones) filas = actual(sesion).opciones.map(opcion => [opcion]);
  else if (sesion.etapa === 'fotos') filas = [['Siguiente', 'Volver']];
  else if (sesion.etapa === 'hallazgos') filas = [['Sin hallazgos', 'Revisar informe']];
  else if (sesion.etapa === 'revision') filas = [['Entregar borrador'], ['Corregir datos', 'Revisar actividades'], ['Agregar observación']];
  else if (sesion.etapa === 'corregir') filas = [['Código', 'Sede', 'Equipo'], ['Marca', 'Modelo', 'Potencia'], ['Fecha', 'Volver']];
  else filas = [['Volver']];
  if (sesion && sesion.etapa !== 'cerrado' && !sesion.pendiente) filas.push(['Ver avance', 'Ayuda']);
  return { keyboard: filas, resize_keyboard:true, is_persistent:true, input_field_placeholder:'Responde la pregunta o elige un botón' };
}

function resumen(sesion) {
  const lista = tareas(sesion);
  const pendientes = lista.filter(el => !tareaCompleta(el)).length;
  const sinFotos = lista.filter(el => !el.fotos.length).length;
  const d = sesion.datos;
  return `Revisión del borrador · ${d.codigo}\nSede: ${d.direccion}\nEquipo: ${d.equipo} · ${d.marca || 'Marca sin indicar'} · ${d.modelo || 'Modelo sin indicar'}\nPotencia: ${d.potencia || 'Sin indicar'}\nFecha: ${d.fecha} · ${planesGenerador[d.plan]}\n\nActividades registradas: ${lista.length - pendientes}/${lista.length}\nFotos: ${sesion.informe.elementos.reduce((n,el) => n + el.fotos.length, 0)}\nActividades sin foto: ${sinFotos}\nHallazgos: ${sesion.informe.elementos.flatMap(el => el.obs).filter(v => v.trim()).length}\n\n${pendientes ? `Hay ${pendientes} actividades pendientes. Puedes revisarlas o entregar el borrador con esos pendientes.\n` : ''}${sinFotos ? 'Revisa si necesitas agregar evidencias a las actividades sin foto.\n' : ''}Pulsa Corregir datos o Revisar actividades para hacer cambios. Entregar borrador lo deja disponible para revisión en la aplicación; no genera un informe aprobado ni un PDF automáticamente.`;
}

export function pregunta(sesion) {
  if (sesion.etapa === 'datos') return `Datos del equipo · Paso ${sesion.campo + 1} de ${campos.length}\n${campos[sesion.campo][1]}\n\n${campos[sesion.campo][2]}${sesion.campo === 0 ? '\n\nPrimero reuniremos los datos y luego las actividades y fotos. Responde un dato por mensaje. El borrador del informe se crea al terminar los 8 datos.' : ''}${sesion.datos[campos[sesion.campo][0]] ? '\nRespuesta anterior: ' + sesion.datos[campos[sesion.campo][0]] : ''}`;
  if (sesion.etapa === 'cerrado') return 'Borrador entregado. Abre el historial de Electrizar para revisar evidencias, pendientes y generar el documento. Pulsa Nuevo informe para otra visita.';
  if (sesion.etapa === 'revision') return resumen(sesion);
  if (sesion.etapa === 'actividades') return '¿Qué actividad deseas revisar? Escribe su número. Conservaremos las fotos que ya enviaste.\n\n' + tareas(sesion).map((el,i) => `${i+1}. ${el.titulo} · ${el.estado || 'Pendiente'} · ${el.fotos.length} fotos`).join('\n') + '\n\nUsa Volver para regresar al resumen.';
  if (sesion.etapa === 'corregir') return 'Elige el dato que quieres corregir: Código, Sede, Equipo, Marca, Modelo, Potencia o Fecha.\nEl plan se conserva para mantener las actividades y las fotos de esta visita.';
  if (sesion.etapa === 'editarDato') return `Corregir ${campos[sesion.editarCampo][1]}\nValor actual: ${sesion.datos[campos[sesion.editarCampo][0]] || 'Sin indicar'}\n\n${campos[sesion.editarCampo][2]}\nUsa /omitir para dejar vacía la marca, modelo o potencia, o Volver para cancelar esta corrección.`;
  if (sesion.etapa === 'hallazgos') return 'Hallazgos adicionales\n¿Encontraste alguna falla o situación que deba quedar documentada? Describe qué observaste y dónde. No inventes resultados.\nEjemplo: fuga visible en la conexión de combustible.\nSi no hay más hallazgos, pulsa Sin hallazgos para revisar el borrador.';
  if (sesion.etapa === 'acciones') return 'Acción recomendada\n¿Qué acción recomiendas para el hallazgo que acabas de registrar?\nIndica la acción y prioridad si la conoces. Ejemplo: revisar la conexión y corregir la fuga antes de operar.\nSi aún no hay una acción definida, puedes escribir: Pendiente de evaluación por el ingeniero.';
  const el = actual(sesion);
  const encabezado = `Actividad ${sesion.indice + 1} de ${tareas(sesion).length} · ${el.titulo}\n\n`;
  if (sesion.etapa === 'estado') return encabezado + '¿Qué resultado tuvo esta actividad?\n• Realizado: se ejecutó el trabajo.\n• No realizado: quedó pendiente; indicaremos el motivo.\n• No aplica: no corresponde a este equipo o visita; indicaremos el motivo.\nElige un botón.';
  if (sesion.etapa === 'detalle') return encabezado + (el.estado === 'Realizado'
    ? (el.indicacion || 'Describe qué hiciste y en qué condición quedó el componente.') + '\nRegistra solo lo observado. Incluye lecturas con unidad cuando las tengas.' : `Elegiste ${el.estado}. Explica el motivo y, si corresponde, qué quedó pendiente.`) + (el.desc ? '\nRespuesta anterior: ' + el.desc : '');
  if (sesion.etapa === 'lectura') return encabezado + (el.opciones
    ? 'Selecciona el modo final: ' + el.opciones.join(', ') + '.'
    : `¿Cuál fue la duración real en ${el.unidad}? Escribe solo el número.`);
  return encabezado + `Evidencia fotográfica · ${el.fotos.length}/2 recibidas\nEnvía las fotos como Foto de Telegram, no como archivo. Incluye una vista clara del componente y, cuando corresponda, el resultado o la lectura. Puedes indicar Antes, Después o Lectura en el pie de foto.\nNo fotografíes equipos si hacerlo requiere una maniobra insegura.\n${el.fotos.length >= 2 ? 'Ya recibí las dos fotos. Pulsa Siguiente.' : 'Cuando termines, pulsa Siguiente. Puedes continuar sin fotos; aparecerá en la revisión final.'}`;
}

function cambiar(sesion, uuid) {
  if (sesion.informe) {
    sesion.revision = uuid();
    sesion.pendiente = true;
  }
}

export function avanzar(previamente, texto, foto, operario, botUid, uuid = randomUUID) {
  const sesion = previamente ? structuredClone(previamente) : null;
  const comando = alias[normalizar(texto)] || normalizar(texto);
  if (comando === '/nuevo') {
    if (sesion && sesion.etapa !== 'cerrado') return { sesion, texto: 'Ya hay una visita abierta; continuemos sin perder lo registrado.\n\n' + pregunta(sesion) };
    const nueva = { etapa: 'datos', campo: 0, datos: {}, indice: 0, base: '', pendiente: false };
    return { sesion: nueva, texto: pregunta(nueva) };
  }
  if (!sesion) return { sesion, texto: 'Bienvenido a Electrizar. Te guiaré para crear un borrador de mantenimiento de generador: datos del equipo, actividades, fotos y revisión final.\nPulsa Nuevo informe para comenzar. Puedes escribir /id para consultar tu identificación.' };
  if (comando === '/estado' || comando === '/start') return { sesion, texto: pregunta(sesion) };
  if (comando === '/ayuda') return { sesion, texto: 'Cómo continuar\nResponde un dato por mensaje y espera mi siguiente pregunta. Usa los botones del teclado; si están ocultos, abre el teclado de botones de Telegram.\n\nVer avance: muestra dónde estás sin cambiar respuestas.\nVolver: regresa para corregir conservando las fotos.\nCorregir datos: modifica la identificación del informe ya creado.\nRevisar informe: muestra pendientes antes de entregar.\nReintentar: vuelve a comprobar un guardado pendiente.\n\nPor ahora puedo guiar mantenimientos de generadores. La revisión y el PDF se hacen en la aplicación.\n\n' + pregunta(sesion) };
  if (comando === '/avance') return { sesion, texto: (sesion.informe ? `Avance · ${sesion.datos.codigo}\n${tareas(sesion).filter(tareaCompleta).length}/${tareas(sesion).length} actividades registradas · ${sesion.informe.elementos.reduce((n,el) => n + el.fotos.length,0)} fotos\n\n` : 'Estamos reuniendo los datos iniciales; todavía no se ha creado el informe.\n\n') + pregunta(sesion) };
  if (comando === '/reintentar') return { sesion, texto: 'Comprobando el guardado.' };
  if (sesion.pendiente) return { sesion, texto: 'El último cambio está pendiente de sincronizar. Usa /reintentar antes de continuar.' };
  if (sesion.etapa === 'cerrado') return { sesion, texto: pregunta(sesion) };
  if (comando === '/volver') {
    if (sesion.etapa === 'datos') sesion.campo = Math.max(0, sesion.campo - 1);
    else if (sesion.etapa === 'editarDato') sesion.etapa = 'corregir';
    else if (['corregir','actividades'].includes(sesion.etapa)) sesion.etapa = 'revision';
    else if (sesion.etapa === 'revision') sesion.etapa = 'hallazgos';
    else if (sesion.etapa === 'acciones') return {sesion, texto:'Primero registra una acción para este hallazgo. Puedes indicar que queda pendiente de evaluación.\n\n' + pregunta(sesion)};
    else if (sesion.etapa === 'detalle') sesion.etapa = 'estado';
    else if (sesion.etapa === 'lectura') sesion.etapa = 'detalle';
    else if (sesion.etapa === 'fotos') sesion.etapa = actual(sesion).estado === 'Realizado' && (actual(sesion).unidad || actual(sesion).opciones) ? 'lectura' : 'detalle';
    else if (sesion.etapa === 'hallazgos' || sesion.etapa === 'estado' && sesion.indice > 0) {
      sesion.indice = Math.min(tareas(sesion).length-1, Math.max(0,sesion.indice-1));
      sesion.etapa = 'fotos';
    } else return {sesion,texto:'Estás en la primera actividad. Usa /corregir para cambiar los datos del informe.\n\n'+pregunta(sesion)};
    return {sesion,texto:pregunta(sesion)};
  }
  if (['/resumen','/corregir','/actividades','/observacion'].includes(comando)) {
    if (!sesion.informe) return {sesion,texto:'Primero completa los datos iniciales. Puedes usar Volver para corregirlos.\n\n'+pregunta(sesion)};
    if (sesion.etapa === 'acciones') return {sesion,texto:'Completa la acción del hallazgo antes de revisar el informe.\n\n'+pregunta(sesion)};
    sesion.etapa = comando === '/resumen' ? 'revision' : comando === '/corregir' ? 'corregir' : comando === '/observacion' ? 'hallazgos' : 'actividades';
    return {sesion,texto:pregunta(sesion)};
  }
  if (sesion.etapa === 'corregir') {
    const indices = {codigo:0,sede:1,equipo:2,marca:3,modelo:4,potencia:5,fecha:6};
    if (indices[comando] === undefined || foto) return {sesion,texto:pregunta(sesion)};
    sesion.editarCampo = indices[comando];
    sesion.etapa = 'editarDato';
    return {sesion,texto:pregunta(sesion)};
  }
  if (sesion.etapa === 'actividades') {
    const indice = /^\d+$/.test(comando) ? Number(comando)-1 : -1;
    if (foto || indice < 0 || indice >= tareas(sesion).length) return {sesion,texto:pregunta(sesion)};
    sesion.indice = indice;
    sesion.etapa = 'estado';
    return {sesion,texto:pregunta(sesion)};
  }
  if (sesion.etapa === 'revision') {
    if (comando !== '/finalizar' || foto) return {sesion,texto:pregunta(sesion)};
    sesion.etapa = 'cerrado';
    cambiar(sesion,uuid);
    return {sesion,texto:pregunta(sesion)};
  }
  if (sesion.etapa === 'datos' || sesion.etapa === 'editarDato') {
    const editando = sesion.etapa === 'editarDato';
    const [campo] = campos[editando ? sesion.editarCampo : sesion.campo];
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
    if (editando) {
      const d = sesion.datos;
      Object.assign(sesion.informe,d,{propietario:d.direccion,tituloCorto:`Mantenimiento de generador ${d.equipo}`,
        descripcion:[planesGenerador[d.plan],`Sede: ${d.direccion}`,`Fecha: ${d.fecha}`,d.marca,d.modelo,d.potencia,`Responsable: ${sesion.informe.tecnico}`].filter(Boolean).join(' · ')});
      delete sesion.editarCampo;
      sesion.etapa = 'revision';
      cambiar(sesion,uuid);
      return {sesion,texto:'Dato actualizado.\n\n'+pregunta(sesion)};
    }
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
    if (texto.trim().length > 1500) return {sesion,texto:'Resume el detalle en hasta 1500 caracteres.\n\n'+pregunta(sesion)};
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
      sesion.etapa = 'revision';
    } else if (texto.trim() && !comando.startsWith('/') && !foto) {
      if (texto.trim().length > 1500) return {sesion,texto:'Resume el hallazgo en hasta 1500 caracteres.'};
      sesion.informe.elementos.find(el => el.kind === 'hallazgo').obs.push(texto.trim());
      sesion.etapa = 'acciones';
    } else return { sesion, texto: pregunta(sesion) };
  } else if (sesion.etapa === 'acciones') {
    if (!texto.trim() || comando.startsWith('/') || foto) return { sesion, texto: pregunta(sesion) };
    if (texto.trim().length > 1500) return {sesion,texto:'Resume la acción en hasta 1500 caracteres.'};
    sesion.informe.elementos.find(el => el.kind === 'hallazgo').acc.push(texto.trim());
    sesion.etapa = 'hallazgos';
  }
  cambiar(sesion, uuid);
  return { sesion, texto: pregunta(sesion) };
}
