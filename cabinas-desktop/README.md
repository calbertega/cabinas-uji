# Cabinas UJI para Windows

Aplicación independiente para consultar horarios de cabinas y acceder a su reserva oficial desde una interfaz visual. Funciona en el ordenador de cada persona, sin extensión ni Cloudflare. La sesión se mantiene en un perfil local separado del navegador habitual.

## Para usarla

Descarga el ZIP de Windows de Releases, extráelo completo y abre **Cabinas UJI.exe**. Pulsa **Conectar con UJI** y completa la identificación en la ventana oficial. Elige la fecha y franja en la interfaz. Para reservar, abre la ficha de la cabina desde su botón de reserva y confirma personalmente en el formulario UJI.

En la 0.2.0 se validó el acceso con una sesión real UJI. Para el 2 de noviembre de 08:00 a 10:00 se recibieron 38 calendarios verificables, 37 libres y la cabina 309 sin disponibilidad. La 320 quedó sin confirmar. El calendario oficial de la 309 mostraba un bloqueo de 09:15 a 15:15. La cuadrícula usa bloques completos de 30 minutos y el detalle conserva las horas exactas de los bloqueos. Los calendarios incompletos o con un bloqueo general quedan sin confirmar.

## Privacidad y límites

La aplicación no tiene servidor remoto, cuenta compartida, telemetría ni claves privadas incluidas. El proceso de identificación ocurre en páginas oficiales dentro de Chromium. No se leen campos de contraseña, cookies o tokens. El lector de horarios procesa el enlace de calendario de esa sesión dentro de la ventana UJI y devuelve solamente intervalos numéricos a la interfaz local. La sesión oficial puede persistir en el perfil local de la aplicación; pulsa **Cerrar sesión local** para borrarla de esta aplicación antes de cambiar de cuenta o compartir el ordenador. Esto no cierra otras sesiones abiertas en Chrome.

El contenido remoto se ejecuta sin Node, con aislamiento de contexto y sandbox. La interfaz local dispone de un puente IPC limitado; las páginas oficiales no reciben ese puente. No se desactivan certificados, seguridad web ni MFA.

La reserva exige confirmación en UJI y puede fallar si cambian las condiciones mientras se consulta. Google Maps muestra el edificio; los planos oficiales sitúan las plantas. No se garantiza ocupación física ni se inventan ubicaciones interiores.

## Desarrollo y distribución

La 0.2.1 incorpora Electron 45.2.3, valida los orígenes HTTPS de las ventanas oficiales y rechaza peticiones malformadas al servidor de la interfaz. Consulta `VALIDACION.md` para distinguir el alcance de las pruebas controladas y de las consultas reales.

Node 22 o posterior y Windows x64:

```text
npm ci
npm run prepare-ui
npm run check
node_modules/electron/dist/electron.exe scripts/check-electron.cjs
npm start
npm run package
```

El ZIP portable y su SHA-256 se generan en `release/`. Incluye el runtime Chromium/Electron: el usuario final no necesita herramientas de desarrollo. La distribución inicial no está firmada con un certificado de editor; no se deben desactivar protecciones de Windows para ejecutarla. Para una publicación más cómoda conviene preparar firma de código.

No subas `node_modules`, `release`, perfiles de usuario, cookies ni archivos de sesión al repositorio. Sube únicamente los fuentes y publica el ZIP revisado como artefacto de Releases.
