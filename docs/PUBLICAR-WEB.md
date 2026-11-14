# Muévete como página web

El mismo código de la app genera una **página web**, que se publica gratis en **Firebase Hosting**. No hace falta instalar nada desde una tienda: cada colaborador entra con un enlace, por ejemplo `https://muevete-netlife.web.app`, o con un dominio propio como `https://muevete.netlife.net.ec`.

## Qué funciona en la web

| Función | Web | App | Nota para la web |
|---|---|---|---|
| Ingreso con código por correo | ✅ | ✅ | |
| Registro por QR | ✅ | ✅ | El QR es un **enlace**: se escanea con la **cámara normal del teléfono** y se abre la página. También funciona el lector de la pantalla Registrar |
| Pasaporte, sellos, compartir página | ✅ | ✅ | En la web, "Compartir" descarga la imagen |
| Ranking, retos, logros | ✅ | ✅ | |
| Agenda y "Me apunto" | ✅ | ✅ | |
| Avisos de eventos (24 h antes y el mismo día) | ✅ Web Push | ✅ | En **iPhone** hay que **agregar la página a la pantalla de inicio** (iOS 16.4 o superior) |
| Recordatorios de pausas activas | ✅ Web Push | ✅ | En la web los envía el servidor cada 15 min; en la app los programa el teléfono |
| Rutina de pausa activa (+5) | ✅ | ✅ | |
| **Conteo de pasos** | ❌ | ✅ | El navegador no tiene acceso al podómetro. Quien quiera el reto de pasos usa la app |
| Mesa de control y panel de Talento Humano | ✅ | ✅ | En una computadora se ven mejor en la web |

Se pueden usar **las dos a la vez**: comparten la cuenta, los puntos y el pasaporte.

## Publicar

Requisitos: el backend ya desplegado en Firebase (pasos 1 a 3 de [COMPILAR-PILOTO.md](COMPILAR-PILOTO.md)).

1. **Clave para Web Push:** en Firebase → Configuración del proyecto → **Cloud Messaging** → *Certificados push web* → **Generar par de claves**. Copia la clave pública.
2. Copia `app/.env.example` a `app/.env` y llena los 6 datos de Firebase y `EXPO_PUBLIC_FIREBASE_VAPID_KEY` con esa clave. Son datos públicos de la app web, no contraseñas.
3. En **VS Code: Terminal → Ejecutar tarea… → Publicar página web (Firebase Hosting)**. O en la terminal:

```bash
cd app
```

```bash
npx expo export -p web
```

```bash
firebase deploy --only hosting
```

Al terminar, Firebase muestra la dirección, por ejemplo `https://ID-DEL-PROYECTO.web.app`.

4. **Dirección de los Web Push:** para que el servidor arme bien los enlaces de las notificaciones, agrega a `functions/.env.ID-DEL-PROYECTO`:

```
WEB_URL=https://ID-DEL-PROYECTO.web.app
```

Luego vuelve a desplegar las funciones con la tarea **Desplegar backend en Firebase**.

## Imprimir los QR como enlaces

Los QR deben apuntar a la dirección de la página. En PowerShell:

```bash
$env:QR_BASE_URL="https://ID-DEL-PROYECTO.web.app"; npm --prefix functions run make-qr
```

Cada QR queda como `https://…/r/GR-A0/<clave>`. Al escanearlo con la cámara del teléfono se abre la página. Si la persona no ha iniciado sesión, ingresa y luego confirma el registro. La app también lee estos QR. Si ya hay QR impresos con el formato anterior, siguen funcionando con la app.

## Dominio propio (opcional)

En Firebase → **Hosting → Agregar dominio personalizado**, por ejemplo `muevete.netlife.net.ec`. TI agrega los registros DNS que indica Firebase y el certificado HTTPS se emite solo. Después cambia `WEB_URL` y `QR_BASE_URL` a esa dirección y vuelve a imprimir los QR.

## Cómo la usan los colaboradores

- **Android (Chrome):** abrir el enlace → menú ⋮ → **Instalar aplicación** o **Agregar a pantalla de inicio** → en Inicio, tocar **Activar notificaciones**.
- **iPhone (Safari):** abrir el enlace → botón Compartir → **Agregar a pantalla de inicio** → abrir Muévete desde ese ícono → **Activar notificaciones**. Sin instalarla, Safari no permite notificaciones.
- **Computadora:** abrir el enlace y activar las notificaciones si se desea. Es la forma recomendada para el panel de Talento Humano.

## Probar en tu computadora

Tarea **Probar página web en esta computadora** (`npx expo start --web`): abre la página en el navegador con recarga automática. Para no tocar los datos reales, usa además la tarea **Probar con emuladores de Firebase** y agrega `EXPO_PUBLIC_EMULATOR_HOST=127.0.0.1` a `app/.env`.
