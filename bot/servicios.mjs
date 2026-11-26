// Captura guiada: produce las mismas estructuras que los formularios de la aplicación.
export const normalizar = valor => valor.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export const nombresServicios = {ac:'Aires acondicionados',alarma:'Alarmas contra incendio',inspeccion:'Inspección eléctrica'};
const comunes = [
  ['codigo','Código','Escribe el código asignado al informe. Ejemplo: INF-26-160.'],
  ['propietario','Cliente','Escribe el nombre del cliente o propietario.'],
  ['direccion','Sede','Indica sede, edificio y dirección. Ejemplo: BeeLiv, San José, edificio principal.'],
  ['fecha','Fecha','Escribe la fecha del trabajo en formato AAAA-MM-DD. Ejemplo: 2026-11-26.'],
];
const camposDatos = servicio => [...comunes,...(servicio === 'inspeccion' ? [
  ['ingeniero','Ingeniero','Indica el ingeniero responsable, si ya está asignado, o pulsa Omitir. No se asigna una aprobación automáticamente.'],
  ['matricula','Matrícula','Escribe la matrícula del ingeniero responsable o pulsa Omitir para completarla en la aplicación.'],
] : [['tecnico','Técnico','Confirma el nombre del técnico responsable. Puedes pulsar Usar mi nombre o escribirlo.']])];
const fotosAC = [
  ['evaporadora','Limpieza de evaporadora','Envía una foto de la limpieza de la unidad evaporadora.'],
  ['condensadora','Limpieza de condensadora','Envía una foto de la limpieza de la unidad condensadora.'],
  ['tuberia','Estado de tubería y aislante','Envía una foto del estado de la tubería y su aislamiento térmico.'],
  ['presiones','Presión de refrigerante','Envía la foto de la lectura del manómetro, si se realizó esta medición. No inventes lecturas ni realices pruebas fuera del alcance de la visita.'],
];
const camposRegistro = {
  ac:[
    ['nombre','Equipo','Escribe la identificación del equipo. Incluye marca y modelo si los conoces. Ejemplo: AC-01, sala de reuniones, marca y modelo de placa.'],
    ['ubicacion','Ubicación','¿En qué piso, oficina o zona está este equipo?'],
    ['trabajoTelegram','Trabajo realizado','Describe las actividades que realmente realizaste y las lecturas con su unidad, si las tienes.'],
    ['observacionesTelegram','Observaciones','Describe fallas, condiciones o pendientes. Si no hay observaciones adicionales, pulsa Sin observaciones.'],
    ['resultado','Resultado del equipo','Elige Aprobado, No Aprobado o Pendiente de revisión según tu evaluación. Esta elección no finaliza el informe.'],
    ['acciones','Acciones requeridas','Indica las correcciones o acciones recomendadas. Si aún deben definirse, escribe Pendiente de evaluación.'],
  ],
  alarma:[
    ['titulo','Actividad o componente','¿Qué actividad vas a documentar? Ejemplo: limpieza de detectores, piso 2. Registra las actividades reales del mantenimiento acordado.'],
    ['grupo','Piso o zona','Indica el piso, zona, circuito o ubicación de los componentes.'],
    ['estadoTelegram','Resultado de la actividad','Elige Realizado, No realizado o No aplica. Después describirás el resultado o motivo.'],
    ['detalleTelegram','Detalle del trabajo','Describe lo realizado y el resultado observado. Si no se realizó o no aplica, explica el motivo. Incluye identificación de los dispositivos cuando corresponda.'],
    ['obs','Hallazgos','Describe fallas, alarmas o situaciones observadas. Pulsa Sin observaciones si no hay hallazgos adicionales.'],
    ['acc','Acción recomendada','Indica la acción recomendada o escribe Pendiente de evaluación si aún no se ha definido.'],
  ],
  inspeccion:[
    ['titulo','Elemento inspeccionado','¿Qué elemento vas a documentar? Ejemplo: tablero principal, nivel 1. Puedes agregar tantos elementos como necesites.'],
    ['ubicacion','Ubicación','Indica el piso, zona y ubicación exacta del elemento.'],
    ['hallazgos','Hallazgos observados','Describe lo que observaste y las mediciones con unidad, si las tienes. Pulsa Sin hallazgos si no observaste hallazgos en este elemento. Esto no certifica el cumplimiento de la instalación.'],
    ['acciones','Acciones requeridas','Indica las acciones recomendadas para este elemento. Puedes escribir Pendiente de evaluación por el ingeniero.'],
    ['prioridad','Prioridad','Elige Alta, Normal o Baja según tu evaluación. El bot no determina la prioridad ni aprueba la instalación.'],
  ],
};
const nombreRegistro = s => s.servicio === 'ac' ? 'equipo' : s.servicio === 'alarma' ? 'actividad' : 'elemento';
const lista = s => s.servicio === 'ac' ? s.informe.equipos : s.informe.elementos;
const actual = s => lista(s)[s.indice];
const opcionalDato = campo => ['ingeniero','matricula'].includes(campo);
const sinDato = v => !v || !v.trim();
const contarFotos = (el,servicio) => servicio === 'ac' ? Object.values(el.fotos||{}).filter(Boolean).length : servicio === 'inspeccion' ? Number(!!el.url) : el.fotos?.length||0;
function pendientesRegistro(el,servicio) {
  if(servicio === 'ac') return !el.nombre || !el.ubicacion || !(el.trabajoTelegram||el.observaciones) || !el.resultado || el.resultado === 'No Aprobado' && !el.acciones?.length;
  if(servicio === 'alarma') return !el.titulo || !el.grupo || !(el.detalleTelegram||el.desc);
  return !el.titulo || (el.registroHallazgos===false || !Array.isArray(el.hallazgos)) || !el.prioridad;
}
function actualizarDatos(s) {
  Object.assign(s.informe,s.datos);
  if(s.servicio === 'alarma') Object.assign(s.informe,{
    tituloCorto:'Mantenimiento de Sistemas de Alarma contra Incendio',
    descripcion:`Sistemas de Alarma contra Incendio · Fecha de mantenimiento: ${s.datos.fecha} · Cliente: ${s.datos.propietario} · Técnico responsable: ${s.datos.tecnico}`,
  });
}
function actualizarRegistro(s) {
  const el = actual(s);
  if(s.servicio === 'ac') el.observaciones = [`Trabajo realizado: ${el.trabajoTelegram || 'Pendiente de registrar'}`,el.observacionesTelegram ? 'Observaciones: '+el.observacionesTelegram : ''].filter(Boolean).join('\n');
  if(s.servicio === 'alarma') el.desc = [`Resultado: ${el.estadoTelegram || 'Pendiente'}`,el.detalleTelegram || 'Detalle pendiente de registrar',el.obs.length ? 'Hallazgos: '+el.obs.join('; ') : '',el.acc.length ? 'Acciones recomendadas: '+el.acc.join('; ') : ''].filter(Boolean).join('\n');
  if(s.servicio === 'inspeccion') el.notas = [`Ubicación: ${el.ubicacion || 'Pendiente de registrar'}`,'Captura desde Telegram. Requiere revisión del ingeniero; sin aprobación automática.'];
}
function nuevoRegistro(s,uuid) {
  const base={id:uuid(),num:lista(s).length+1};
  const el = s.servicio === 'ac' ? {...base,nombre:'',ubicacion:'',fotos:{},resultado:'',acciones:[],observaciones:'',trabajoTelegram:'',observacionesTelegram:''}
    : s.servicio === 'alarma' ? {...base,kind:'extra',titulo:'',grupo:'',desc:'',fotos:[],obs:[],acc:[],estadoTelegram:'',detalleTelegram:''}
    : {...base,titulo:'',ubicacion:'',url:null,b64:null,hallazgos:[],acciones:[],notas:[],prioridad:'',registroHallazgos:false};
  lista(s).push(el); s.indice=lista(s).length-1;s.campoElemento=0;s.indiceFoto=0;s.etapa='registro';
}
function resumen(s) {
  const registros=lista(s), max=s.servicio === 'ac' ? 4 : s.servicio === 'alarma' ? 2 : 1;
  const pendientes=registros.filter(el=>pendientesRegistro(el,s.servicio)).length;
  const fotos=registros.reduce((n,el)=>n+contarFotos(el,s.servicio),0);
  const sinFotos=registros.filter(el=>contarFotos(el,s.servicio)<max).length;
  return `Revisión · ${nombresServicios[s.servicio]}\nCódigo: ${s.datos.codigo}\nCliente: ${s.datos.propietario}\nSede: ${s.datos.direccion}\nFecha: ${s.datos.fecha}\nResponsable: ${s.datos.tecnico || s.datos.ingeniero || 'Ingeniero pendiente de asignar'}\n\nRegistros: ${registros.length}\nRegistros con datos pendientes: ${pendientes}\nFotos: ${fotos}\nRegistros con menos de ${max} foto(s): ${sinFotos}\n${!registros.length ? 'El informe todavía no tiene equipos o elementos.\n' : ''}\n${registros.slice(0,12).map((el,i)=>`${i+1}. ${(el.nombre || el.titulo || 'Sin identificar').slice(0,70)} · ${contarFotos(el,s.servicio)} fotos`).join('\n')}${registros.length>12 ? '\nSe muestran los primeros 12. Puedes revisar cualquier registro por su número.' : ''}\n\nPuedes corregir los datos o revisar cada registro antes de entregar. Entregar borrador conserva también los pendientes; no aprueba ni finaliza el informe. ${cierre(s)}`;
}
function cierre(s) {
  return s.servicio === 'ac' ? 'En la aplicación debes revisar los equipos y capturar nombre, fecha y firma del representante del cliente.' : s.servicio === 'alarma' ? 'En la aplicación debes revisar las evidencias y completar nombre, fecha y firma del técnico y del representante del cliente antes de finalizar.' : 'El ingeniero debe revisar los hallazgos, asignar el resultado y completar el cierre y la firma en la aplicación.';
}
export function preguntaServicio(s) {
  const titulo=nombresServicios[s.servicio];
  if(s.etapa === 'datos' || s.etapa === 'editarDato') {
    const campos=camposDatos(s.servicio),i=s.etapa === 'editarDato' ? s.editarCampo : s.campo;
    const [clave,label,ayuda]=campos[i];
    return `${titulo} · ${s.etapa === 'editarDato' ? 'Corregir dato' : `Datos: paso ${i+1} de ${campos.length}`}\n${label}\n\n${ayuda}${s.datos[clave] ? '\nValor anterior: '+s.datos[clave] : ''}\n${s.etapa === 'datos' && i===0 ? 'El borrador se creará al completar estos datos iniciales. Responde un dato por mensaje.' : ''}`;
  }
  if(s.etapa === 'cerrado') return `Borrador de ${titulo} entregado. ${cierre(s)}\nPulsa Nuevo informe para otra visita.`;
  if(s.etapa === 'revision') return resumen(s);
  if(s.etapa === 'corregir') return '¿Qué dato quieres corregir? '+camposDatos(s.servicio).map(c=>c[1]).join(', ')+'.';
  if(s.etapa === 'elegirRegistro') return resumen(s)+'\n\nEscribe el número del registro que quieres revisar. Se conservan sus fotos. Usa Volver para regresar.';
  if(s.etapa === 'entre') return `${titulo} · ${s.datos.codigo}\n${lista(s).length} registro(s) en el borrador.\nPulsa Agregar ${nombreRegistro(s)} para documentar otro o Revisar informe para ver pendientes y entregar. ${cierre(s)}`;
  const el=actual(s),cabecera=`${titulo} · ${nombreRegistro(s)} ${s.indice+1}\n${el.nombre || el.titulo || 'Nuevo registro'}\n\n`;
  if(s.etapa === 'registro') {
    const [clave,label,ayuda]=camposRegistro[s.servicio][s.campoElemento];
    const previo=el[clave];
    return cabecera+`${label} · Paso ${s.campoElemento+1} de ${camposRegistro[s.servicio].length}\n${ayuda}${(clave === 'acciones' && el.resultado === 'Aprobado') || ['acc','acciones'].includes(clave) && !(el.obs?.length || el.hallazgos?.length) && s.servicio !== 'ac' ? '\nSi no hay acciones adicionales, pulsa Sin acciones.' : ''}${typeof previo === 'string' && previo ? '\nRespuesta anterior: '+previo : ''}`;
  }
  if(s.servicio === 'ac') {
    const [clave,label,ayuda]=fotosAC[s.indiceFoto];
    return cabecera+`Foto ${s.indiceFoto+1} de 4 · ${label}\n${ayuda}\nEnvía una foto de Telegram, no un archivo. ${el.fotos[clave] ? 'Ya hay una foto en este espacio: una nueva la reemplazará. Pulsa Siguiente para conservarla.' : 'Si no tienes esta evidencia, pulsa Siguiente; la ausencia se mostrará en la revisión.'}`;
  }
  return cabecera+(s.servicio === 'alarma' ? `Evidencias: ${el.fotos.length}/2 fotos. Envía una foto del componente y otra del resultado o prueba, según el trabajo realizado.` : `Evidencia: ${el.url ? '1/1 foto registrada. Una nueva foto reemplazará la anterior.' : 'Envía una foto clara del elemento o hallazgo. Puedes agregar otro elemento para documentar más fotos.'}`)+'\nEnvía como Foto de Telegram, no como archivo. Pulsa Siguiente cuando termines. Puedes continuar sin foto y revisarlo al cierre.';
}
export function tecladoServicio(s) {
  let filas=[];
  if(s.etapa === 'cerrado') filas=[['Nuevo informe','Ayuda']];
  else if(s.pendiente) filas=[['Reintentar','Ayuda']];
  else if(s.etapa === 'datos' || s.etapa === 'editarDato') {
    const campo=camposDatos(s.servicio)[s.etapa === 'editarDato' ? s.editarCampo : s.campo][0];
    filas=campo === 'tecnico' ? [['Usar mi nombre']] : opcionalDato(campo) ? [['Omitir']] : [];
    filas.push(['Volver']);
  } else if(s.etapa === 'entre') filas=[[`Agregar ${nombreRegistro(s)}`],['Revisar informe','Corregir datos']];
  else if(s.etapa === 'revision') filas=[['Entregar borrador'],[`Agregar ${nombreRegistro(s)}`],['Corregir datos','Revisar registros']];
  else if(s.etapa === 'corregir') filas=camposDatos(s.servicio).map(c=>[c[1]]).concat([['Volver']]);
  else if(s.etapa === 'registro') {
    const campo=camposRegistro[s.servicio][s.campoElemento][0];
    if(campo === 'resultado') filas=[['Aprobado','No Aprobado'],['Pendiente de revisión']];
    if(campo === 'estadoTelegram') filas=[['Realizado'],['No realizado','No aplica']];
    if(campo === 'prioridad') filas=[['Alta','Normal','Baja']];
    if(['obs','observacionesTelegram'].includes(campo)) filas=[['Sin observaciones']];
    if(campo === 'hallazgos') filas=[['Sin hallazgos']];
    if(['acciones','acc'].includes(campo)) {
      const permiteSinAcciones=s.servicio === 'ac' ? actual(s).resultado === 'Aprobado' : !(actual(s).obs?.length || actual(s).hallazgos?.length);
      filas=[['Pendiente de evaluación'],...(permiteSinAcciones ? [['Sin acciones']] : [])];
    }
    filas.push(['Volver','Revisar informe']);
  } else if(s.etapa === 'fotos') filas=[['Siguiente','Volver'],['Revisar informe']];
  else filas=[['Volver']];
  if(s.etapa !== 'cerrado' && !s.pendiente)filas.push(['Ver avance','Ayuda']);
  return {keyboard:filas,resize_keyboard:true,is_persistent:true,input_field_placeholder:'Responde la pregunta o elige un botón'};
}
export function nuevaSesionServicio(servicio) { return {servicio,etapa:'datos',campo:0,datos:{},indice:0,base:'',pendiente:false}; }
const comandos={ 'nuevo informe':'/nuevo', 'ver avance':'/avance', continuar:'/estado', ayuda:'/ayuda', volver:'/volver', omitir:'/omitir', siguiente:'/siguiente', 'revisar informe':'/resumen', 'corregir datos':'/corregir', 'revisar registros':'/registros', 'entregar borrador':'/finalizar', reintentar:'/reintentar', 'agregar equipo':'/agregar', 'agregar actividad':'/agregar', 'agregar elemento':'/agregar' };
export function avanzarServicio(anterior,texto,foto,operario,botUid,uuid) {
  const s=structuredClone(anterior),n=normalizar(texto),cmd=comandos[n] || n;
  const responder=(prefijo='')=>({sesion:s,texto:prefijo+preguntaServicio(s)});
  const cambio=(prefijo='')=>{s.revision=uuid();s.pendiente=true;return responder(prefijo);};
  if(['/estado','/start','/nuevo'].includes(cmd))return responder(cmd === '/nuevo' ? 'Continúa esta visita antes de iniciar otra.\n\n' : '');
  if(cmd === '/ayuda')return responder('Responde un dato por mensaje y espera la siguiente pregunta. Usa Volver para corregir sin borrar fotos, Ver avance para consultar y Revisar informe antes de entregar. En la aplicación completarás la revisión y las firmas.\n\n');
  if(cmd === '/avance')return responder(s.informe ? `${lista(s).length} registro(s) guardados en el borrador.\n\n` : 'Reuniendo datos iniciales; aún no se ha creado el informe.\n\n');
  if(cmd === '/reintentar')return responder('Comprobando el guardado.\n\n');
  if(s.pendiente)return responder('Hay un cambio pendiente de sincronizar. Usa Reintentar antes de continuar.\n\n');
  if(s.etapa === 'cerrado')return responder();
  if(cmd === '/volver') {
    if(s.etapa === 'datos')s.campo=Math.max(0,s.campo-1);
    else if(s.etapa === 'editarDato')s.etapa='corregir';
    else if(['corregir','elegirRegistro'].includes(s.etapa))s.etapa='revision';
    else if(s.etapa === 'fotos' && s.servicio === 'ac' && s.indiceFoto>0)s.indiceFoto--;
    else if(s.etapa === 'fotos'){s.etapa='registro';s.campoElemento=camposRegistro[s.servicio].length-1;}
    else if(s.etapa === 'registro' && s.campoElemento>0)s.campoElemento--;
    else s.etapa='entre';
    return responder();
  }
  if(['/resumen','/corregir','/registros','/agregar'].includes(cmd)) {
    if(!s.informe)return responder('Completa primero los datos iniciales.\n\n');
    if(cmd === '/agregar'){nuevoRegistro(s,uuid);return cambio();}
    s.etapa=cmd === '/resumen' ? 'revision' : cmd === '/corregir' ? 'corregir' : 'elegirRegistro';
    return responder();
  }
  if(s.etapa === 'corregir') {
    const i=camposDatos(s.servicio).findIndex(c=>normalizar(c[1])===n);
    if(i<0 || foto)return responder();
    s.editarCampo=i;s.etapa='editarDato';return responder();
  }
  if(s.etapa === 'elegirRegistro') {
    const i=/^\d+$/.test(n) ? Number(n)-1 : -1;
    if(i<0 || i>=lista(s).length || foto)return responder();
    s.indice=i;s.campoElemento=0;s.etapa='registro';return responder();
  }
  if(s.etapa === 'revision') {
    if(cmd !== '/finalizar' || foto)return responder();
    s.etapa='cerrado';return cambio();
  }
  if(s.etapa === 'datos' || s.etapa === 'editarDato') {
    const editar=s.etapa === 'editarDato', campos=camposDatos(s.servicio);
    const [campo]=campos[editar ? s.editarCampo : s.campo];
    if(foto || sinDato(texto) || cmd.startsWith('/') && !(cmd === '/omitir' && opcionalDato(campo)))return responder();
    let valor=cmd === '/omitir' ? '' : campo === 'tecnico' && n === 'usar mi nombre' ? operario.nombre : texto.trim();
    if(valor.length>(campo === 'direccion' ? 200 : 100))return responder('Resume el dato en hasta '+(campo === 'direccion' ? 200 : 100)+' caracteres.\n\n');
    if(campo === 'fecha' && (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(valor)) || new Date(valor).toISOString().slice(0,10)!==valor))return responder('Revisa la fecha; usa AAAA-MM-DD y una fecha válida.\n\n');
    s.datos[campo]=valor;
    if(editar){actualizarDatos(s);delete s.editarCampo;s.etapa='revision';return cambio('Dato actualizado.\n\n');}
    s.campo++;
    if(s.campo<campos.length)return responder();
    s.informe={...s.datos,id:s.idReservado || `tg_${botUid}_${uuid()}`,createdAt:Date.now(),tipo:s.servicio === 'alarma' ? 'incendio' : s.servicio,tecnico:s.datos.tecnico || operario.nombre,origenTelegram:true,telegramOperario:operario.uid,resultado:null,notas:''};
    if(s.servicio === 'ac')s.informe.equipos=[];
    else s.informe.elementos=[];
    if(s.servicio === 'alarma'){s.informe.sistemaIncendio='alarma';s.informe.resumen=[];}
    if(s.servicio === 'inspeccion'){s.informe.plazo='N/A';s.informe.notaInstalacion='';}
    actualizarDatos(s);s.etapa='entre';return cambio();
  }
  if(s.etapa === 'registro') {
    if(foto || sinDato(texto) || cmd.startsWith('/'))return responder();
    const el=actual(s),[campo]=camposRegistro[s.servicio][s.campoElemento];
    if(texto.trim().length>(['nombre','titulo','ubicacion','grupo'].includes(campo) ? 150 : 1500))return responder('La respuesta es demasiado larga. Usa hasta 150 caracteres para identificación o ubicación y hasta 1500 para detalles.\n\n');
    let valor=texto.trim();
    if(campo === 'resultado') {
      const valores={aprobado:'Aprobado','no aprobado':'No Aprobado','pendiente de revision':''};
      if(!(n in valores))return responder();valor=valores[n];
    }
    if(campo === 'estadoTelegram') {
      const valores={realizado:'Realizado','no realizado':'No realizado','no aplica':'No aplica'};
      if(!valores[n])return responder();valor=valores[n];
    }
    if(campo === 'prioridad'){if(!['alta','normal','baja'].includes(n))return responder();valor=n;}
    if(['obs','observacionesTelegram'].includes(campo) && n === 'sin observaciones')valor='';
    if(campo === 'hallazgos'){valor=n === 'sin hallazgos' ? '' : valor;el.registroHallazgos=true;}
    if(['acc','acciones'].includes(campo) && n === 'sin acciones') {
      if(s.servicio === 'ac' ? el.resultado !== 'Aprobado' : !!(el.obs?.length || el.hallazgos?.length))return responder('Indica la acción recomendada o escribe Pendiente de evaluación.\n\n');
      valor='';
    }
    el[campo]=['obs','acc','acciones','hallazgos'].includes(campo) ? valor ? [valor] : [] : valor;
    actualizarRegistro(s);s.campoElemento++;
    if(s.campoElemento===camposRegistro[s.servicio].length){s.etapa='fotos';s.indiceFoto=0;}
    return cambio();
  }
  if(s.etapa === 'fotos') {
    const el=actual(s);
    if(foto) {
      if(s.servicio === 'ac') {
        el.fotos[fotosAC[s.indiceFoto][0]]=foto.url;s.indiceFoto++;
        if(s.indiceFoto===fotosAC.length)s.etapa='entre';
      } else if(s.servicio === 'inspeccion')el.url=foto.url;
      else if(el.fotos.length<2)el.fotos.push(foto);
      else return responder('Ya hay dos fotos; se conservan ambas. Pulsa Siguiente.\n\n');
      return cambio('Foto recibida.\n\n');
    }
    if(cmd === '/siguiente') {
      if(s.servicio === 'ac' && ++s.indiceFoto<fotosAC.length)return responder();
      s.etapa='entre';return responder();
    }
    return responder();
  }
  return responder();
}
