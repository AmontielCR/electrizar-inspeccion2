export type Borrador = {
  id: string;
  informe: Record<string, any>;
  revision: string;
  base: string;
  pendiente: boolean;
  original?: Record<string, any>;
};

let conexion: Promise<IDBDatabase> | undefined;

function abrir(): Promise<IDBDatabase> {
  conexion ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("electrizar-informes-v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("informes");
      request.result.createObjectStore("fichas");
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        conexion = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  }).catch((error): never => {
    conexion = undefined;
    throw error;
  });
  return conexion;
}

async function operar<T>(
  almacenes: string[],
  modo: IDBTransactionMode,
  ejecutar: (tx: IDBTransaction) => IDBRequest<T>,
): Promise<T> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(almacenes, modo);
    tx.onabort = () => reject(tx.error || new Error("La operación local se interrumpió."));
    const request = ejecutar(tx);
    tx.oncomplete = () => resolve(request.result);
  });
}

export async function leerBorradores(cuenta: string): Promise<Borrador[]> {
  const rango = IDBKeyRange.bound([cuenta], [cuenta, []], false, true);
  return operar(["informes"], "readonly", tx => tx.objectStore("informes").getAll(rango));
}

export function escribirBorrador(cuenta: string, borrador: Borrador, ficha?: string) {
  return operar(ficha ? ["informes", "fichas"] : ["informes"], "readwrite", tx => {
    if (ficha) tx.objectStore("fichas").delete([cuenta, ficha]);
    return tx.objectStore("informes").put(borrador, [cuenta, borrador.id]);
  });
}

export function quitarBorrador(cuenta: string, id: string) {
  return operar(["informes", "fichas"], "readwrite", tx => {
    const prefijo = id + "/";
    tx.objectStore("fichas").delete(IDBKeyRange.bound([cuenta, prefijo], [cuenta, prefijo + "\uffff"]));
    return tx.objectStore("informes").delete([cuenta, id]);
  });
}

export function leerFicha(cuenta: string, clave: string) {
  return operar(["fichas"], "readonly", tx => tx.objectStore("fichas").get([cuenta, clave]));
}

export function escribirFicha(cuenta: string, clave: string, datos: unknown) {
  return operar(["fichas"], "readwrite", tx => tx.objectStore("fichas").put(datos, [cuenta, clave]));
}

export function leerFichasInforme(cuenta:string,id:string):Promise<{clave:string;datos:unknown}[]> {
  const prefijo=id+"/";
  const rango=IDBKeyRange.bound([cuenta,prefijo],[cuenta,prefijo+"\uffff"]);
  return abrir().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(["fichas"],"readonly");
    const almacen=tx.objectStore("fichas");
    const claves=almacen.getAllKeys(rango),datos=almacen.getAll(rango);
    tx.oncomplete=()=>resolve(datos.result.map((valor,i)=>({clave:String((claves.result[i] as string[])[1]),datos:valor})));
    tx.onabort=()=>reject(tx.error);
  }));
}
