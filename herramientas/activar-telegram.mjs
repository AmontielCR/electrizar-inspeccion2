const token=process.env.TELEGRAM_TOKEN;
const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
let base;
try { base=new URL(process.env.APP_URL); }
catch { console.error('Completa APP_URL con el dominio de producción de Vercel.');process.exit(1); }
if(base.protocol!=='https:'||!token||!secret||!/^[A-Za-z0-9_-]{32,256}$/.test(secret)) {
  console.error('Completa el token y un secreto de 32 a 256 caracteres, con letras, números, _ o -.');process.exit(1);
}
try {
  const respuesta=await fetch(`https://api.telegram.org/bot${token}/setWebhook`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({url:new URL('/api/telegram',base).href,secret_token:secret,max_connections:1,allowed_updates:['message'],drop_pending_updates:false}),
    signal:AbortSignal.timeout(20_000),
  });
  const resultado=await respuesta.json();
  if(!respuesta.ok||!resultado.ok) throw new Error('No se pudo activar. Revisa el token y el dominio.');
  console.log('Webhook activado. Envía /id al bot y revisa la función api/telegram en Vercel.');
} catch {
  console.error('No se confirmó la activación del webhook. Revisa la conexión, el token y el dominio.');process.exit(1);
}
