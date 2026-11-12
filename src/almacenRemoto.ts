import { Bytes, doc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import type { Borrador } from "./borradores.ts";
const TAMANO_PARTE = 600_000;
const MAXIMO_PARTES = 12;
const codificador = new TextEncoder();

export function versionRemota(datos: Record<string, any> | undefined) {
  if (!datos) return "";
  const fecha = datos.updatedAt;
  return datos.revisionElectrizar || (fecha ? fecha.seconds + ":" + fecha.nanoseconds : "legado");
}

export async function guardarRemoto(db: Firestore, borrador: Borrador) {
  const { versionRemota: _version, revisionElectrizar: _revision, partesElectrizar: _partes, ...datos } = borrador.informe;
  const json = codificador.encode(JSON.stringify(datos));
  const partes: Bytes[] = [];
  if (json.length > 850_000) {
    for (let inicio = 0; inicio < json.length; inicio += TAMANO_PARTE) {
      partes.push(Bytes.fromUint8Array(json.subarray(inicio, inicio + TAMANO_PARTE)));
    }
    if (partes.length > MAXIMO_PARTES) {
      throw new Error("El informe supera el límite de sincronización de esta versión.");
    }
  }
  const referencia = doc(db, "informes", borrador.id);
  await runTransaction(db, async tx => {
    const actual = await tx.get(referencia);
    const revision = versionRemota(actual.data());
    if (revision === borrador.revision) return;
    if (revision !== borrador.base) {
      throw new Error("El informe cambió en otro dispositivo. Se conservó tu borrador local.");
    }
    const anteriores = Number(actual.data()?.partesElectrizar) || 0;
    partes.forEach((contenido, index) => {
      tx.set(doc(referencia, "partes", String(index)), { contenido, revision: borrador.revision });
    });
    for (let index = partes.length; index < anteriores; index++) {
      tx.delete(doc(referencia, "partes", String(index)));
    }
    const cabecera = partes.length ? {
      id: borrador.id,
      tipo: datos.tipo || "verificacion",
      planta: datos.planta || "",
      codigo: datos.codigo || "",
      propietario: datos.propietario || "",
      direccion: datos.direccion || "",
      fecha: datos.fecha || "",
      equipo: datos.equipo || "",
      tecnico: datos.tecnico || "",
      origenTelegram: datos.origenTelegram || false,
      telegramOperario: datos.telegramOperario || "",
      resultado: datos.resultado || "",
      createdAt: datos.createdAt,
      partesElectrizar: partes.length,
      cantidadElementos: datos.equipos?.length || datos.elementos?.length || 0,
    } : datos;
    tx.set(referencia, { ...cabecera, revisionElectrizar: borrador.revision, updatedAt: serverTimestamp() });
  });
}

export async function leerRemoto(db: Firestore, id: string) {
  const referencia = doc(db, "informes", id);
  return runTransaction(db, async tx => {
    const actual = await tx.get(referencia);
    if (!actual.exists()) throw new Error("El informe ya no está disponible.");
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
