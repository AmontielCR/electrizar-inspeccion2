import { normalizar } from './servicios.mjs';
import { tareaCompleta } from '../src/checklists.ts';

export const esGestion = s => ['gestion','reabrirConfirmar','editarElegir','editarCampo','editarValor','fotoElegir','fotoEspacio','fotoEditar','fotoBorrar','datosElegir','datosValor'].includes(s?.etapa);
export const tipoServicio = inf => inf.tipo === 'incendio' && inf.sistemaIncendio === 'alarma' ? 'alarma' : ['ac','generador','inspeccion'].includes(inf.tipo) ? inf.tipo : null;
export const registros = s => s.servicio === 'ac' ? s.informe.equipos : s.informe.elementos;
const etiqueta = el => el?.nombre || el?.titulo || 'Sin identificar';
const fotos = (s,el) => s.servicio === 'ac' ? Object.entries(el.fotos||{}).filter(([,v])=>v).length : s.servicio === 'inspeccion' ? Number(!!el.url) : el.fotos?.length || 0;
const slotsAC=[['evaporadora','Evaporadora'],['condensadora','Condensadora'],['tuberia','Tubería'],['presiones','Presiones']];
export function sesionDesdeInforme(informe) {
  const servicio=tipoServicio(informe);
  if(!servicio)throw Object.assign(new Error('Este tipo de informe se edita desde la aplicación.'),{code:'tipo-no-admitido'});
  const datos={};
  for(const clave of ['codigo','propietario','direccion','fecha','tecnico','ingeniero','matricula','equipo','marca','modelo','potencia','plan'])datos[clave]=informe[clave]||'';
  return {servicio,etapa:informe.resultado || informe.firmaUrl || informe.firmasIncendio || informe.recepcionCliente ? 'reabrirConfirmar' : 'gestion',datos,informe,informeId:informe.id,base:informe.versionRemota||'',revision:informe.versionRemota||'',indice:0,pendiente:false};
}
function campos(s,el) {
  if(s.servicio === 'ac')return [['nombre','Nombre'],['ubicacion','Ubicación'],['observaciones','Trabajo y observaciones'],['resultado','Resultado'],['acciones','Acciones']];
  if(s.servicio === 'inspeccion')return [['titulo','Título'],['notas','Notas y ubicación'],['hallazgos','Hallazgos'],['acciones','Acciones'],['prioridad','Prioridad']];
  return el.kind === 'hallazgo' ? [['titulo','Título'],['grupo','Zona'],['obs','Hallazgos'],['acc','Acciones']] : [['titulo','Título'],['grupo','Zona'],['desc','Descripción completa'],...(el.requerido ? [['estado','Estado'],...(el.unidad || el.opciones ? [['lectura','Lectura']] : [])] : [])];
}
const metadatos=[['codigo','Código'],['propietario','Cliente'],['direccion','Sede'],['fecha','Fecha'],['tecnico','Técnico'],['ingeniero','Ingeniero'],['matricula','Matrícula'],['tituloInforme','Título del informe']];
function listaTexto(s) {
  const els=registros(s)||[],desde=s.paginaEdicion||0;
  return els.slice(desde,desde+12).map((el,i)=>`${desde+i+1}. ${etiqueta(el).slice(0,85)} · ${fotos(s,el)} foto(s)`).join('\n') || 'Todavía no hay registros. Puedes continuar llenando para agregarlos.';
}
export function preguntaGestion(s) {
  const inf=s.informe,el=registros(s)?.[s.indice],enc=`${inf.codigo} · ${inf.propietario || inf.tituloCorto || 'Informe'}\n\n`;
  if(s.etapa === 'reabrirConfirmar')return enc+'Este informe tiene cierre o recepción firmada. Para editarlo debe volver a borrador y se deben completar nuevamente sus firmas y aprobación. Se conservan los textos y fotos. Pulsa Reabrir para editar para confirmar, o Mis informes para buscar otro.';
  if(s.etapa === 'gestion')return enc+`${registros(s)?.length || 0} registro(s).\nElige Continuar llenando, Editar textos, Editar fotos o Datos del informe. Los cambios se guardan en este mismo informe.\nMis informes permite abrir otro sin borrar este borrador.`;
  if(['editarElegir','fotoElegir'].includes(s.etapa))return enc+listaTexto(s)+'\n\nEscribe el número del registro. Usa Más registros o Registros anteriores para recorrer la lista.';
  if(s.etapa === 'editarCampo')return enc+etiqueta(el)+'\n¿Qué campo deseas corregir? '+campos(s,el).map(c=>c[1]).join(', ')+'.';
  if(s.etapa === 'editarValor') {
    const [clave,label]=campos(s,el).find(c=>c[0]===s.campoEdicion),v=el[clave];
    return enc+`${etiqueta(el)} · ${label}\nValor actual:\n${Array.isArray(v)?v.join('\n'):v || '(Vacío)'}\n\nEnvía el texto corregido. Reemplazará solo este campo. Usa /vaciar para borrar un campo opcional o Volver para cancelar.`;
  }
  if(s.etapa === 'datosElegir')return enc+'¿Qué dato deseas corregir? '+metadatos.map(c=>c[1]).join(', ')+'.';
  if(s.etapa === 'datosValor')return enc+`Valor actual: ${inf[s.campoEdicion] || '(Vacío)'}\nEscribe el nuevo valor. ${s.campoEdicion==='codigo' ? 'Usa INF-AA-NNN. El consecutivo se comparte entre todos los servicios; se comprobará que no esté usado.' : 'Usa /vaciar solo para datos opcionales.'}`;
  if(s.etapa === 'fotoEspacio')return enc+etiqueta(el)+'\n'+(s.servicio==='ac' ? slotsAC.map(([,label],i)=>`${i+1}. ${label}`).join('\n') : s.servicio==='inspeccion' ? '1. Foto del elemento' : (el.fotos||[]).map((f,i)=>`${i+1}. Foto ${i+1} · ${f.pie || 'Evidencia'}`).join('\n')+'\nAgregar foto')+'\nElige una casilla o escribe el número de foto.';
  if(s.etapa === 'fotoBorrar')return enc+'¿Eliminar únicamente la foto seleccionada? Los textos y las demás fotos se conservan. Pulsa Confirmar eliminación o Volver.';
  return enc+`${etiqueta(el)} · ${s.servicio==='ac' ? slotsAC[s.fotoEdicion][1] : 'Foto '+(s.fotoEdicion+1)}\nEnvía la foto corregida como Foto de Telegram. Reemplazará únicamente esta casilla; las demás fotos se conservan. También puedes Eliminar foto o Volver.`;
}
export function tecladoGestion(s) {
  const el=registros(s)?.[s.indice];let filas;
  if(s.etapa==='reabrirConfirmar')filas=[['Reabrir para editar'],['Mis informes','Menú']];
  else if(s.etapa==='gestion')filas=[['Continuar llenando'],['Editar textos','Editar fotos'],['Datos del informe'],['Mis informes','Abrir por código'],['Nuevo informe']];
  else if(s.etapa==='editarCampo')filas=campos(s,el).map(c=>[c[1]]);
  else if(s.etapa==='datosElegir')filas=metadatos.map(c=>[c[1]]);
  else if(s.etapa==='fotoEspacio')filas=s.servicio==='ac' ? slotsAC.map(([,label])=>[label]) : s.servicio==='inspeccion' ? [['1']] : [['Agregar foto']];
  else if(s.etapa==='fotoEditar')filas=[['Eliminar foto']];
  else if(s.etapa==='fotoBorrar')filas=[['Confirmar eliminación']];
  else if(['editarElegir','fotoElegir'].includes(s.etapa))filas=[['Más registros','Registros anteriores']];
  else if(s.etapa==='editarValor' && s.campoEdicion==='resultado')filas=[['Aprobado','No Aprobado'],['Pendiente de revisión']];
  else if(s.etapa==='editarValor' && s.campoEdicion==='prioridad')filas=[['Alta','Normal','Baja']];
  else if(s.etapa==='editarValor' && s.campoEdicion==='estado')filas=[['Realizado'],['No realizado','No aplica']];
  else if(s.etapa==='datosValor' && s.campoEdicion==='codigo')filas=[['Sugerir código']];
  else filas=[];
  if(s.etapa!=='gestion')filas.push(['Volver','Retomar informe']);
  return {keyboard:filas,resize_keyboard:true,is_persistent:true};
}
export function avanzarGestion(anterior,texto,foto,uuid) {
  const s=structuredClone(anterior),n=normalizar(texto),el=registros(s)?.[s.indice];
  const respuesta=(prefijo='')=>({sesion:s,texto:prefijo+preguntaGestion(s)});
  const guardar=()=>{s.revision=uuid();s.pendiente=true;return respuesta('Cambio registrado.\n\n');};
  if(s.pendiente)return respuesta('Hay un guardado pendiente. Usa /reintentar.\n\n');
  if(s.etapa==='reabrirConfirmar') {
    if(n!=='reabrir para editar')return respuesta();
    const cierre={resultado:s.informe.resultado||null};
    for(const k of ['firmaUrl','firmasIncendio','recepcionCliente','finalizadoAt'])if(s.informe[k])cierre[k]=s.informe[k];
    s.informe.historialCierres=[...(s.informe.historialCierres||[]),cierre];
    s.informe.resultado=null;
    for(const k of ['firmaUrl','firmasIncendio','recepcionCliente','finalizadoAt'])delete s.informe[k];
    s.informe.reabiertoEnTelegram=true;s.etapa='gestion';return guardar();
  }
  if(['/estado','/ayuda','ayuda','/reintentar','/start'].includes(n))return respuesta();
  if(['retomar informe','/retomar'].includes(n)){s.etapa='gestion';return respuesta();}
  if(['volver','/volver'].includes(n)) {
    s.etapa=s.etapa==='editarValor'?'editarCampo':s.etapa==='fotoEditar'||s.etapa==='fotoBorrar'?'fotoEspacio':s.etapa==='datosValor'?'datosElegir':'gestion';return respuesta();
  }
  if(n==='continuar llenando') {
    if(s.servicio==='generador') {
      if(!registros(s).some(v=>v.kind==='hallazgo')){registros(s).push({id:uuid(),kind:'hallazgo',grupo:'',titulo:'Hallazgos encontrados',desc:'',fotos:[],obs:[],acc:[]});s.revision=uuid();s.pendiente=true;}
      s.indice=(registros(s)||[]).findIndex(v=>v.requerido && !tareaCompleta(v));
      if(s.indice<0){s.indice=Math.max(0,registros(s).findIndex(v=>v.kind==='hallazgo'));s.etapa='hallazgos';}
      else s.etapa='estado';
    } else s.etapa='entre';
    return {sesion:s,texto:'Continúa la captura. Usa los botones o Retomar informe para regresar a las correcciones.'};
  }
  if(['editar textos','editar fotos','datos del informe'].includes(n)) {
    s.etapa=n==='editar textos'?'editarElegir':n==='editar fotos'?'fotoElegir':'datosElegir';s.paginaEdicion=0;return respuesta();
  }
  if(['editarElegir','fotoElegir'].includes(s.etapa)) {
    if(n==='mas registros'){s.paginaEdicion=(s.paginaEdicion||0)+12;if(s.paginaEdicion>=registros(s).length)s.paginaEdicion=0;return respuesta();}
    if(n==='registros anteriores'){s.paginaEdicion=Math.max(0,(s.paginaEdicion||0)-12);return respuesta();}
    const i=/^\d+$/.test(n)?Number(n)-1:-1;
    if(i<0 || i>=registros(s).length || foto)return respuesta();
    s.indice=i;s.etapa=s.etapa==='editarElegir'?'editarCampo':'fotoEspacio';return respuesta();
  }
  if(s.etapa==='editarCampo' || s.etapa==='datosElegir') {
    const campo=(s.etapa==='editarCampo'?campos(s,el):metadatos).find(([,label])=>normalizar(label)===n);
    if(!campo || foto)return respuesta();s.campoEdicion=campo[0];s.etapa=s.etapa==='editarCampo'?'editarValor':'datosValor';return respuesta();
  }
  if(s.etapa==='editarValor' || s.etapa==='datosValor') {
    const clave=s.campoEdicion,esDato=s.etapa==='datosValor';
    const objeto=esDato?s.informe:el;
    const obligatorios=esDato?['codigo','propietario','fecha']:['nombre','titulo'];
    if(foto || !texto.trim() || texto.trim().length>(esDato?200:2000) || n.startsWith('/') && n!=='/vaciar')return respuesta('Revisa el texto y su longitud (datos: 200; detalle: 2000 caracteres).\n\n');
    if(n==='/vaciar' && obligatorios.includes(clave))return respuesta('Este campo no puede quedar vacío.\n\n');
    let v=n==='/vaciar'?'':texto.trim();
    if(clave==='fecha' && (!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))return respuesta('Escribe una fecha válida en formato AAAA-MM-DD.\n\n');
    if(clave==='prioridad'){if(!['alta','normal','baja'].includes(n))return respuesta();v=n;}
    if(clave==='resultado') {const opciones={aprobado:'Aprobado','no aprobado':'No Aprobado','pendiente de revision':''};if(!(n in opciones))return respuesta();v=opciones[n];}
    if(clave==='estado'){const opciones={realizado:'Realizado','no realizado':'No realizado','no aplica':'No aplica'};if(!opciones[n])return respuesta();v=opciones[n];}
    if(clave==='lectura' && el.opciones && !el.opciones.includes(v))return respuesta('Elige uno de estos valores: '+el.opciones.join(', ')+'.\n\n');
    if(clave==='lectura' && el.unidad && (!/^-?\d+(?:[.,]\d+)?$/.test(v)||el.unidad==='min'&&Number(v.replace(',','.'))<=0))return respuesta('Registra una lectura numérica válida.\n\n');
    const anterior=objeto[clave],accionesAntes=s.servicio==='ac'?(el.acciones||[]).join('; '):'';
    objeto[clave]=['acciones','hallazgos','notas','obs','acc'].includes(clave) ? v?[v]:[] : v;
    if(!esDato&&s.servicio==='ac'&&['acciones','resultado'].includes(clave)) {
      const linea='Acciones recomendadas: '+accionesAntes;
      el.observaciones=(el.observaciones||'').split('\n').filter(t=>!accionesAntes || t!==linea).join('\n');
    }
    if(esDato&&s.informe.descripcion&&anterior) {
      const etiquetas={fecha:['Fecha','Fecha de mantenimiento'],direccion:['Sede'],propietario:['Cliente'],tecnico:['Responsable','Técnico responsable']};
      s.informe.descripcion=s.informe.descripcion.split(' · ').map(parte=>(etiquetas[clave]||[]).some(label=>parte===label+': '+anterior)?parte.slice(0,parte.indexOf(':')+2)+v:parte).join(' · ');
    }
    if(esDato)s.datos[clave]=v;
    s.etapa=esDato?'gestion':'editarCampo';return guardar();
  }
  if(s.etapa==='fotoEspacio') {
    let i=s.servicio==='ac'?slotsAC.findIndex(([,label])=>normalizar(label)===n):-1;
    if(/^\d+$/.test(n))i=Number(n)-1;
    if(n==='agregar foto' && !['ac','inspeccion'].includes(s.servicio))i=(el.fotos||[]).length;
    const max=s.servicio==='ac'?4:s.servicio==='inspeccion'?1:(el.fotos||[]).length+1;
    if(i<0||i>=max||foto)return respuesta();s.fotoEdicion=i;s.etapa='fotoEditar';return respuesta();
  }
  if(s.etapa==='fotoEditar' && n==='eliminar foto'){s.etapa='fotoBorrar';return respuesta();}
  if(s.etapa==='fotoEditar' && foto || s.etapa==='fotoBorrar' && n==='confirmar eliminacion') {
    const borrar=s.etapa==='fotoBorrar',i=s.fotoEdicion;
    if(s.servicio==='ac'){el.fotos||={};if(borrar)delete el.fotos[slotsAC[i][0]];else el.fotos[slotsAC[i][0]]=foto.url;}
    else if(s.servicio==='inspeccion'){el.url=borrar?null:foto.url;el.b64=null;}
    else {el.fotos||=[];if(borrar)el.fotos.splice(i,1);else el.fotos[i]=foto;}
    s.etapa='fotoEspacio';return guardar();
  }
  return respuesta();
}
