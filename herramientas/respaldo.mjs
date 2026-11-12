import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { collection, getDocs, documentId, orderBy, query, limit, startAfter } from 'firebase/firestore';
import { conectarFirebase } from '../bot/firebase.mjs';
import { leerRemoto } from '../src/almacenRemoto.ts';

async function respaldar() {
  const correo = process.env.FIREBASE_RESPALDO_EMAIL;
  const clave = process.env.FIREBASE_RESPALDO_PASSWORD;
  if (!correo || !clave) throw new Error('Completa .env.respaldo con una cuenta autorizada.');
  const { db } = await conectarFirebase(correo, clave);
  const informes = [];
  let ultimo;
  while (true) {
    const condiciones = [orderBy(documentId()), limit(50)];
    if (ultimo) condiciones.push(startAfter(ultimo));
    const pagina = await getDocs(query(collection(db, 'informes'), ...condiciones));
    if (pagina.empty) break;
    for (const documento of pagina.docs) informes.push(await leerRemoto(db, documento.id));
    ultimo = pagina.docs.at(-1);
    console.log(`${informes.length} informes descargados.`);
  }
  const contenido = JSON.stringify({ formato: 'electrizar-respaldo-v1', proyecto: process.env.FIREBASE_PROJECT_ID,
    fecha: new Date().toISOString(), informes }, null, 2);
  const nombre = `respaldos/electrizar-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await mkdir('respaldos', { recursive: true });
  await writeFile(nombre, contenido, { mode: 0o600, flag: 'wx' });
  const sha = createHash('sha256').update(contenido).digest('hex');
  await writeFile(nombre + '.sha256', sha + '\n', { flag: 'wx' });
  console.log(`Respaldo completo: ${nombre}. Total ${informes.length}. Copia ambos archivos a otro dispositivo.`);
}
respaldar().then(() => process.exit(0)).catch(error => {
  console.error(error.code ? `No se completó el respaldo (${error.code}).` : error.message);
  process.exit(1);
});
