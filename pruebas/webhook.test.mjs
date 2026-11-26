import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { resumirSesion, identificadorEvento } from '../api/telegram.js';
import { avanzar } from '../bot/conversacion.mjs';

function respuesta() {
  return { status(valor) {this.codigo=valor;return this;}, json(valor) {this.contenido=valor;return this;} };
}

test('el webhook rechaza solicitudes sin secreto y no consume Firebase para consultar el ID propio',async () => {
  const original = {...process.env};
  const fetchOriginal = globalThis.fetch;
  const env = {TELEGRAM_WEBHOOK_SECRET:'s'.repeat(40),TELEGRAM_TOKEN:'token-ficticio',TELEGRAM_OPERARIOS:'{}'};
  Object.assign(process.env,env);
  let llamadas=0;
  globalThis.fetch=async (_url,config)=>{
    llamadas++;
    const contenido=JSON.parse(config.body);
    assert.equal(contenido.chat_id,123);
    assert.match(contenido.text,/123/);
    return {ok:true,json:async()=>({ok:true,result:{}})};
  };
  try {
    const sinAcceso=respuesta();
    await handler({method:'POST',headers:{},body:{}},sinAcceso);
    assert.equal(sinAcceso.codigo,401);
    assert.equal(llamadas,0);
    const propia=respuesta();
    await handler({method:'POST',headers:{'x-telegram-bot-api-secret-token':env.TELEGRAM_WEBHOOK_SECRET},
      body:{update_id:1,message:{chat:{id:123,type:'private'},from:{id:123},text:'/id'}}},propia);
    assert.equal(propia.codigo,200);
    assert.equal(llamadas,1);
  } finally {
    globalThis.fetch=fetchOriginal;
    for(const nombre of Object.keys(env)) {
      if(original[nombre]===undefined) delete process.env[nombre];
      else process.env[nombre]=original[nombre];
    }
  }
});

test('los reintentos del mismo evento conservan el ID y la sesión remota evita duplicar las fotos en su documento', () => {
  const a=identificadorEvento(1234);
  const b=identificadorEvento(1234);
  assert.equal(a(),b());
  assert.equal(a(),b());
  const c=identificadorEvento(1235);
  assert.notEqual(identificadorEvento(1234)(),c());
  const datos={etapa:'fotos',indice:1,base:'r1',informe:{id:'tg_prueba',elementos:[{fotos:[{url:'imagen-grande'}]}]}};
  const resumida=resumirSesion(datos);
  assert.equal(resumida.informeId,'tg_prueba');
  assert.equal(resumida.informe,undefined);
  assert(!JSON.stringify(resumida).includes('imagen-grande'));
  const operario={uid:'operario',nombre:'Nombre'};
  const nueva=avanzar(null,'/nuevo',null,operario,'bot',identificadorEvento(100)).sesion;
  assert.equal(nueva.etapa,'servicio');
});
