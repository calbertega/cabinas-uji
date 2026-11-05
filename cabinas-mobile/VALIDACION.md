# Validación Android

## Versión 0.2.2

En el emulador Android 15 se instaló la APK sobre la 0.2.1 con el mismo certificado de firma. Se cortó la red al abrir «Cuenta UJI», se comprobó que la aplicación mostraba «Reintentar» y, tras restaurar la conexión, el botón volvió a cargar el catálogo oficial. La prueba cubre la recuperación ante un corte de conexión en el emulador. La conexión 4G de un móvil físico queda fuera de esta prueba.

## Primera release 0.2.1

La APK firmada arranca en Android 15. La instrumentación en el paquete aislado superó 23 comprobaciones, con el mismo código y recursos que la APK de distribución. Una petición POST directa en el marco principal hacia un origen ajeno recibió 403 del cliente WebView antes de usar la red. El contexto oficial se pudo volver a cargar. La prueba usó un cuerpo sintético y un dominio reservado `.invalid`. La política de orígenes protege la navegación principal. WebView intercepta la solicitud inicial y expone los cambios de destino a través de sus callbacks de navegación. La prueba de POST no cubre todos los redireccionamientos posteriores ni los recursos de terceros integrados en páginas oficiales.

Se llegó al inicio de sesión de `xmlrpc.uji.es`. Si se abandona el inicio de sesión con «Volver a cabinas», la consulta se cancela para que la ventana oficial no reaparezca.

El 5 de noviembre de 2026 se probó la APK 0.2.1 con una sesión UJI real en el emulador. El SHA-256 de la APK instalada coincidía con el de la descarga. Tras cambiar al 6 de noviembre de 08:00 a 10:00, se verificaron 39 calendarios y se mostraron 34 cabinas libres, el mismo resultado observado en Windows. Se abrió la ficha oficial de la cabina 207 y «Solicitar» mostró los campos de fecha y hora de inicio y fin. La prueba terminó antes del envío de la solicitud. El alcance de la prueba real fue una cuenta UJI y un emulador Android 15.

## Versión 0.2.0

31 de octubre de 2026.

| Comprobación | Estado |
| --- | --- |
| Compilación Java contra Android API 35 y conversión DEX | Correcta |
| Empaquetado y alineación | Correctos |
| Firma APK v2/v3 | Verificada con `apksigner` |
| Permisos declarados | Solo Internet |
| Perfil personal o clave de firma incluido en la APK | No |
| Arranque en Android | Correcto en emulador Android 15 API 35 x86_64, Emulator 37.2.13.0 |
| Instrumentación Android | 13 iniciales en la APK y 21 ampliadas en un paquete aislado con el mismo código |
| Borrado local de sesión | Una cookie sintética creada por la prueba se elimina y el puente vuelve a responder |
| Acceso al SSO oficial UJI | Alcanzado automáticamente en xmlrpc.uji.es |
| Identificación UJI y horarios reales | El usuario completó el SSO; la APK consultó 38 calendarios verificables |
| Fecha y franja | 2 de noviembre 08:00–10:00: 37 libres; 3 de noviembre, misma franja: 38 libres |
| Exactitud de intervalos | Cabina 309: bloqueo 09:15–15:15; huecos completos 08:00–09:00 y 15:30–20:00 |
| Reserva oficial | Se abrió la ficha 309 y su formulario con fechas y horas; no se envió la solicitud |
| Cancelación | Retira los datos y mantiene las cabinas sin confirmar; no reaparecen respuestas tardías |
| Segundo plano y caducidad de datos | Tras 130 segundos, retorno HOT: descarta datos anteriores y vuelve a recibir 38 calendarios |
| Pérdida y recuperación de red | Sin Wi-Fi ni datos: muestra Sin verificar; al restaurarlos y reconectar, vuelve a consultar UJI |
| Reinicio del proceso y sesión | La sesión se conservó al reiniciar el emulador y volvió a consultar UJI |
| Cierre/cambio de contexto | 21 comprobaciones en un paquete aislado con el mismo código: borra cookie HttpOnly, localStorage e IndexedDB, destruye la página anterior y crea otra |
| Envío de reserva real | No probado; siempre confirmación oficial manual |

Se instaló el SDK y el emulador oficial después de que el usuario liberara espacio. Se comprobaron carga de recursos, inventario, ausencia de disponibilidad inventada, comunicación nativa por WebMessagePort, ajustes de seguridad y borrado de la sesión sintética con recarga. La primera comprobación de disponibilidad se adelantaba al final de la carga; se corrigió la prueba para esperar ese estado y las 13 comprobaciones pasaron en dos ejecuciones. Tras mejorar el contraste de la barra de estado, se volvió a instalar la APK y se repitieron correctamente.

La versión probada tiene SHA-256 `13a121d2c4f7749d5736ae42f33d4fe005414c44f3960cf460d2fe3a061c8dc6`. Tras la identificación personal del usuario se contrastaron los casos anteriores con UJI. La prueba ampliada de 21 comprobaciones usa un paquete Android aislado; sus DEX y recursos coinciden byte por byte con los de la APK distribuible. Así se ejercita el cambio de contexto sin borrar la cuenta real del usuario.

El emulador presentó problemas de arranque y renderizado del propio sistema Android. Las pruebas completas se terminaron con un proceso supervisado, cuatro núcleos, 3 GB de RAM, GPU del equipo y Vulkan desactivado. No se modificaron las credenciales ni se trasladaron cookies entre aplicaciones.

Límites: una cuenta UJI y un emulador Android 15; no se ha probado un teléfono físico, una segunda cuenta institucional ni la caducidad real del token del proveedor SSO. La caducidad de los datos y del tiempo de espera de la aplicación sí se observó. La 320 quedó sin confirmar. Las pruebas de almacenamiento usan identidades sintéticas y se distinguen de las consultas reales. Las reservas requieren confirmación personal en UJI.
