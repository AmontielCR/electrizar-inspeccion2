import test from 'node:test';
import assert from 'node:assert/strict';
import { almacenSimulado } from './soporteAlmacen.mjs';

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
  const combinado=await almacen.guardarRemoto({}, {id:informe.id, informe:{...informe,codigo:'Incorrecto'}, revision:'r2', base:'otra-version', pendiente:true});
  assert(combinado.revisionesColaboracion.some(revision=>revision.campo==='codigo'));
  assert.equal((await almacen.leerRemoto({}, informe.id)).codigo, 'INF-PRUEBA');
  await almacen.guardarRemoto({}, {id:informe.id, informe:{...informe,elementos:[]}, revision:'r3', base:'r2', pendiente:true});
  assert.equal(almacen.documentos.size, 1);
});

test('dos operarios conservan sus fotos y los reintentos no repiten ni revierten una publicación',async()=>{
  const almacen=almacenSimulado();
  const base={id:'compartido',tipo:'incendio',createdAt:1,codigo:'SCI-01',elementos:[]};
  await almacen.guardarRemoto({}, {id:base.id,informe:base,base:'',revision:'inicial',pendiente:true});
  const piso1={id:'p1',titulo:'Piso 1',fotos:[{url:'data:image/png;base64,foto1'}]};
  const piso2={id:'p2',titulo:'Piso 2',fotos:[{url:'data:image/png;base64,foto2'}]};
  const a={id:base.id,informe:{...base,elementos:[piso1]},original:base,base:'inicial',revision:'operario-a',pendiente:true};
  const b={id:base.id,informe:{...base,elementos:[piso2]},original:base,base:'inicial',revision:'operario-b',pendiente:true};
  await Promise.all([almacen.guardarRemoto({},a),almacen.guardarRemoto({},b)]);
  const publicado=await almacen.leerRemoto({},base.id);
  assert.deepEqual(publicado.elementos.map(e=>e.id),['p1','p2']);
  assert.deepEqual(publicado.elementos.map(e=>e.fotos[0].url),[piso1.fotos[0].url,piso2.fotos[0].url]);
  const siguiente={...publicado,elementos:[...publicado.elementos,{id:'p3',titulo:'Piso 3',fotos:[]}]};
  await almacen.guardarRemoto({}, {id:base.id,informe:siguiente,original:publicado,base:'operario-b',revision:'tercera',pendiente:true});
  const reintento=await almacen.guardarRemoto({},b);
  assert.equal(reintento.versionRemota,'tercera');
  assert.equal(reintento.elementos.length,3);
  assert.equal((await almacen.leerRemoto({},base.id)).versionRemota,'tercera');
});

test('no se recrea silenciosamente un informe que fue eliminado en el otro dispositivo',async()=>{
  const almacen=almacenSimulado();
  await assert.rejects(almacen.guardarRemoto({}, {id:'eliminado',informe:{id:'eliminado',elementos:[{id:'foto',fotos:[{url:'local'}]}]},base:'vieja',revision:'nueva',pendiente:true}),/eliminado/);
  assert.equal(almacen.documentos.size,0);
});

test('un documento anterior puede abrirse y los fragmentos faltantes se detectan', async () => {
  const almacen = almacenSimulado();
  almacen.documentos.set('informes/antiguo', {codigo:'INF-ANTERIOR', elementos:[], updatedAt:{seconds:7,nanoseconds:8}});
  assert.equal((await almacen.leerRemoto({}, 'antiguo')).versionRemota, '7:8');
  almacen.documentos.set('informes/incompleto', {partesElectrizar:1,revisionElectrizar:'r1'});
  await assert.rejects(almacen.leerRemoto({}, 'incompleto'), /fragmento/);
});

test('el informe grande de alarma conserva el sistema en la cabecera usada por los permisos del bot',async()=>{
  const almacen=almacenSimulado();
  const informe={id:'tg_bot_alarma',tipo:'incendio',sistemaIncendio:'alarma',createdAt:1,origenTelegram:true,
    codigo:'SCI-TEST',elementos:[{id:'actividad',fotos:[{url:'data:image/jpeg;base64,'+'a'.repeat(900000)}]}]};
  await almacen.guardarRemoto({}, {id:informe.id,informe,base:'',revision:'r1',pendiente:true});
  const cabecera=almacen.documentos.get('informes/'+informe.id);
  assert(cabecera.partesElectrizar>0);
  assert.equal(cabecera.tipo,'incendio');
  assert.equal(cabecera.sistemaIncendio,'alarma');
  assert.equal(cabecera.origenTelegram,true);
  assert.deepEqual((await almacen.leerRemoto({},informe.id)).elementos,informe.elementos);
});

test('el consecutivo anual incorpora todos los servicios anteriores y rechaza duplicados sin renumerarlos',async()=>{
  const a=almacenSimulado();
  a.documentos.set('informes/anterior-ac',{codigo:'INF-26-190',tipo:'ac'});
  a.documentos.set('informes/anterior-alarma',{codigo:'INF-26-189',tipo:'incendio'});
  a.documentos.set('informes/anterior-inspeccion',{codigo:'INF-26-187',tipo:'inspeccion'});
  a.documentos.set('informes/otro-anio',{codigo:'INF-25-999',tipo:'generador'});
  assert.equal(await a.sugerirCodigo({},'26'),'INF-26-191');
  await assert.rejects(a.reservarCodigo({},'INF-26-190','nuevo'),e=>e.code==='codigo-duplicado'&&e.sugerido==='INF-26-191');
  assert.equal(a.documentos.get('informes/anterior-ac').codigo,'INF-26-190');
  assert.equal(await a.sugerirCodigo({},'27'),'INF-27-001');
});

test('dos técnicos no pueden reservar el mismo número y la web comparte el índice con el bot',async()=>{
  const a=almacenSimulado();
  a.documentos.set('informes/antiguo',{codigo:'INF-26-190',tipo:'verificacion'});
  const r=await Promise.allSettled([a.reservarCodigo({},'INF-26-191','bot-1'),a.reservarCodigo({},'INF-26-191','bot-2')]);
  assert.equal(r.filter(v=>v.status==='fulfilled').length,1);
  const propietario=a.documentos.get('codigosInforme/INF-26-191').informeId;
  await a.guardarRemoto({}, {id:propietario,informe:{id:propietario,codigo:'INF-26-191',tipo:'ac',createdAt:1,equipos:[]},revision:'r1',base:'',pendiente:true});
  await assert.rejects(a.guardarRemoto({}, {id:'web-otro',informe:{id:'web-otro',codigo:'INF-26-191',tipo:'inspeccion',createdAt:1},revision:'r2',base:'',pendiente:true}),e=>e.code==='codigo-duplicado');
  assert.equal(await a.sugerirCodigo({},'26'),'INF-26-192');
  assert.equal(a.documentos.has('informes/web-otro'),false);
});

test('cambiar o eliminar un informe no recicla códigos y la edición estricta detecta cambios concurrentes',async()=>{
  const a=almacenSimulado(),base={id:'prueba',codigo:'INF-26-190',tipo:'ac',createdAt:1,equipos:[]};
  await a.guardarRemoto({}, {id:base.id,informe:base,revision:'r1',base:'',pendiente:true});
  await a.guardarRemoto({}, {id:base.id,informe:{...base,codigo:'INF-26-191'},revision:'r2',base:'r1',pendiente:true},{exigirBase:true});
  await assert.rejects(a.guardarRemoto({}, {id:base.id,informe:base,revision:'obsoleto',base:'r1',pendiente:true},{exigirBase:true}),e=>e.code==='informe-modificado');
  await a.eliminarRemoto({},base.id,'r2');
  assert.equal(await a.sugerirCodigo({},'26'),'INF-26-192');
  await assert.rejects(a.reservarCodigo({},'INF-26-190','otro'),e=>e.code==='codigo-duplicado');
});
