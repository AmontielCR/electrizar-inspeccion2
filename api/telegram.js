import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { conectarFirebase } from '../bot/firebase.mjs';
import { avanzar, teclado, iniciaNuevaVisita, pregunta } from '../bot/conversacion.mjs';
import { guardarRemoto, leerRemoto } from '../src/almacenRemoto.ts';

import { navegarInformes, procesarCodigo, sugerenciaInicial, pideCodigo } from '../bot/catalogo.mjs';
import { sesionDesdeInforme } from '../bot/gestion.mjs';

let conexion;
async function conectar() {
  conexion ??= conectarFirebase(process.env.FIREBASE_BOT_EMAIL, process.env.FIREBASE_BOT_PASSWORD)
    .catch(error => { conexion = undefined; throw error; });
  return conexion;
}
async function telegram(metodo, datos) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/${metodo}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
    signal: AbortSignal.timeout(15_000),
  });
  const contenido = await response.json();
  if (!response.ok || !contenido.ok) throw new Error('Telegram no confirmó la operación.');
  return contenido.result;
}

export function resumirSesion(sesion) {
  if (!sesion) return null;
  const { informe, ...datos } = sesion;
  return { ...datos, informeId: informe?.id || sesion.informeId || '' };
}

export function identificadorEvento(updateId) {
  let secuencia = 0;
  return () => {
    const hash = createHash('sha256').update(`electrizar:${updateId}:${secuencia++}`).digest('hex');
    return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
  };
}

async function fotoDeTelegram(message) {
  const foto = (message.photo || []).filter(valor => valor.file_size && valor.file_size <= 150_000).at(-1);
  if (!foto) throw new Error('No hay una foto dentro del tamaño admitido.');
  const informacion = await telegram('getFile', { file_id: foto.file_id });
  const response = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${informacion.file_path}`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error('No se pudo descargar la foto.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 150_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('La foto no es válida.');
  const pie = /^(antes|después|despues|lectura)$/i.test(message.caption?.trim() || '') ? message.caption.trim() : 'Evidencia';
  return { url: 'data:image/jpeg;base64,' + Buffer.from(bytes).toString('base64'), pie };
}

async function completar(db, registro, documento, mensaje, operario, botUid) {
  const pendiente=documento.pendiente;
  let sesion=documento.estado ? structuredClone(documento.estado) : null;
  let propuesto, respuesta, botones=pendiente.botones ? JSON.parse(pendiente.botones) : undefined;
  const uuid=identificadorEvento(pendiente.update);
  // Un reintento después de guardar nunca repite la edición ni añade otra foto.
  if(pendiente.propuesta?.pendiente && pendiente.propuesta.informeId) {
    try {
      const publicado=await leerRemoto(db,pendiente.propuesta.informeId);
      if(publicado.versionRemota===pendiente.propuesta.revision || publicado.revisionesAplicadas?.includes(pendiente.propuesta.revision)) {
        propuesto=pendiente.propuesta;respuesta=pendiente.respuesta;
      }
    } catch(error) { if(error.code && error.code!=='not-found')throw error; }
  }
  if(!propuesto) {
    let resultado=await navegarInformes(db,sesion,mensaje.text||'');
    if(!resultado && sesion?.informeId && !iniciaNuevaVisita(mensaje.text||'')) {
      let actual;
      try {actual=await leerRemoto(db,sesion.informeId);}
      catch(error) {
        if(error.code!=='not-found')throw error;
        resultado={sesion:{etapa:'inicio',base:'',pendiente:false},texto:'El informe fue eliminado o ya no está disponible. Tu último mensaje no se aplicó. Pulsa Mis informes para continuar con otro.'};
      }
      if(actual) {
      if(actual.versionRemota!==sesion.base) {
        resultado={sesion:sesionDesdeInforme(actual),texto:'El informe cambió en otro dispositivo. Cargué la versión actual; este último mensaje no se aplicó. Revisa el informe y repite el cambio si corresponde.'};
      } else sesion.informe=actual;
      }
    }
    if(!resultado) {
      const codigo=await procesarCodigo(db,sesion,mensaje.text||'',botUid,uuid);
      if(codigo?.valor){sesion=codigo.sesion;mensaje={...mensaje,text:codigo.valor};}
      else if(codigo)resultado=codigo;
    }
    if(!resultado) {
      let foto;
      if(mensaje.photo && ['fotos','fotoEditar'].includes(sesion?.etapa) && !sesion.pendiente)foto=await fotoDeTelegram(mensaje);
      resultado=avanzar(sesion,mensaje.text||'',foto,operario,botUid,uuid);
    }
    resultado.sesion=await sugerenciaInicial(db,resultado.sesion);
    if(!resultado.texto)resultado.texto=pregunta(resultado.sesion);
    else if(pideCodigo(resultado.sesion)&&resultado.sesion.codigoSugerido)resultado.texto+='\nConsecutivo sugerido: '+resultado.sesion.codigoSugerido+'.';
    const almacenarPropuesta=async()=>{
      propuesto=resumirSesion(resultado.sesion);respuesta=resultado.texto;
      botones=teclado(resultado.sesion?{...resultado.sesion,pendiente:false}:null);
      await setDoc(registro,{pendiente:{...pendiente,propuesta:propuesto,respuesta,botones:JSON.stringify(botones)}},{mergeFields:['pendiente']});
    };
    await almacenarPropuesta();
    if(resultado.sesion?.pendiente) {
      const s=resultado.sesion;
      try {
        await guardarRemoto(db,{id:s.informe.id,informe:{...s.informe,ultimaEdicionTelegram:{uid:operario.uid,nombre:operario.nombre}},revision:s.revision,base:s.base,pendiente:true},{exigirBase:true});
      } catch(error) {
        if(error.code==='codigo-duplicado') {
          resultado={sesion:sesion || s,texto:error.message+' El cambio no se guardó. Corrige el código antes de continuar.'};
          resultado.sesion.pendiente=false;
        } else if(error.code==='informe-modificado') {
          resultado={sesion:sesionDesdeInforme(await leerRemoto(db,s.informe.id)),texto:'Otro dispositivo guardó cambios antes que tú. Tu último cambio no se aplicó. Cargué la versión actual; revisa y repite la edición.'};
        } else if(error.message?.includes('supera el límite')) {
          resultado={sesion,texto:'Este último cambio no se guardó porque supera el tamaño admitido del informe. El informe anterior se conserva. Puedes entregar ese borrador e iniciar otro para continuar con más evidencias. La foto enviada sigue en este chat.'};
        } else if(error.code==='informe-eliminado') {
          resultado={sesion:{etapa:'inicio',base:'',pendiente:false},texto:'El informe fue eliminado antes de guardar tu cambio. No se volvió a crear. Pulsa Mis informes para buscar otro.'};
        } else throw error;
        await almacenarPropuesta();
      }
    }
  }
  if(propuesto?.pendiente) {
    propuesto.base=propuesto.revision;propuesto.pendiente=false;
    respuesta='Guardado en Electrizar.\n'+respuesta;
  }
  if(propuesto?.etapa==='cerrado'&&process.env.APP_URL)respuesta+='\n'+process.env.APP_URL.trim()+'\nPuedes volver a este informe con /abrir '+propuesto.datos.codigo+'.';
  await telegram('sendMessage',{chat_id:mensaje.chat.id,text:respuesta,reply_markup:botones||teclado(propuesto)});
  await setDoc(registro,{estado:propuesto,ultimo:pendiente.update,pendiente:null},{mergeFields:['estado','ultimo','pendiente']});
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error:'Usa POST.' });
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const recibido = req.headers['x-telegram-bot-api-secret-token'];
  if (secreto.length < 32 || typeof recibido !== 'string' || Buffer.byteLength(recibido) !== Buffer.byteLength(secreto)
      || !timingSafeEqual(Buffer.from(recibido),Buffer.from(secreto))) return res.status(401).json({ error:'Acceso no autorizado.' });
  if (!process.env.TELEGRAM_TOKEN) return res.status(503).json({ error:'Falta configurar el bot.' });
  let update;
  try { update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error:'Mensaje inválido.' }); }
  const mensaje = update?.message;
  if (!mensaje || mensaje.chat?.type !== 'private' || mensaje.from?.is_bot) return res.status(200).json({ ok:true });
  if (!Number.isSafeInteger(update.update_id)) return res.status(400).json({ error:'Identificador inválido.' });
  let registro;
  let db;
  const solicitud = randomUUID();
  try {
    const id = String(mensaje.from.id);
    const autorizados = JSON.parse(process.env.TELEGRAM_OPERARIOS || '{}');
    if (mensaje.text?.trim() === '/id' || !autorizados[id]) {
      await telegram('sendMessage', { chat_id: mensaje.chat.id,
        text: mensaje.text?.trim() === '/id' ? `Tu ID de Telegram es ${id}. Compártelo con el administrador.` : 'Tu cuenta todavía no está autorizada. Envía /id y comparte ese número con el administrador.' });
      return res.status(200).json({ ok:true });
    }
    const operario = autorizados[id];
    if (!operario.uid || !operario.nombre) return res.status(503).json({ error:'Revisa la autorización del operario.' });
    const cuenta = await conectar();
    db = cuenta.db;
    const miembro = await getDoc(doc(db,'equipo',cuenta.uid));
    if (miembro.data()?.rol !== 'bot_telegram') throw new Error('Cuenta del bot sin rol.');
    registro = doc(db,'telegramSesiones',cuenta.uid,'usuarios',id);
    const documento = await runTransaction(db,async tx => {
      const actual = await tx.get(registro);
      const datos = actual.data() || { estado:null, ultimo:-1, pendiente:null };
      if (datos.ultimo >= update.update_id) return null;
      if (datos.bloqueo?.vence > Date.now()) throw new Error('Hay otra solicitud procesándose.');
      if (datos.pendiente && datos.pendiente.update !== update.update_id) throw new Error('Hay un mensaje anterior pendiente.');
      const pendiente = datos.pendiente || { update:update.update_id };
      tx.set(registro,{ ...datos, pendiente, bloqueo:{ id:solicitud, vence:Date.now()+90_000 } });
      return { ...datos, pendiente };
    });
    if (documento) await completar(db,registro,documento,mensaje,operario,cuenta.uid);
    return res.status(200).json({ ok:true });
  } catch (error) {
    // Solo el código, nunca credenciales, mensajes del usuario ni cuerpos de solicitudes.
    console.error('telegram: mensaje sin confirmar', typeof error?.code === 'string' ? error.code : 'operacion-fallida');
    // Un código distinto de 2xx permite que Telegram vuelva a entregar el mismo mensaje.
    return res.status(503).json({ error:'No se confirmó el mensaje. Se reintentará.' });
  } finally {
    if (registro && db) {
      try {
        await runTransaction(db,async tx => {
          const datos=(await tx.get(registro)).data();
          if (datos?.bloqueo?.id === solicitud) tx.set(registro,{bloqueo:null},{merge:true});
        });
      } catch { /* El bloqueo caduca para permitir el siguiente reintento. */ }
    }
  }
}
