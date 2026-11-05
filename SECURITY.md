# Seguridad

Si encuentras una vulnerabilidad, usa la opción **Report a vulnerability** de la sección **Security** del repositorio cuando esté habilitada. Incluye la versión, el sistema y pasos con datos de prueba. Mantén fuera del informe contraseñas, cookies, identificadores de lector, enlaces privados, HAR y capturas de cuentas. Reserva los issues públicos para problemas que se puedan describir sin exponer una sesión o una vulnerabilidad pendiente.

La sesión UJI se mantiene en el dispositivo y la consulta de horarios usa el catálogo oficial. El mapa integrado contacta con Google Maps cuando se muestra. Si compartes el dispositivo, usa **Cerrar sesión local** para borrar la sesión de esta aplicación.

## Verificar las descargas

Compara el SHA-256 de cada archivo con `Cabinas-UJI-0.2.1-SHA256SUMS.txt` de la misma release. En PowerShell puedes usar `Get-FileHash <archivo> -Algorithm SHA256`. La APK usa la firma del proyecto. El ZIP de Windows incluye un ejecutable sin firma Authenticode.
