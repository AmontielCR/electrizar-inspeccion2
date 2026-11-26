import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter, documentId } from 'firebase/firestore';
import { interpretarCodigo, sugerirCodigo, reservarCodigo, leerRemoto } from '../src/almacenRemoto.ts';
import { normalizar } from './servicios.mjs';
import { sesionDesdeInforme } from './gestion.mjs';

const textoMenu='Informes de Electrizar\nPulsa Mis informes para consultar los informes existentes, Abrir por código para buscar uno, Continuar informe para retomar tu captura o Nuevo informe para iniciar otra. Los informes guardados se conservan al cambiar de visita.';
export const esCatalogo=s=>['inicio','listaInformes','buscarInforme'].includes(s?.etapa);
export const tecladoCatalogo=s=>({keyboard:[['Continuar informe','Mis informes'],['Abrir por código','Nuevo informe'],...(s?.etapa==='listaInformes' ? [['Más informes','Primeros informes']] : []),['Menú']],resize_keyboard:true,is_persistent:true});
const ligera=s=>{if(!s)return null;const {informe,pausada,selecciones,...resto}=s;return {...resto,informeId:informe?.id||s.informeId||''};};
function menu(s,etapa='inicio') {return {etapa,base:'',pendiente:false,pausada:esCatalogo(s)?s.pausada||null:ligera(s),ultimaId:s?.informe?.id||s?.informeId||s?.ultimaId||s?.pausada?.informeId||''};}
async function listado(db,s,mas) {
  const nuevo=menu(s,'listaInformes'), cursor=mas?s.cursor:null;
  const condiciones=[orderBy('codigo','desc'),orderBy(documentId(),'desc'),...(cursor?[startAfter(cursor.codigo,cursor.id)]:[]),limit(12)];
  const docs=await getDocs(query(collection(db,'informes'),...condiciones));
  nuevo.selecciones=docs.docs.map(d=>({id:d.id,codigo:d.data().codigo||'',cliente:String(d.data().propietario||'').slice(0,60),tipo:d.data().tipo||''}));
  if(nuevo.selecciones.length){const ultimo=nuevo.selecciones.at(-1);nuevo.cursor={id:ultimo.id,codigo:ultimo.codigo};}
  else if(cursor)nuevo.cursor=cursor;
  return {sesion:nuevo,texto:'Informes existentes · todos los servicios\n'+nuevo.selecciones.map((d,i)=>`${i+1}. ${d.codigo} · ${d.cliente} · ${d.tipo}`).join('\n')+'\n\n'+(nuevo.selecciones.length?'Escribe el número para abrirlo. Más informes muestra los siguientes; también puedes Abrir por código.':'No hay más resultados. Pulsa Primeros informes o Abrir por código.')};
}
async function abrir(db,id) {
  try {const sesion=sesionDesdeInforme(await leerRemoto(db,id));return {sesion,texto:null};}
  catch(error){
    if(error.code==='not-found')return {sesion:{etapa:'inicio',base:'',pendiente:false},texto:'El informe ya no está disponible. Pulsa Mis informes o Abrir por código para buscar otro.'};
    if(error.code==='tipo-no-admitido')return {sesion:{etapa:'buscarInforme',base:'',pendiente:false},texto:'Este tipo se completa desde la aplicación. Desde Friday puedes editar AC, generadores, alarmas e inspecciones eléctricas. Escribe otro código o pulsa Menú.'};
    throw error;
  }
}
export async function navegarInformes(db,s,texto) {
  const n=normalizar(texto);
  if(['/nuevo','nuevo informe'].includes(n))return null;
  if(['/menu','menu'].includes(n))return {sesion:menu(s),texto:textoMenu};
  if(['/informes','mis informes','primeros informes'].includes(n))return listado(db,s,false);
  if(n==='mas informes'&&s?.etapa==='listaInformes')return listado(db,s,true);
  if(['/continuar','continuar informe','/retomar','retomar informe','/actualizar'].includes(n)) {
    if(s?.etapa==='datos'&&!s.informeId)return {sesion:s,texto:null};
    if(esCatalogo(s)&&s.pausada&&!s.pausada.informeId)return {sesion:s.pausada,texto:null};
    const id=s?.informeId||s?.informe?.id||s?.pausada?.informeId||s?.ultimaId;
    if(id)return abrir(db,id);
    if(s?.pausada)return {sesion:s.pausada,texto:null};
    if(s&&!esCatalogo(s))return {sesion:s,texto:null};
    return {sesion:menu(s),texto:'No hay una captura anterior seleccionada. Pulsa Mis informes o Abrir por código.'};
  }
  if(['/abrir','abrir por codigo'].includes(n))return {sesion:menu(s,'buscarInforme'),texto:'Escribe el código del informe que deseas continuar. Ejemplo: INF-26-190. También puedes enviar /abrir INF-26-190 directamente.'};
  if(n.startsWith('/abrir ')||s?.etapa==='buscarInforme') {
    const c=interpretarCodigo(n.startsWith('/abrir ')?texto.slice(7):texto);
    if(!c)return {sesion:menu(s,'buscarInforme'),texto:'Usa el formato INF-AA-NNN. Ejemplo: INF-26-190.'};
    const candidatos=await getDocs(query(collection(db,'informes'),where('codigo','==',c.codigo)));
    if(candidatos.docs.length===1)return abrir(db,candidatos.docs[0].id);
    if(candidatos.docs.length>1) {
      const nuevo=menu(s,'listaInformes');nuevo.selecciones=candidatos.docs.slice(0,12).map(d=>({id:d.id,codigo:c.codigo,cliente:String(d.data().propietario||'').slice(0,60),tipo:d.data().tipo||''}));
      return {sesion:nuevo,texto:'Hay informes anteriores con el mismo código. No se renumeraron. Selecciona cuál deseas revisar y corrige el código del duplicado:\n'+nuevo.selecciones.map((d,i)=>`${i+1}. ${d.codigo} · ${d.cliente}`).join('\n')};
    }
    const indice=await getDoc(doc(db,'codigosInforme',c.codigo));
    return {sesion:menu(s,'buscarInforme'),texto:indice.exists()?'Ese código está reservado o pertenece a un código anterior. Si aún no completaste los datos iniciales, pulsa Continuar informe. Usa Mis informes para encontrar el informe por su código actual.':'No encontré ese informe. Escribe otro código o pulsa Mis informes.'};
  }
  if(s?.etapa==='listaInformes'&&/^\d+$/.test(n)) {
    const candidato=s.selecciones?.[Number(n)-1];
    return candidato?abrir(db,candidato.id):{sesion:s,texto:'Selecciona uno de los números de esta página o pulsa Más informes.'};
  }
  if(esCatalogo(s))return {sesion:s,texto:textoMenu};
  return null;
}
export function pideCodigo(s) {
  if(!s || s.etapa==='servicio')return false;
  return s.etapa==='datosValor'&&s.campoEdicion==='codigo' || s.etapa==='datos'&&s.campo===0 || s.etapa==='editarDato'&&s.editarCampo===0;
}
export async function procesarCodigo(db,s,texto,botUid,uuid) {
  if(!pideCodigo(s))return null;
  const n=normalizar(texto);
  const controles=['/estado','/start','/ayuda','ayuda','ver avance','/avance','volver','/volver','retomar informe','/retomar','/reintentar','reintentar'];
  if(controles.includes(n))return null;
  if(n==='sugerir codigo'||n==='/sugerir')return {sesion:{...s,codigoSugerido:await sugerirCodigo(db)},texto:null};
  if(n.startsWith('/'))return null;
  const c=interpretarCodigo(texto.replace(/^usar\s+/i,''));
  if(!c)return {sesion:s,texto:'El código debe tener el formato INF-AA-NNN: INF indica Informe, AA es el año y NNN el consecutivo anual de todos los servicios. Ejemplo: INF-26-190.\nSugerido: '+(await sugerirCodigo(db))+'. Pulsa Sugerir código para seleccionarlo.'};
  const nuevo={...s},id=s.informe?.id||s.informeId||s.idReservado||`tg_${botUid}_${uuid()}`;
  try {await reservarCodigo(db,c.codigo,id);nuevo.idReservado=id;delete nuevo.codigoSugerido;return {sesion:nuevo,valor:c.codigo};}
  catch(error){if(error.code!=='codigo-duplicado')throw error;return {sesion:{...s,codigoSugerido:error.sugerido},texto:`${c.codigo} ya existe o está reservado. No se creó otro informe con ese código. Puedes abrirlo con /abrir ${c.codigo}, o usar el siguiente sugerido: ${error.sugerido}.`};}
}
export async function sugerenciaInicial(db,s) {
  if(pideCodigo(s)&&!s.codigoSugerido)return {...s,codigoSugerido:await sugerirCodigo(db)};
  return s;
}
