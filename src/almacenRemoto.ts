import { fusionarInformes } from "./colaboracion.ts";
import { Bytes, collection, doc, getDoc, getDocs, query, where, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import type { Borrador } from "./borradores.ts";
const TAMANO_PARTE = 600_000;
const MAXIMO_PARTES = 12;
const codificador = new TextEncoder();

export function interpretarCodigo(valor: unknown) {
  const m = /^INF-(\d{2})-(\d{1,9})$/.exec(String(valor || "").trim().toUpperCase());
  if (!m || Number(m[2]) < 1) return null;
  return { codigo:`INF-${m[1]}-${String(Number(m[2])).padStart(3,"0")}`, anio:m[1], numero:Number(m[2]) };
}
const codigoNumero = (anio:string, numero:number) => `INF-${anio}-${String(numero).padStart(3,"0")}`;
export function errorCodigo(sugerido:string) {
  return Object.assign(new Error(`El código ya existe o está reservado. Usa ${sugerido} o abre el informe existente.`), {code:"codigo-duplicado",sugerido});
}
async function prepararAnio(db:Firestore, anio:string) {
  const contador=await getDoc(doc(db,"consecutivosInforme",anio));
  if(contador.data()?.preparado)return Number(contador.data()?.ultimo)||0;
  // La primera reserva del año incorpora todos los servicios y los informes anteriores.
  const anteriores=await getDocs(query(collection(db,"informes"),where("codigo",">=",`INF-${anio}-`),where("codigo","<=",`INF-${anio}-\uf8ff`)));
  return anteriores.docs.reduce((max,d)=>Math.max(max,interpretarCodigo(d.data().codigo)?.numero||0),Number(contador.data()?.ultimo)||0);
}
export async function sugerirCodigo(db:Firestore, anio=new Date().toLocaleDateString("sv-SE",{timeZone:"America/Costa_Rica"}).slice(2,4)) {
  return codigoNumero(anio,(await prepararAnio(db,anio))+1);
}
async function prepararReserva(db:Firestore, codigo:string, informeId:string) {
  const c=interpretarCodigo(codigo)!;
  const indice=await getDoc(doc(db,"codigosInforme",c.codigo));
  const ultimo=await prepararAnio(db,c.anio);
  if(indice.exists() && indice.data()?.informeId!==informeId)throw errorCodigo(codigoNumero(c.anio,ultimo+1));
  if(!indice.exists()) {
    // Compatibilidad con informes que todavía no tienen un índice de código.
    const variantes=Array.from(new Set([c.codigo,`INF-${c.anio}-${c.numero}`]));
    const antiguos=await Promise.all(variantes.map(valor=>getDocs(query(collection(db,"informes"),where("codigo","==",valor)))));
    if(antiguos.some(s=>s.docs.some(d=>d.id!==informeId)))throw errorCodigo(codigoNumero(c.anio,Math.max(ultimo,c.numero)+1));
  }
  return {c,ultimo};
}
export async function reservarCodigo(db:Firestore,codigo:string,informeId:string) {
  const {c,ultimo}=await prepararReserva(db,codigo,informeId);
  return runTransaction(db,async tx=>{
    const ref=doc(db,"codigosInforme",c.codigo), cont=doc(db,"consecutivosInforme",c.anio);
    const [indice,contador]=await Promise.all([tx.get(ref),tx.get(cont)]);
    const maximo=Math.max(ultimo,Number(contador.data()?.ultimo)||0);
    if(indice.exists() && indice.data()?.informeId!==informeId)throw errorCodigo(codigoNumero(c.anio,maximo+1));
    if(!indice.exists())tx.set(ref,{codigo:c.codigo,informeId,anio:c.anio,numero:c.numero,createdAt:serverTimestamp()});
    tx.set(cont,{anio:c.anio,ultimo:Math.max(maximo,c.numero),preparado:true});
    return c.codigo;
  });
}

export function versionRemota(datos: Record<string, any> | undefined) {
  if (!datos) return "";
  const fecha = datos.updatedAt;
  return datos.revisionElectrizar || (fecha ? fecha.seconds + ":" + fecha.nanoseconds : "legado");
}

export async function guardarRemoto(db: Firestore, borrador: Borrador, opciones:{exigirBase?:boolean}={}) {
  const referencia = doc(db, "informes", borrador.id);
  const codigoInicial=interpretarCodigo(borrador.informe.codigo);
  const reserva=codigoInicial ? await prepararReserva(db,codigoInicial.codigo,borrador.id) : null;
  return runTransaction(db, async tx => {
    const actual = await tx.get(referencia);
    const revision = versionRemota(actual.data());
    if(!actual.exists() && borrador.base)throw Object.assign(new Error("El informe fue eliminado en otro dispositivo. Tu copia se conserva localmente; descarga un respaldo."),{code:"informe-eliminado"});
    if(opciones.exigirBase && revision!==borrador.base && revision!==borrador.revision && !actual.data()?.revisionesAplicadas?.includes(borrador.revision))throw Object.assign(new Error("El informe cambió en otro dispositivo. Actualiza antes de repetir tu cambio."),{code:"informe-modificado"});
    let informe=borrador.informe;
    if (revision === borrador.revision || actual.data()?.revisionesAplicadas?.includes(borrador.revision) || revision !== borrador.base) {
      const cabecera=actual.data();
      if(!cabecera)throw new Error("El informe remoto no está disponible. Se conserva tu borrador local.");
      const {updatedAt,partesElectrizar,...datosRemotos}=cabecera;
      let remoto=datosRemotos;
      if(partesElectrizar){
        const partes=await Promise.all(Array.from({length:partesElectrizar},(_,i)=>tx.get(doc(referencia,"partes",String(i)))));
        const decoder=new TextDecoder("utf-8",{fatal:true});
        const textos=partes.map(parte=>{
          const datos=parte.data();
          if(!datos||datos.revision!==revision||!(datos.contenido instanceof Bytes))throw new Error("Falta un fragmento remoto. Tu borrador local se conserva.");
          return decoder.decode(datos.contenido.toUint8Array(),{stream:true});
        });
        remoto=JSON.parse(textos.join("")+decoder.decode());
      }
      if(revision===borrador.revision || cabecera.revisionesAplicadas?.includes(borrador.revision))return {...remoto,id:borrador.id,versionRemota:revision};
      informe=fusionarInformes(borrador.original,borrador.informe,remoto);
    }
    const codigoFinal=interpretarCodigo(informe.codigo);
    let indiceCodigo:any=null,contadorCodigo:any=null,refCodigo:any=null,refContador:any=null;
    if(codigoFinal) {
      refCodigo=doc(db,"codigosInforme",codigoFinal.codigo);refContador=doc(db,"consecutivosInforme",codigoFinal.anio);
      [indiceCodigo,contadorCodigo]=await Promise.all([tx.get(refCodigo),tx.get(refContador)]);
      if(indiceCodigo.exists() && indiceCodigo.data()?.informeId!==borrador.id)throw errorCodigo(codigoNumero(codigoFinal.anio,(Number(contadorCodigo.data()?.ultimo)||0)+1));
      if(!indiceCodigo.exists() && reserva?.c.codigo!==codigoFinal.codigo)throw new Error("El código cambió en otro dispositivo. Abre la versión actual del informe.");
      informe={...informe,codigo:codigoFinal.codigo};
    }
    const { versionRemota: _version, revisionElectrizar: _revision, partesElectrizar: _partes, ...contenido } = informe;
    const revisionesAplicadas=Array.from(new Set([...(actual.data()?.revisionesAplicadas||[]),borrador.revision])).slice(-100);
    const datos:Record<string,any>={...contenido,revisionesAplicadas};
    const json = codificador.encode(JSON.stringify(datos));
    const partes: Bytes[] = [];
    if (json.length > 850_000) {
      for (let inicio = 0; inicio < json.length; inicio += TAMANO_PARTE) partes.push(Bytes.fromUint8Array(json.subarray(inicio, inicio + TAMANO_PARTE)));
      if (partes.length > MAXIMO_PARTES) throw new Error("El informe supera el límite de sincronización de esta versión. Descarga un respaldo para conservar todas las fotos.");
    }
    const anteriores = Number(actual.data()?.partesElectrizar) || 0;
    if(codigoFinal) {
      if(!indiceCodigo.exists())tx.set(refCodigo,{codigo:codigoFinal.codigo,informeId:borrador.id,anio:codigoFinal.anio,numero:codigoFinal.numero,createdAt:serverTimestamp()});
      tx.set(refContador,{anio:codigoFinal.anio,ultimo:Math.max(Number(contadorCodigo.data()?.ultimo)||0,reserva?.c.anio===codigoFinal.anio?reserva.ultimo:0,codigoFinal.numero),preparado:true});
    }
    partes.forEach((contenido, index) => tx.set(doc(referencia, "partes", String(index)), { contenido, revision: borrador.revision }));
    for (let index = partes.length; index < anteriores; index++) tx.delete(doc(referencia, "partes", String(index)));
    const cabecera = partes.length ? {
      id: borrador.id, tipo: datos.tipo || "verificacion", planta: datos.planta || "", codigo: datos.codigo || "",
      sistemaIncendio: datos.sistemaIncendio || "",
      propietario: datos.propietario || "", tituloInforme:datos.tituloInforme||"", direccion: datos.direccion || "", fecha: datos.fecha || "",
      equipo: datos.equipo || "", tecnico: datos.tecnico || "", origenTelegram: datos.origenTelegram || false,
      telegramOperario: datos.telegramOperario || "", resultado: datos.resultado || "", createdAt: datos.createdAt,
      partesElectrizar: partes.length, cantidadElementos: datos.equipos?.length || datos.elementos?.length || 0,
    } : datos;
    tx.set(referencia, { ...cabecera, revisionesAplicadas, revisionElectrizar: borrador.revision, updatedAt: serverTimestamp() });
    return {...datos,id:borrador.id,versionRemota:borrador.revision};
  });
}

export async function leerRemoto(db: Firestore, id: string) {
  const referencia = doc(db, "informes", id);
  return runTransaction(db, async tx => {
    const actual = await tx.get(referencia);
    if (!actual.exists()) throw Object.assign(new Error("El informe ya no está disponible."),{code:"not-found"});
    const { updatedAt, partesElectrizar, ...datos } = actual.data();
    const revision = versionRemota({ ...datos, updatedAt });
    if (!partesElectrizar) return { ...datos, id, versionRemota: revision };
    const partes = await Promise.all(Array.from({ length: partesElectrizar }, (_, index) =>
      tx.get(doc(referencia, "partes", String(index)))));
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const textos = partes.map(parte => {
      const fragmento = parte.data();
      if (!fragmento || fragmento.revision !== revision || !(fragmento.contenido instanceof Bytes)) {
        throw new Error("El informe cambió durante la descarga o falta un fragmento.");
      }
      return decoder.decode(fragmento.contenido.toUint8Array(), { stream: true });
    });
    return { ...JSON.parse(textos.join("") + decoder.decode()), id, versionRemota: revision };
  });
}

export async function eliminarRemoto(db: Firestore, id: string, base: string) {
  const referencia = doc(db, "informes", id);
  await runTransaction(db, async tx => {
    const actual = await tx.get(referencia);
    if (!actual.exists()) return;
    if (versionRemota(actual.data()) !== base) throw new Error("El informe cambió en otro dispositivo.");
    const partes = Number(actual.data()?.partesElectrizar) || 0;
    for (let index = 0; index < partes; index++) tx.delete(doc(referencia, "partes", String(index)));
    tx.delete(referencia);
  });
}
