# Cabinas UJI para Android

Aplicación independiente: cada persona se identifica en las páginas oficiales de UJI dentro del navegador local de la aplicación. La interfaz y la sesión permanecen en el dispositivo. No hace falta extensión, cuenta de desarrollador, servidor propio ni copiar enlaces.

## Instalación

Descarga la APK de la sección Releases del proyecto e instálala con el instalador de Android. Requiere Android 8 o posterior y Android System WebView actualizado. Abre **Cabinas UJI**, pulsa **Conectar con UJI** y completa personalmente la identificación oficial. Elige fecha, hora y cabina. Para reservar, continúa al formulario UJI y confirma allí; la aplicación no envía reservas automáticamente.

Si Android rechaza la instalación, conserva el aviso y su motivo para poder revisarlo. No se deben desactivar las protecciones del dispositivo. Esta distribución inicial se firma con una clave propia del proyecto, sin publicación en Google Play.

## Validación

La 0.2.1 refuerza el control del origen de la ventana oficial, incluidos los POST directos de navegación. La 0.2.0 se probó con una sesión UJI en un emulador Android 15. Se consultaron horarios y se abrió el formulario oficial de reserva. Consulta `VALIDACION.md` para el alcance de cada versión.

## Sesión y datos

La identificación ocurre en los dominios oficiales; no se leen campos de contraseña, cookies ni tokens. La aplicación recibe únicamente intervalos numéricos de calendario y la hora de consulta. Las páginas remotas no reciben el puente nativo de la interfaz. No se ignoran errores de certificados ni se modifica la identificación del navegador para eludir restricciones de acceso.

La sesión UJI puede persistir localmente entre aperturas. **Cerrar sesión local** borra los datos de navegación de esta aplicación para cambiar de cuenta. No afecta a Chrome. Android puede recuperar memoria cerrando la aplicación; al volver a abrirla se consultarán de nuevo los datos. La copia de seguridad Android está desactivada para esta aplicación.

Un calendario sin verificar o caducado se presenta como **Sin confirmar**. Las horas del calendario no garantizan ocupación física ni una reserva futura. La cabina 320 no resultó verificable en la prueba de Windows; esto no se interpreta como una cabina libre.

## Compilación

Conserva este directorio junto a `cabinas-desktop`. Se comparten sus fuentes de interfaz y lector. Instala Node 22+, un JDK 17+ y las herramientas oficiales Android SDK `platforms;android-35` y `build-tools;35.0.0`. Define `JAVA_HOME` y `ANDROID_HOME` y ejecuta:

```text
node scripts/build.mjs
node scripts/build.mjs --smoke-tests
```

El primer comando prepara los recursos, compila Java y DEX, empaqueta, alinea, firma y verifica la APK. Los artefactos aparecen en `release/` junto a su SHA-256. La primera ejecución crea una identidad de firma local en `.private/`; conserva juntos la clave y su contraseña para poder ofrecer actualizaciones compatibles. **Nunca subas `.private/` ni claves de firma al repositorio público.** Puedes guardar esa identidad fuera del árbol de trabajo mediante `CABINAS_SIGNING_DIR`.

## Prueba en un emulador limpio

Con Android SDK Platform Tools y un emulador API 35 disponibles:

```text
adb install -r release/Cabinas-UJI-0.2.1-android.apk
adb install -r -t release/Cabinas-UJI-android-smoke-tests.apk
adb shell am instrument -w es.cabinasuji.independiente.smoke/.SmokeRunner
```

La instrumentación borra la sesión de la instalación que prueba. Para mantener intacta una cuenta personal, construye el paquete aislado y ejecuta sus comprobaciones:

```text
node scripts/build.mjs --sandbox
node scripts/build.mjs --smoke-tests --sandbox
adb install -r release/Cabinas-UJI-0.2.1-android-sandbox.apk
adb install -r -t release/Cabinas-UJI-android-smoke-tests-sandbox.apk
adb shell am instrument -w es.cabinasuji.independiente.smoke.sandbox/es.cabinasuji.independiente.smoke.SmokeRunner
```

Ese paquete usa otro identificador Android y un perfil propio, con el mismo código y recursos. Comprueba carga, puente nativo, permisos, cookie HttpOnly, localStorage, IndexedDB y sustitución del contexto oficial. Usa datos sintéticos, no inicia sesión en UJI ni crea reservas. Los paquetes sandbox son herramientas de desarrollo y no son la descarga para el usuario final.
