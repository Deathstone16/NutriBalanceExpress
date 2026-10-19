import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const url = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/nutri_dev') {
  throw new Error('El PostgreSQL portable solo admite la base local nutri_dev.');
}
const directorio = path.resolve('.local/postgres');
const servidor = new EmbeddedPostgres({
  databaseDir: directorio,
  user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  port: Number(url.port || 5433), persistent: true, createPostgresUser: false,
  authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1', '-c', 'timezone=UTC'],
  onLog: () => {}, onError: mensaje => console.error(String(mensaje)),
});
if (!existsSync(path.join(directorio, 'PG_VERSION'))) await servidor.initialise();
await servidor.start();
const conexion = servidor.getPgClient();
try {
  await conexion.connect();
  for (const nombre of ['nutri_dev', 'nutri_test']) {
    if (!(await conexion.query('SELECT 1 FROM pg_database WHERE datname=$1', [nombre])).rowCount) {
      await conexion.query(`CREATE DATABASE ${nombre}`); // nombres constantes, no entrada de usuario
    }
  }
} finally { await conexion.end(); }
console.log('PostgreSQL local iniciado en 127.0.0.1:5433. Datos persistentes en backend/.local/postgres.');
console.log('En otra terminal: npm run setup:local -- --sin-docker; npm run dev. Ctrl+C detiene solo esta base.');
let cerrando = false;
const mantenerProceso = setInterval(() => {}, 60_000);
async function detener() {
  if (cerrando) return;
  cerrando = true;
  clearInterval(mantenerProceso);
  await servidor.stop();
  process.exit(0);
}
process.on('SIGINT', detener);
process.on('SIGTERM', detener);
