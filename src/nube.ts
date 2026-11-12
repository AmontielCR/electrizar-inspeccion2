import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, getFirestore, onSnapshot } from "firebase/firestore";
import type { Borrador } from "./borradores";
import { guardarRemoto, leerRemoto, eliminarRemoto, versionRemota } from "./almacenRemoto";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const nubeActiva = Object.values(config).every(Boolean);
const app = nubeActiva ? initializeApp(config) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
export const iniciarSesion = (correo: string, clave: string) => signInWithEmailAndPassword(auth!, correo, clave);
export const observarSesion = (callback: Parameters<typeof onAuthStateChanged>[1]) => onAuthStateChanged(auth!, callback);
export const cerrarSesion = () => signOut(auth!);

export function observarInformes(
  recibir: (informes: Record<string, any>[]) => void,
  fallar: (error: Error) => void,
) {
  return onSnapshot(collection(db!, "informes"), snap => {
    recibir(snap.docs.map(d => {
      const datos = d.data();
      const { updatedAt, ...informe } = datos;
      return { ...informe, id: d.id, versionRemota: versionRemota({ ...informe, updatedAt }) };
    }));
  }, fallar);
}

export const sincronizar = (borrador: Borrador) => guardarRemoto(db!, borrador);
export const descargarInforme = (id: string) => leerRemoto(db!, id);
export const borrarRemoto = (id: string, base: string) => eliminarRemoto(db!, id, base);
