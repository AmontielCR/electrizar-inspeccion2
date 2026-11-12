**Electrizar Informes 2.1 — sustitución en Vercel desde StackBlitz**

El código se edita desde StackBlitz, se conserva en tu repositorio de GitHub y se publica en tu proyecto actual de Vercel. Firebase Authentication y Firestore mantienen los accesos y los informes compartidos. El bot opcional recibe los mensajes en una función de Vercel y conserva las conversaciones en Firestore.

**1. Preparar el cambio**

Abre el proyecto actual en Vercel y anota el repositorio conectado, la rama de producción y Root Directory. Para conservar electrizar-inspeccion.vercel.app usa ese mismo proyecto de Vercel al publicar la actualización. Conserva el commit o la versión de código anterior para poder consultarla.

Pide que los operarios terminen de guardar las fichas pendientes y comprueben que aparecen desde otro dispositivo. Guarda una copia de los documentos y las fotos de los trabajos activos. El borrador que solo existe en un navegador necesita sincronizarse antes de cambiar la aplicación. En la consola Firebase conserva también una copia de las reglas actuales y revisa si el proyecto sirve a otras aplicaciones.

Para una primera prueba compartida, puedes crear una rama de prueba y configurar sus variables Preview con un proyecto Firebase de prueba. Los despliegues Preview de Vercel comparten la base que indiquen sus variables; la rama por sí sola no separa los datos.

**2. Abrir los archivos en StackBlitz**

Abre tu proyecto actual de StackBlitz o importa la rama de GitHub que usarás para probar. StackBlitz admite importar proyectos de GitHub y arrastrar archivos o carpetas al editor. [Importación de proyectos](https://developer.stackblitz.com/guides/user-guide/importing-projects)

El ZIP contiene una carpeta electrizar-informes. Integra su contenido dentro de la raíz de la aplicación, donde está package.json. Reemplaza src, public, index.html y las configuraciones de esta entrega. Incluye api, bot, herramientas, pruebas, firestore.rules, vercel.json, .stackblitzrc, .gitignore, package.json y pnpm-lock.yaml. El paquete está preparado como un proyecto completo de Vite.

Conserva las funciones adicionales del repositorio que sigas usando, después de revisar su integración. Esta entrega trae la IA desactivada. Si mantienes el endpoint de análisis de imágenes de la aplicación anterior, su archivo y configuración se revisan por separado.

La terminal de StackBlitz se ejecuta en el navegador. Desde ella instala y abre la app.

```bash
npx pnpm@10 install --frozen-lockfile
npm run dev -- --host 0.0.0.0
```

El paquete usa pnpm-lock.yaml de formato 9, compatible con la detección de pnpm de Vercel. Conserva ese archivo de bloqueo al subir los cambios. Si StackBlitz ya inició Vite automáticamente, usa su panel Preview. Para comprobar TypeScript puedes ejecutar npm run check. El código usa .stackblitzrc para definir el arranque. [Configuración de WebContainers](https://developer.stackblitz.com/platform/webcontainers/project-config)

**3. Conectar la vista de StackBlitz con Firebase**

En Firebase abre Configuración del proyecto y la aplicación web existente. Copia apiKey, authDomain, projectId y appId. Usa el mismo projectId de la versión anterior para conservar el historial operativo cuando estés listo para el cambio.

Crea en el editor .env.local, a partir de .env.example, con estos valores.

```dotenv
VITE_FIREBASE_API_KEY=valor_de_apiKey
VITE_FIREBASE_AUTH_DOMAIN=valor_de_authDomain
VITE_FIREBASE_PROJECT_ID=valor_de_projectId
VITE_FIREBASE_APP_ID=valor_de_appId
```

Reinicia Vite después de editar las variables. Estos valores identifican la aplicación web y estarán disponibles en el navegador. El acceso se controla mediante Authentication y las reglas de Firestore. Los tokens del bot y las contraseñas de cuentas de servicio deben configurarse en Vercel sin prefijo VITE_.

Con las cuatro variables completas la app muestra el inicio por correo y contraseña. Si aparece Piloto local, revisa los nombres y valores y reinicia el proyecto. En la compilación de Vercel, la ausencia de las variables detiene el despliegue para que puedas corregir la configuración.

**4. Preparar los usuarios en la consola de Firebase**

En Authentication habilita Correo electrónico/contraseña y crea una cuenta por persona. Copia el UID de cada una. En Firestore crea la colección equipo y un documento por UID. Agrega el campo rol como cadena, con admin para tu cuenta, operario para los operarios o ingeniero para los ingenieros.

La nueva versión utiliza estos correos y contraseñas de Firebase. Las cuentas que estaban escritas dentro del código anterior necesitan sustituirse por cuentas de Authentication. En esta entrega los tres roles humanos pueden leer y editar los informes del equipo; admin puede eliminarlos. El nombre y la matrícula se revisan en el formulario del informe antes de emitirlo.

En Firestore, pestaña Reglas, revisa el archivo firestore.rules de la entrega. Para el proyecto de prueba puedes copiarlo completo y pulsar Publicar. Si reutilizas la base operativa y hay otras colecciones o aplicaciones, integra sus permisos vigentes antes de publicar las reglas. Las reglas nuevas permiten equipo, informes y sus partes, además de las sesiones restringidas del bot.

Coordina la publicación de reglas con la sustitución de la app cuando uses la base operativa. La versión anterior utiliza otro mecanismo de acceso y no interpreta los informes grandes fragmentados. Confirma los guardados pendientes antes de empezar esa transición.

**5. Guardar el código en GitHub**

Guarda los archivos en la rama de prueba de tu repositorio mediante la integración de StackBlitz con GitHub, o usa la interfaz web de GitHub para subir los archivos actualizados a esa rama. Comprueba que package.json y vercel.json estén dentro del Root Directory que Vercel usa para compilar.

Sube el código, las configuraciones, las pruebas, los ejemplos vacíos y esta guía. Los archivos .env.local y .env.telegram quedan fuera de Git por .gitignore. Las credenciales del bot se introducen en el panel de Vercel. La carpeta public contiene únicamente los recursos que debe publicar el navegador.

La compilación se ejecuta en Vercel desde el código del repositorio. El resultado dist lo genera ese proceso.

**6. Configurar el proyecto actual en Vercel**

En Settings, Build and Deployment, comprueba estos valores. vercel.json ya define los comandos y la salida.

| Ajuste | Valor |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | La carpeta del repositorio que contiene package.json |
| Install Command | Automático, usando pnpm-lock.yaml |
| Build Command | npm run build:vercel |
| Output Directory | dist |
| Node.js | 24.x para las funciones de esta entrega |

En Settings, Environment Variables, agrega las mismas cuatro variables VITE_FIREBASE_*. Elige los entornos que correspondan. Para Production usa la base operativa; para Preview puedes usar la base de prueba. Después de cambiarlas se necesita un nuevo despliegue. [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite) · [Variables de entorno](https://vercel.com/docs/environment-variables/managing-environment-variables)

En Firebase Authentication, configuración de dominios autorizados, añade electrizar-inspeccion.vercel.app y el dominio de prueba que uses si es necesario para el flujo de acceso. Configura el dominio sin https:// ni rutas.

**7. Revisar el Preview antes de sustituir el enlace del equipo**

Abre el despliegue Preview de la rama y prueba desde un navegador y una tablet. Comprueba un informe eléctrico anterior, uno de aires, la selección de El Esfuerzo, Orokay II y Las Anas, y los planes de generadores. Crea un caso claramente identificado como prueba.

Dentro de una ficha escribe una observación y toma una foto. Espera la confirmación de guardado local. Guarda la ficha y comprueba Sincronizado. Desde el otro dispositivo abre el mismo informe y revisa la evidencia. Prueba también la recuperación de una ficha tras cerrar y volver a abrir la app, y la captura sin conexión después de una primera apertura con red.

Genera un PDF y un Word y verifica la legibilidad. El ingeniero revisa el dictamen, los datos del responsable y el consecutivo antes de emitir. La reserva automática de consecutivos queda pendiente; el código sugerido debe comprobarse para evitar repetidos.

**8. Publicar en el mismo enlace actual**

Cuando el Preview esté comprobado y los informes de la versión anterior estén guardados, integra la rama de prueba en la rama de producción que usa el proyecto actual de Vercel. Su integración con GitHub iniciará el despliegue. En Deployments abre los registros y espera Ready.

Abre https://electrizar-inspeccion.vercel.app y comprueba que aparezcan Operación de sitios y Mantenimiento de generadores. Accede con la nueva cuenta Firebase, abre un informe existente y verifica una escritura de prueba desde dos dispositivos. El alias se conserva porque estás publicando en el proyecto actual de Vercel.

Para instalarla en la tablet usa la opción de instalar de Chrome o Añadir a pantalla de inicio de Safari. La web instalada guarda borradores y fotos en el navegador del dispositivo para tolerar cortes de conexión; el sistema compartido se consulta desde Vercel y Firestore.

**9. Activar Telegram también en línea**

La dirección del receptor es https://electrizar-inspeccion.vercel.app/api/telegram. La función se ejecuta al llegar un mensaje y Firestore conserva el estado entre ejecuciones.

En BotFather crea un bot de prueba y conserva el token. En Authentication crea una cuenta exclusiva para el bot. En Firestore crea equipo/UID_DEL_BOT con rol igual a bot_telegram. Usa las reglas de esta entrega para restringir sus accesos. [Creación de bots](https://core.telegram.org/bots/tutorial)

En Vercel, Environment Variables del entorno Production, agrega estos valores. La configuración FIREBASE_* corresponde al mismo proyecto que usa la app.

```dotenv
TELEGRAM_TOKEN=token_de_BotFather
TELEGRAM_WEBHOOK_SECRET=secreto_aleatorio_de_al_menos_32_caracteres
FIREBASE_API_KEY=valor_de_apiKey
FIREBASE_AUTH_DOMAIN=valor_de_authDomain
FIREBASE_PROJECT_ID=valor_de_projectId
FIREBASE_APP_ID=valor_de_appId
FIREBASE_BOT_EMAIL=correo_exclusivo_del_bot
FIREBASE_BOT_PASSWORD=clave_exclusiva_del_bot
TELEGRAM_OPERARIOS={}
APP_URL=https://electrizar-inspeccion.vercel.app
```

Para generar el secreto, ejecuta este comando en la terminal de StackBlitz y copia el resultado al campo correspondiente de Vercel.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Vuelve a desplegar Production después de agregar las variables. En StackBlitz crea un archivo privado .env.telegram con TELEGRAM_TOKEN, TELEGRAM_WEBHOOK_SECRET y APP_URL, usando exactamente los mismos valores. Ejecuta la activación desde su terminal.

```bash
node --env-file=.env.telegram herramientas/activar-telegram.mjs
```

El comando registra un webhook HTTPS en Telegram, usa un secreto en las solicitudes y limita a una conexión simultánea. Usa el dominio estable de producción para el webhook. La API debe ser accesible por Telegram; si el proyecto tiene protección adicional de despliegues, revisa el acceso a esa ruta. La autenticación de la función verifica el secreto antes de procesar el mensaje. [Webhook de Telegram](https://core.telegram.org/bots/api#setwebhook)

Envía /id al bot desde la cuenta del operario. El bot responderá su ID numérico. En Vercel cambia TELEGRAM_OPERARIOS por el vínculo con la cuenta de Firebase de esa persona y vuelve a desplegar.

```json
{"123456789":{"uid":"UID_FIREBASE_DEL_OPERARIO","nombre":"Nombre Apellido"}}
```

Ahora escribe /nuevo. El bot pide identificación, plan y resultados, solicita fotos por tarea y entrega el código del borrador. El ingeniero abre el mismo informe en el historial de Electrizar. Usa /siguiente para terminar las fotos de una tarea y /finalizar en la sección final de hallazgos. La lista de comprobaciones es compartida con la app. El piloto admite Plan Inspección y Plan Energía de generadores.

Las fotos se reciben en versión JPEG de hasta 150 KB para controlar tamaño y cuota. Escribe también las lecturas y revisa su legibilidad. Si llega una respuesta de guardado confirmado, Firestore aceptó el cambio. Ante un fallo temporal la función responde para que Telegram reintente el mensaje. Una interrupción durante la confirmación puede repetir una respuesta del bot. Si el ingeniero editó el informe desde la app durante la captura, el bot detiene esa visita y pide revisar el conflicto.

StackBlitz sirve para activar el webhook y editar el código. Después de activarlo, puedes cerrar el editor: el receptor del bot queda alojado en Vercel y sus conversaciones en Firestore.

**10. Costos y comprobaciones pendientes**

El paquete usa las cuotas de Vercel, Telegram y Firestore, con generación de documentos en el navegador. La IA está desactivada. Firestore conserva borradores y evidencia, y cada informe admite hasta 7,2 MB de JSON en esta implementación. Revisa el consumo de los planes durante el piloto.

Vercel Hobby restringe el uso a fines personales y no comerciales. El carácter de prueba de una aplicación empresarial no garantiza por sí solo que cumpla esa condición; verifica los términos del proyecto antes de publicarla en Hobby. [Condiciones de Hobby](https://vercel.com/docs/plans/hobby)

Se verifican la compilación y pruebas automáticas del flujo, el almacenamiento y la protección del receptor. La configuración en tu cuenta Vercel, las reglas Firebase publicadas y la entrega real de mensajes requieren completar los pasos anteriores y comprobar el recorrido de aceptación antes de usarlo con informes operativos.
