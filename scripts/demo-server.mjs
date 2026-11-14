/**
 * Servidor de demostración: entrega la versión web (app/dist) y reenvía a los emuladores
 * de Firebase por el mismo puerto, para poder mostrar la página completa con una sola dirección.
 * Uso: node scripts/demo-server.mjs [puerto]   (con `firebase emulators:start` corriendo)
 * Compilar antes la web con EXPO_PUBLIC_EMULATOR_SAME_ORIGIN=1.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[2] ?? 8091);
const DIST = fileURLToPath(new URL('../app/dist/', import.meta.url));
const ROUTES = [
  { prefix: '/__fn/', port: 5001, strip: '/__fn' },
  { prefix: '/identitytoolkit.googleapis.com/', port: 9099 },
  { prefix: '/securetoken.googleapis.com/', port: 9099 },
  { prefix: '/emulator/', port: 9099 },
  { prefix: '/google.firestore.v1.Firestore/', port: 8080 },
  { prefix: '/v1/projects/', port: 8080 },
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.css': 'text/css' };

http.createServer((req, res) => {
  const route = ROUTES.find((r) => req.url.startsWith(r.prefix));
  if (route) {
    const path = route.strip ? req.url.slice(route.strip.length) : req.url;
    const up = http.request({ host: '127.0.0.1', port: route.port, path, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${route.port}` } }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    up.on('error', () => { res.writeHead(502); res.end('Emulador no disponible'); });
    req.pipe(up);
    return;
  }
  const clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, clean);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}).listen(PORT, '0.0.0.0', () => console.log(`Demo de Muévete en http://localhost:${PORT}`));
