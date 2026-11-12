const campos = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
if (campos.some(campo => !process.env[campo]?.trim() || /TU_|ID_DEL_|AQUI|<|>/.test(process.env[campo]))) {
  console.error('Completa las cuatro variables Firebase de .env.local antes de compilar la versión en línea.');
  process.exit(1);
}
console.log(`Preparando versión en línea para ${process.env.VITE_FIREBASE_PROJECT_ID}. Usa este mismo ID al desplegar Hosting.`);
