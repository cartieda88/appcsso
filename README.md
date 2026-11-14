# Muévete Netlife

App de bienestar del Comité de Seguridad y Salud de Netlife. Cada colaborador registra con un QR sus actividades de gradas, gimnasio, piscina y fútbol, suma puntos e insignias, compite en el ranking individual y por departamento, y se une a retos. Talento Humano revisa la participación en un panel.

| Parte | Tecnología | Carpeta |
|---|---|---|
| App Android / iOS **y página web** (mismo código) | Expo SDK 58, React Native, Expo Router; web en Firebase Hosting | `app/` |
| Backend | Firebase: Authentication, Firestore, Cloud Functions (Node 22) | `functions/` |
| Reglas de seguridad e índices | Firestore | `firestore.rules`, `firestore.indexes.json` |

## Cómo funciona

- **Ingreso:** el colaborador escribe su correo `@netlife.net.ec` y recibe un código de 6 dígitos por correo. Solo entran los correos cargados en la nómina (`directory`). Los marcados como `admin` ven el panel de Talento Humano.
- **Registro por QR:** cada acceso tiene un QR impreso con un enlace `https://<sitio>/r/<id>/<token>`, que se abre con la cámara de cualquier teléfono (versión web) y que también lee la app. Se sigue aceptando el formato anterior `MUEVETE:<id>:<token>`. La app lo lee con la cámara y el servidor valida el token, aplica los límites del día y suma los puntos. La app nunca escribe puntos directamente.
- **Reglas** (`functions/src/rules.ts`):

  | Actividad | Puntos | Límite |
  |---|---|---|
  | Gradas | 10 | 2 por día, con 60 min entre registros |
  | Gimnasio | 15 | 1 por día |
  | Piscina | 15 | 1 por día |
  | Fútbol | 20 | 1 por día |

  Los días, semanas y meses se calculan en hora de Ecuador (`America/Guayaquil`).
- **Ranking:** es semanal y mensual. Los departamentos se ordenan por puntos promedio por colaborador (puntos ÷ número de personas del departamento), para que los equipos pequeños compitan en igualdad.
- **Pasaporte:** cada registro deja un sello numerado (N° 0001, 0002…) con la actividad, la fecha y la hora en hora de Ecuador. Los sellos se ven por mes, y al tocar uno se muestra el detalle (lugar y puntos). Al escanear, el sello nuevo aparece con una animación. La pestaña también incluye el nivel y las insignias.
  - **Logros del mes:** *Página completa* (9 sellos validados en el mes) y *Pasaporte completo* (un sello de cada actividad en el mes). Cada uno da +50 puntos una vez por mes; los valores están en `functions/src/rules.ts` (`PAGE_SIZE`, `PASSPORT_ACHIEVEMENTS`).
  - **Compartir:** el botón *Compartir esta página* genera una imagen PNG de la página del mes y abre el menú de compartir del teléfono (WhatsApp, Teams, correo). En el navegador la descarga.
- **Validación por un responsable:** los QR con `requiresApproval: true` (por defecto, el de la cancha de fútbol) dejan el sello *pendiente*, sin puntos. Las personas con rol `validador` en la nómina (la mesa de control) o los `admin` lo aprueban o rechazan desde el botón ✓ de la pantalla de inicio. Al aprobar se suman los puntos, la racha, los retos, el ranking y los logros del pasaporte, con la fecha y hora originales del registro. Al rechazar se puede escribir un motivo y la persona puede volver a registrarse ese día. Nadie puede validar su propio sello. El panel de Talento Humano muestra cuántos sellos esperan validación.
- **Pausas activas:** rutina guiada de 2 min 30 s (cuello, hombros, muñecas, espalda y piernas) que da un sello y +5 puntos, hasta 4 al día con 1 hora entre ellas. El colaborador activa **recordatorios** en el teléfono (cada 1 h, 1 h 30 o 2 h, en su horario laboral de lunes a viernes). Son notificaciones locales: funcionan sin internet y sin servidor.
- **Pasos:** la app lee los pasos del día del **podómetro del iPhone** (CoreMotion) o de **Health Connect** en Android (Google Fit, Samsung Health, relojes). Al llegar a la meta diaria (8.000 por defecto, en `config/steps.dailyGoal`) se emite el sello *Meta de pasos* (+10) y llega una **notificación**, también con la app cerrada, gracias a una tarea en segundo plano cada ~30 min. Se envían los pasos de hoy y de ayer, y el servidor guarda el máximo de cada día (tope de 70.000). Esto alimenta el reto "21 días de 8.000 pasos".
- **Agenda y notificaciones push:** Talento Humano publica carreras, campeonatos, caminatas o charlas (fecha, hora, lugar y descripción) desde *Retos → Agenda*. Al publicar llega un push a todo el personal. Los colaboradores se inscriben con *Me apunto*. Una función programada envía los recordatorios **24 h antes** ("Mañana: …") y **el mismo día** desde las 07:00 ("Hoy: …"), a los inscritos o a todo el personal según se elija. Si cambia la fecha o el lugar, o se anula, se avisa y los recordatorios se reprograman. Los push usan el servicio de Expo, así que no hace falta configurar FCM ni APNs a mano.
- **Ingreso sin contraseña:** no hay contraseñas que recuperar; cada ingreso usa un código nuevo de 6 dígitos que llega al correo. La pantalla tiene *Reenviar código* (cada 60 s) y ayuda si el código no llega.
- **Retos:** pueden ser de días distintos con actividad (por ejemplo, 7 días seguidos) o de número de registros (por ejemplo, 21 de gradas). Al cumplirlos se suma el bono.

### Datos en Firestore

| Colección | Contenido | Quién la lee |
|---|---|---|
| `directory/{correo}` | Nómina autorizada: nombre, departamento, cédula, rol | Solo el servidor |
| `users/{uid}` (+ `activities`, `challenges`) | Perfil, estadísticas, historial y retos | El propio colaborador y los admin |
| `scores/{periodo}_{uid}`, `deptScores/…` | Ranking por semana (`W2026-46`) y mes (`M2026-11`) | Todos los colaboradores |
| `stats/{periodo}` | Totales para el panel | Admin |
| `approvals/{id}` | Sellos pendientes de validación | Validadores y admin |
| `steps/{uid}_{día}` | Pasos del día y si llegó a la meta | El propio colaborador y los admin |
| `events/{id}` (+ `attendees`) | Agenda del Comité e inscritos | Todos (cada uno ve su inscripción) |
| `users/{uid}/devices/{id}` | Tokens de notificaciones push | Solo el servidor |
| `qrCodes/{id}` | Actividad, lugar y token secreto de cada QR | Solo el servidor |
| `challenges/{id}`, `departments/{id}`, `config/campaign` | Configuración del Comité | Todos los colaboradores |

## Probar en tu computadora (sin crear nada en Firebase)

Requisitos: Node 22, Java 21 (para el emulador de Firestore) y `npm i -g firebase-tools`.

```bash
cd functions && npm install && npm run build && cd ..
firebase emulators:start --project demo-muevete
```

En otra terminal, carga los datos de ejemplo:

```bash
cd functions
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-muevete
node lib/scripts/seed.js
node lib/scripts/import-directory.js ejemplo-nomina.csv
node lib/scripts/make-qr.js          # genera qr-print/ con los QR del emulador
node e2e/flujo.e2e.js                # prueba completa: ingreso, QR, límites, ranking, panel
```

Luego abre la app:

```bash
cd app && npm install
EXPO_PUBLIC_EMULATOR_HOST=<IP de tu computadora> npx expo start
```

Con los emuladores, la pantalla de ingreso muestra el código en lugar de enviarlo por correo. Usuarios de ejemplo: `mf.ruiz@netlife.net.ec` (colaboradora), `mesa.futbol@netlife.net.ec` (validador) y `th.admin@netlife.net.ec` (Talento Humano). Para escanear, abre `functions/qr-print/imprimir.html` en la pantalla de la computadora y apunta el teléfono.

> La cámara y el lector de QR necesitan una *development build* (`npx expo run:android`, o `eas build --profile development`). Expo Go puede no incluir todos los módulos nativos.

Pruebas unitarias de las reglas: `cd functions && npm test`.

## Puesta en producción

**Paso a paso para el piloto (Firebase, Expo y APK):** [docs/COMPILAR-PILOTO.md](docs/COMPILAR-PILOTO.md).

**Versión web (sin instalar la app):** [docs/PUBLICAR-WEB.md](docs/PUBLICAR-WEB.md).

1. **Proyecto Firebase:** créalo en la consola de Firebase con el plan **Blaze**, que Cloud Functions requiere y que tiene una cuota gratuita amplia. Activa Authentication (no hace falta ningún proveedor: el ingreso usa tokens personalizados) y Firestore. Pon el ID en `.firebaserc`.
2. **Permiso para firmar tokens:** en Google Cloud → IAM, dale a la cuenta de servicio de Cloud Functions (`<número>-compute@developer.gserviceaccount.com`) el rol **Creador de tokens de cuenta de servicio** (*Service Account Token Creator*).
3. **Correo saliente** (pídelo a TI). Puede ser una cuenta de Microsoft 365 con SMTP AUTH habilitado, o un servicio como SendGrid:
   ```bash
   firebase functions:secrets:set SMTP_USER
   firebase functions:secrets:set SMTP_PASS
   ```
   Otros parámetros, en `functions/.env.<id-del-proyecto>`: `SMTP_HOST` (por defecto `smtp.office365.com`), `SMTP_PORT` (587), `SMTP_FROM`, `ALLOWED_DOMAIN` (`netlife.net.ec`) y `REQUIRE_DIRECTORY` (`true`).
4. **Desplegar:** `firebase deploy --only functions,firestore`
5. **Cargar datos** con una cuenta de servicio: `export GOOGLE_APPLICATION_CREDENTIALS=service-account.json GCLOUD_PROJECT=<id>`.
   - `npm run seed`: carga departamentos, retos, campaña y QR. Antes, edita `functions/scripts/seed.ts` con los números reales de personas por departamento y con todos los accesos.
   - `npm run import-directory -- nomina.csv`: carga la nómina, con las columnas `correo,nombre,departamento,cedula,rol` (`rol`: vacío, `validador` o `admin`).
   - `npm run make-qr`: genera los QR. Imprime `qr-print/imprimir.html` y pégalos en los accesos.
   - Si se filtra la foto de un QR, ejecuta `npm run seed -- --rotate` y reimprime.
6. **App:** copia `app/.env.example` a `app/.env` con los datos de la app web de Firebase y luego:
   ```bash
   cd app
   npx eas-cli@latest build --profile piloto --platform android
   ```
   El perfil `piloto` genera un APK para instalar en el piloto con el Comité.
   Antes del primer build, ejecuta `npx eas-cli@latest init`, que agrega `extra.eas.projectId` a `app.json`: sin él no hay notificaciones push. Para iOS, EAS pide las credenciales de Apple Push la primera vez.
   En Android, el colaborador debe tener la app **Health Connect** (viene incluida desde Android 14; en versiones anteriores se instala desde Play Store). Al publicar en Play Store, Google pide justificar el permiso de pasos y la política de privacidad. Para las tiendas: `eas build --profile production` y `eas submit`.
   El panel también funciona en el navegador: `npx expo export -p web` y publicar `dist/` en Firebase Hosting.

## Pendiente de definir con el Comité / TI

- Manual de marca: el logo oficial ya está aplicado (ícono, splash, encabezado e ingreso; original en `app/assets/images/brand/`). Los colores y la tipografía Figtree se tomaron de Netlife Access.
- Cuenta de correo para enviar los códigos.
- Nómina inicial y número de personas por departamento.
- Política de privacidad y consentimiento según la Ley Orgánica de Protección de Datos Personales.
- Premios y reglas de los reconocimientos semanales y mensuales.
