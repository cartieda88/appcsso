# Compilar el APK del piloto

Guía para generar el APK de **Muévete Netlife** e instalarlo en los teléfonos del piloto. El APK se compila en la nube de Expo (EAS Build), así que **no hace falta Android Studio**: basta una computadora con Windows, macOS o Linux.

Tiempo estimado: 1 a 2 horas la primera vez, la mayor parte en configurar Firebase. Las siguientes compilaciones son solo el paso 5 (unos 20 minutos de espera).

> El APK necesita el backend en Firebase funcionando. Si se compila sin los datos de Firebase, la app muestra un aviso rojo en la pantalla de ingreso y no puede conectarse.

## 0. Requisitos

| Qué | Dónde | Nota |
|---|---|---|
| Node.js 22 LTS | https://nodejs.org | Instalar con las opciones por defecto |
| Git | https://git-scm.com | |
| Cuenta de Expo (gratis) | https://expo.dev/signup | Conviene una cuenta del área, no personal |
| Proyecto de Firebase en plan **Blaze** | https://console.firebase.google.com | Cloud Functions lo exige; la cuota gratuita cubre de sobra un piloto |
| Cuenta de correo para enviar los códigos | TI | Por ejemplo Microsoft 365 con SMTP AUTH habilitado |

Abre una terminal (PowerShell en Windows) y descarga el proyecto:

```bash
git clone https://github.com/cartieda88/appcsso.git
```

```bash
cd appcsso
```

## 1. Crear el proyecto en Firebase

1. En la consola de Firebase: **Agregar proyecto**, por ejemplo `muevete-netlife`. Anota el **ID del proyecto**.
2. **Actualizar** el plan a Blaze, con una tarjeta corporativa. Se recomienda poner una alerta de presupuesto, por ejemplo de USD 10.
3. **Firestore Database → Crear base de datos**, en modo producción, ubicación `us-east1`, la misma región que las funciones.
4. **Authentication → Comenzar**. No hace falta activar ningún proveedor: el ingreso usa códigos propios.
5. **Configuración del proyecto → Tus apps → Web (</>)**: registra una app llamada "Muévete" y copia los 6 valores de `firebaseConfig` (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`). Se usan en el paso 4.
6. En **Google Cloud → IAM**, a la cuenta `NUMERO-compute@developer.gserviceaccount.com` agrégale el rol **Creador de tokens de cuenta de servicio** (*Service Account Token Creator*). Sin este rol el ingreso falla.

## 2. Desplegar el backend

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

Edita `.firebaserc` y cambia `demo-muevete` por el ID de tu proyecto. Luego crea el archivo `functions/.env.ID-DEL-PROYECTO` con:

```
ALLOWED_DOMAIN=netlife.net.ec
REQUIRE_DIRECTORY=true
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_FROM=Muévete Netlife <bienestar@netlife.net.ec>
```

Guarda el usuario y la clave del correo como secretos. Firebase los pide por teclado, así que no quedan en ningún archivo:

```bash
firebase functions:secrets:set SMTP_USER
```

```bash
firebase functions:secrets:set SMTP_PASS
```

Instala las dependencias y despliega:

```bash
npm --prefix functions install
```

```bash
firebase deploy --only functions,firestore
```

## 3. Cargar los datos del piloto

1. En Firebase: **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**. Guarda el archivo como `functions/service-account.json`. **No lo subas a GitHub**: ya está excluido en `.gitignore`.
2. Prepara la nómina del piloto en `functions/nomina.csv`, con las columnas `correo,nombre,departamento,cedula,rol`. En `rol` pon `admin` (Talento Humano o Comité), `validador` (mesa de control del fútbol) o déjalo vacío.
3. Revisa en `functions/scripts/seed.ts` los departamentos (con el número real de personas), los retos y los códigos QR de los accesos.

En PowerShell:

```bash
cd functions
```

```bash
$env:GOOGLE_APPLICATION_CREDENTIALS="service-account.json"; $env:GCLOUD_PROJECT="ID-DEL-PROYECTO"
```

```bash
npm run seed
```

```bash
npm run import-directory -- nomina.csv
```

```bash
npm run make-qr
```

Abre `functions/qr-print/imprimir.html`, imprime los QR y pégalos en los accesos. En macOS o Linux, el comando de las variables es `export GOOGLE_APPLICATION_CREDENTIALS=service-account.json GCLOUD_PROJECT=ID-DEL-PROYECTO`.

## 4. Configurar Expo

```bash
cd ../app
```

```bash
npm ci
```

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

`eas init` crea el proyecto en Expo y agrega `extra.eas.projectId` a `app.json`. Sin ese valor no llegan las notificaciones push. Sube ese cambio a GitHub.

Carga los datos de Firebase del paso 1.5 como variables del entorno **preview**, que es el que usa el perfil `piloto`. Se puede hacer en expo.dev → tu proyecto → **Environment variables**, o con un comando por variable:

```bash
npx eas-cli@latest env:create --environment preview --visibility plaintext --name EXPO_PUBLIC_FIREBASE_API_KEY --value "AIza..."
```

Repite el comando con `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` y `EXPO_PUBLIC_FIREBASE_APP_ID`. Estos valores identifican la app ante Firebase y no son contraseñas: la seguridad está en las reglas de Firestore y en las funciones.

## 5. Compilar el APK

```bash
npx eas-cli@latest build --profile piloto --platform android
```

- La primera vez pregunta si quieres generar un **keystore** (la firma de la app). Responde **sí**. Expo lo guarda, y hace falta para publicar actualizaciones y para subir la app a Play Store. Descárgalo luego como respaldo desde expo.dev → Credentials.
- La compilación tarda de 10 a 25 minutos (en el plan gratuito puede haber cola). Al terminar aparece un **enlace y un código QR** para descargar el APK. También queda en expo.dev → Builds.

## 6. Instalar en los teléfonos del piloto

1. Comparte el enlace del build, por WhatsApp o Teams.
2. En el teléfono, abre el enlace y descarga el APK. Android pide permitir **"Instalar apps desconocidas"** para el navegador: hay que aceptar.
3. Abre **Muévete**, ingresa con el correo institucional y acepta los permisos:
   - **Notificaciones:** para las pausas, la meta de pasos y los eventos.
   - **Cámara:** para leer los QR.
   - **Health Connect, pasos:** al tocar "Conectar podómetro". Viene incluido desde Android 14; en versiones anteriores se instala desde Play Store.
4. En algunos teléfonos (Xiaomi, Huawei, Samsung con ahorro de batería) conviene quitar las restricciones de batería a Muévete para que la revisión de pasos en segundo plano funcione.

## 7. Lista de prueba del piloto

- [ ] Ingreso con código; el código llega al correo y "Reenviar código" funciona.
- [ ] Escanear el QR de gradas y ver el sello y los puntos.
- [ ] Escanear el QR de fútbol: el sello queda pendiente y la mesa de control lo aprueba desde ✓.
- [ ] "Pasos de hoy" muestra los pasos y llega la notificación al pasar la meta.
- [ ] Activar los recordatorios de pausas cada 1 hora; llega el aviso y la rutina suma +5.
- [ ] Talento Humano publica un evento de prueba para mañana: llega "Nueva actividad", y luego los avisos de 24 h y del mismo día a quienes se inscribieron.
- [ ] El panel de Talento Humano muestra los participantes y se exporta el CSV.
- [ ] Compartir una página del pasaporte por WhatsApp.

## Nuevas versiones

Para cada cambio, sube el código a GitHub y repite el paso 5. Instalar el nuevo APK encima del anterior conserva la sesión y los datos, siempre que se use el mismo keystore, que Expo maneja automáticamente.

## iPhone

Requiere una cuenta de Apple Developer (USD 99 al año). Con ella: `npx eas-cli@latest build --profile production --platform ios` y luego `eas submit`, para TestFlight o App Store. EAS genera los certificados y la clave de notificaciones push.
