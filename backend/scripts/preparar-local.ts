import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';
import pg from 'pg';

if (!existsSync('.env')) {
  const plantilla = readFileSync('.env.example', 'utf8')
    .replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${randomBytes(48).toString('base64url')}`)
    .replace(/^SEED_PROFESSIONAL_PASSWORD=.*$/m, `SEED_PROFESSIONAL_PASSWORD=${randomBytes(18).toString('base64url')}`);
  writeFileSync('.env', plantilla, { mode: 0o600 });
  console.log('Creado .env local con secretos aleatorios.');
}
config({ quiet: true });
if (process.argv.includes('--solo-entorno')) {
  console.log('Entorno preparado. Los secretos locales están en .env.');
  process.exit(0);
}
if (!process.argv.includes('--sin-docker')) {
  execFileSync('docker', ['compose', 'up', '-d', '--wait', 'db'], { stdio: 'inherit', windowsHide: true });
}
const urlPruebas = new URL(process.env.TEST_DATABASE_URL!);
const urlDesarrollo = new URL(process.env.DATABASE_URL!);
if (urlPruebas.pathname !== '/nutri_test' || urlPruebas.host !== urlDesarrollo.host || urlDesarrollo.pathname !== '/nutri_dev') {
  throw new Error('Setup local solo admite nutri_dev/nutri_test en el mismo servidor.');
}
const conexion = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await conexion.connect();
  const existente = await conexion.query('SELECT 1 FROM pg_database WHERE datname = $1', ['nutri_test']);
  if (!existente.rowCount) await conexion.query('CREATE DATABASE nutri_test');
} finally { await conexion.end(); }
for (const argumentos of [ ['node_modules/prisma/build/index.js', 'generate'], ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], ['node_modules/prisma/build/index.js', 'db', 'seed'] ]) {
  execFileSync(process.execPath, argumentos, { stdio: 'inherit', windowsHide: true });
}
console.log('Base y cuenta ficticia listas. Credenciales locales en .env. Iniciá la API con npm run dev.');
