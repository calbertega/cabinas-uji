# Validación de la aplicación descargable

## Primera release 0.2.1

En Windows x64 se ejecutó el portable con Electron 45.2.3. Su servidor de interfaz respondió 400 a destinos de petición malformados, 403 a un encabezado `Host` ajeno y 200 a peticiones válidas posteriores. Pasaron 33 comprobaciones locales, 16 pruebas controladas del ciclo de conexión y 8 pruebas Electron con almacenamiento y cookies sintéticos. `npm audit` devolvió cero avisos en ese momento.

El 5 de noviembre de 2026 se probó el portable 0.2.1 con una sesión UJI real. Para el 6 de noviembre, de 08:00 a 10:00, la interfaz mostró 39 calendarios verificados y 34 cabinas libres. Se abrió la ficha oficial de la cabina 207 desde el detalle de la aplicación. La acción «Solicitar» abrió los campos de fecha y hora de inicio y fin del catálogo. La prueba terminó antes del envío de la solicitud.

## Seguimiento 0.2.0 · 31 de octubre de 2026

La conexión ahora cancela consultas anteriores, descarta resultados tardíos y vuelve a obtener el contexto UJI en cada fecha. Una primera cabina sin datos ya no impide consultar las demás; los fallos transitorios tienen un reintento acotado. Tres errores de transporte consecutivos detienen la consulta y ningún resultado verificable produce un error explícito.

Se ejecutaron correctamente 26 comprobaciones locales y 16 pruebas del ciclo de conexión con adaptador controlado. Estas últimas simulan caducidad, sustitución de consultas, pérdida de conexión, ventana cerrada, timeout y borrado fallido; no son pruebas de una segunda cuenta real. Otras 8 comprobaciones de integración se ejecutaron en Electron con particiones y cookies sintéticas: verificaron aislamiento de sesiones, borrado nativo, puente de interfaz, filtrado de campos y ausencia de Node o puente local en una ventana configurada como la oficial. No se modificó ninguna sesión personal.

La aplicación modificada y el portable 0.2.0 volvieron a consultar UJI con la sesión local existente: 38 calendarios verificados, 37 libres para el 2 de noviembre de 08:00 a 10:00. Se pulsó Cancelar durante otra consulta: los datos quedaron sin confirmar y no reaparecieron por respuestas tardías. Se cambió del 2 al 3 de noviembre durante la carga: se retiraron los datos del día anterior y el día 3 mostró 38 libres; al volver al día 2 se recibieron de nuevo sus 37 libres. No se ha borrado la sesión personal ni se ha probado una segunda cuenta. La caducidad real del SSO sigue pendiente de prueba manual. Android dispone de pruebas de ejecución y consultas reales UJI, documentadas por separado en su VALIDACION.md.

SHA-256 del ZIP 0.2.0: `e4697bb6f71b22176da21b9ef1d6b147aa6ba038976b56997cb3161313f67feb`.

## Prueba anterior 0.1.0

Prueba del 30 de octubre de 2026, Windows x64, versión 0.1.0.

La distribución se adaptó a la aclaración del usuario: descargar desde GitHub, extraer y abrir una aplicación local. El sitio alojado no se ha modificado ni se presenta como conectado sin instalar nada.

| Requisito | Evidencia observada |
| --- | --- |
| Apertura sin Node ni extensión por el visitante | Se ejecutó el binario `Cabinas UJI.exe` del directorio portable con el runtime incluido, distinto del arranque de desarrollo. |
| Inicio oficial individual | El usuario completó personalmente la identificación UJI en la ventana de la aplicación. No se introdujeron credenciales mediante herramientas. |
| Consulta real de calendarios | Desarrollo y portable recibieron 38 calendarios verificables para el 2 de noviembre de 2026. De 08:00 a 10:00 aparecieron 37 cabinas libres, la 309 no disponible y la 320 sin confirmar. |
| Horas contrastadas con UJI | Se abrió el calendario oficial de la 309 en otra ventana con la misma sesión. Mostró un bloqueo de 09:15 a 15:15; el portable mostró exactamente ese intervalo en el detalle. |
| Cuadrícula visual prudente | Usa bloques completos de 30 minutos. La 309 ofrece 08:00–09:00 y 15:30–20:00, conservando las horas oficiales exactas en el detalle. |
| Reutilización local de sesión | Se cerró desarrollo y se abrió el ejecutable portable: volvió a consultar sin otro inicio de sesión. |
| Reserva bajo control del usuario | El enlace del detalle abrió la ficha oficial de la cabina 309 usando la sesión ya iniciada. Solo se abrió el formulario y su calendario; no se envió ninguna reserva. |
| Fuente distribuible | El export contiene solamente código, interfaz, inventario público y archivos de construcción. Se excluyeron perfiles, lectores personales conocidos, cookies, HAR, Git y configuración de Sites. |
| Integridad del ZIP | SHA-256 `68f5850dbab8fa23aa2ef0116c987a8252b44dec7ed84e35c0d6cbb0f62a1362`. |

Las 26 comprobaciones automatizadas cubren reglas locales de navegación, remitentes, fechas, normalización y preparación de archivos; no sustituyen la prueba de UJI anterior.

Límites: se validó una cuenta, no todos los perfiles de la universidad. La 320 no tiene disponibilidad confirmada en esta prueba. La ocupación física no se deduce de un calendario de reservas. No se ha probado un envío real de reserva ni se ha publicado todavía un repositorio o Release en GitHub. La distribución se validó arrancando su directorio portable; no se realizó otra instalación en un segundo ordenador.
