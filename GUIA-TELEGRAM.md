**Telegram alojado en Vercel**

Sigue el paso 9 de [VERCEL-STACKBLITZ.md](VERCEL-STACKBLITZ.md). El receptor es /api/telegram y las sesiones se guardan en Firestore. Después de registrar el webhook, Vercel atiende los mensajes.

## Flujo guiado para generadores

El bot usa preguntas y botones de Telegram, sin un servicio adicional de IA de pago. Mantiene los planes Inspección y Energía de la aplicación.

1. Pulsa **Nuevo informe** o envía `/nuevo`. Responde un dato por mensaje. Los ocho datos iniciales muestran ejemplos y el número del paso; el borrador del informe se crea al completar estos datos.
2. Elige **Plan Inspección** o **Plan Energía** según el trabajo acordado.
3. Cada actividad indica su posición, pide el resultado y el detalle real observado. No realizado y No aplica requieren un motivo. Las lecturas y el modo final mantienen sus validaciones.
4. Envía hasta dos fotos por actividad como fotos de Telegram. Puedes indicar Antes, Después o Lectura en el pie. Pulsa **Siguiente** al terminar; las actividades sin foto quedan señaladas en la revisión.
5. Registra los hallazgos con su acción recomendada. **Sin hallazgos** termina la captura de observaciones sin borrar las anteriores.
6. Revisa el resumen. **Corregir datos** permite modificar código, sede, equipo, marca, modelo, potencia y fecha. El plan se conserva para mantener las actividades y evidencias. **Revisar actividades** permite elegir una actividad por número y corregirla conservando sus fotos.
7. Pulsa **Entregar borrador** después de revisar los pendientes. Esto no aprueba el informe ni genera automáticamente un PDF. Revisa el borrador en el historial de la aplicación y genera el documento desde allí.

**Ayuda** explica las opciones; **Ver avance** muestra el progreso sin cambiar respuestas; **Volver** permite retroceder sin borrar evidencias. Si los botones están ocultos, abre el teclado de botones de Telegram. Los comandos siguen disponibles: `/estado`, `/avance`, `/ayuda`, `/volver`, `/corregir`, `/actividades`, `/resumen`, `/observacion`, `/siguiente`, `/omitir`, `/ninguno`, `/finalizar`, `/reintentar`.

Las visitas anteriores se retoman con `/estado` después de actualizar. No se deben volver a crear el bot, las cuentas ni las claves. La actualización usa la misma autenticación, permisos y reglas; mantiene la comprobación que detiene la captura si alguien edita ese informe desde la aplicación. Termina la captura del bot antes de editar el borrador en la web.
