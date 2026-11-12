import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export async function conectarFirebase(correo, clave) {
  const variables = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_APP_ID'];
  if (variables.some(nombre => !process.env[nombre])) throw new Error('Completa la configuración de Firebase.');
  const app = initializeApp({
    apiKey: process.env.FIREBASE_API_KEY, authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID, appId: process.env.FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  await setPersistence(auth, inMemoryPersistence);
  const { user } = await signInWithEmailAndPassword(auth, correo, clave);
  return { db: getFirestore(app), uid: user.uid };
}
