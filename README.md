# Cabinas UJI · Windows y Android

Aplicación independiente para consultar de forma visual los horarios de las cabinas de la biblioteca y continuar a su reserva oficial. Cada persona utiliza su propia sesión UJI en su dispositivo.

## Descargar y usar

Los usuarios finales solo necesitan un archivo de Releases:

- **Windows x64:** descarga `Cabinas-UJI-0.2.1-windows-x64.zip`, extráelo completo y abre **Cabinas UJI.exe**.
- **Android 8 o posterior:** descarga e instala `Cabinas-UJI-0.2.1-android.apk`. Requiere Android System WebView actualizado.

Puedes comprobar ambas descargas con `Cabinas-UJI-0.2.1-SHA256SUMS.txt`. La APK está firmada con la clave del proyecto. El ejecutable Windows carece de firma Authenticode.

Pulsa **Conectar con UJI** e identifícate en la pantalla oficial que abre la aplicación. Elige fecha, hora y cabina. No necesitas extensión, Node, servidor propio ni copiar enlaces.

Para reservar, pulsa **Continuar reserva en UJI** y accede al formulario de la cabina. Debes elegir también las horas y confirmar personalmente allí. La aplicación no envía reservas automáticamente; una franja consultada no equivale a una reserva confirmada.

Google Maps sitúa la biblioteca y los planos oficiales ayudan a localizar la planta. Las horas indican disponibilidad de reserva, no ocupación física.

## Validación

La versión 0.2.1 actualiza Electron, protege el servidor local frente a peticiones malformadas y refuerza las navegaciones del WebView de Android. La consulta con una sesión UJI real devolvió 39 calendarios verificados y 34 cabinas libres el 6 de noviembre de 08:00 a 10:00 en Windows y Android. Se abrió el formulario oficial de la cabina 207 en ambas aplicaciones. Las pruebas reales cubren una cuenta UJI, Windows x64 y un emulador Android 15. Los documentos `VALIDACION.md` detallan el alcance de las pruebas.

## Sesión y privacidad

La identificación se realiza en las páginas oficiales. No se leen campos de contraseña, cookies o tokens para exportarlos ni se trasladan a un servidor. El lector obtiene el enlace de calendario dentro de la ventana UJI de esa persona y devuelve únicamente intervalos numéricos y la hora de consulta a la interfaz local. Las páginas remotas no reciben el puente nativo de la aplicación.

Las sesiones pueden persistir localmente. Usa **Cerrar sesión local** antes de cambiar de cuenta o compartir el dispositivo. No cierra las sesiones de otros navegadores. Los calendarios incompletos o caducados quedan **Sin confirmar**. El mapa integrado conecta con Google Maps cuando se muestra.

## Código y construcción

Conserva juntas las carpetas `cabinas-desktop` y `cabinas-mobile`. La primera contiene la interfaz y el lector compartidos; la segunda incorpora esa interfaz en Android. Cada una incluye sus instrucciones de desarrollo. Las herramientas de desarrollo no son necesarias para el usuario final.

El código propio se distribuye bajo la licencia [MIT](LICENSE). El portable incorpora los avisos de licencia de Electron y Chromium. La aplicación es independiente de la Universitat Jaume I. La integración depende del catálogo oficial y puede requerir mantenimiento si cambia su protocolo.

No incluyas perfiles, cookies, HAR, enlaces personales de calendario, secretos de servidor ni claves de firma. La clave Android se genera localmente al construir y debe conservarse fuera de Git para mantener actualizaciones compatibles. El export público no contiene esa clave ni datos de la sesión utilizada para validar la aplicación.
