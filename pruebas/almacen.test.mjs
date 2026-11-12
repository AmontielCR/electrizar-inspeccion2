import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { Bytes } from 'firebase/firestore';

function almacenSimulado() {
  const documentos = new Map();
  const sdk = {
    Bytes,
    doc: (...partes) => partes.filter(parte => typeof parte === 'string').join('/'),
    serverTimestamp: () => ({ seconds: 1, nanoseconds: 0 }),
    runTransaction: async (_db, operar) => {
      const operaciones = [];
      const resultado = await operar({
        get: async referencia => ({ exists: () => documentos.has(referencia), data: () => documentos.get(referencia) }),
        set: (referencia, datos) => operaciones.push(() => documentos.set(referencia, datos)),
        delete: referencia => operaciones.push(() => documentos.delete(referencia)),
      });
      operaciones.forEach(ejecutar => ejecutar());
      return resultado;
    },
  };
  const fuente = readFileSync(new URL('../src/almacenRemoto.ts', import.meta.url), 'utf8');
  const javascript = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exportaciones = {};
  const require = createRequire(import.meta.url);
  new Function('require', 'exports', javascript)(nombre => nombre === 'firebase/firestore' ? sdk : require(nombre), exportaciones);
  return { documentos, ...exportaciones };
}

test('un informe grande conserva texto Unicode y fotos al dividirse y recuperarse', async () => {
  const almacen = almacenSimulado();
  const informe = { id: 'prueba', tipo:'generador', createdAt:1, origenTelegram:true, telegramOperario:'operario',
    codigo:'INF-PRUEBA', elementos:[{desc:'Prueba con español áéí y emoji 🛠️ '.repeat(45000)}] };
  await almacen.guardarRemoto({}, {id:informe.id, informe, revision:'r1', base:'', pendiente:true});
  assert(almacen.documentos.get('informes/prueba').partesElectrizar > 1);
  assert.equal(almacen.documentos.get('informes/prueba').origenTelegram, true);
  const recuperado = await almacen.leerRemoto({}, informe.id);
  assert.deepEqual(recuperado.elementos, informe.elementos);
  await almacen.guardarRemoto({}, {id:informe.id, informe, revision:'r1', base:'', pendiente:true});
  assert.equal((await almacen.leerRemoto({}, informe.id)).versionRemota, 'r1');
  await assert.rejects(almacen.guardarRemoto({}, {id:informe.id, informe:{...informe,codigo:'Incorrecto'}, revision:'r2', base:'otra-version', pendiente:true}));
  assert.equal((await almacen.leerRemoto({}, informe.id)).codigo, 'INF-PRUEBA');
  await almacen.guardarRemoto({}, {id:informe.id, informe:{...informe,elementos:[]}, revision:'r2', base:'r1', pendiente:true});
  assert.equal(almacen.documentos.size, 1);
});

test('un documento anterior puede abrirse y los fragmentos faltantes se detectan', async () => {
  const almacen = almacenSimulado();
  almacen.documentos.set('informes/antiguo', {codigo:'INF-ANTERIOR', elementos:[], updatedAt:{seconds:7,nanoseconds:8}});
  assert.equal((await almacen.leerRemoto({}, 'antiguo')).versionRemota, '7:8');
  almacen.documentos.set('informes/incompleto', {partesElectrizar:1,revisionElectrizar:'r1'});
  await assert.rejects(almacen.leerRemoto({}, 'incompleto'), /fragmento/);
});
