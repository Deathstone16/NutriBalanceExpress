import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const urlPruebas = new URL(process.env.TEST_DATABASE_URL ?? '');
if (urlPruebas.pathname !== '/nutri_test' || !['localhost', '127.0.0.1'].includes(urlPruebas.hostname)) {
  throw new Error('Las pruebas destructivas solo admiten una base local llamada nutri_test.');
}
const entornoPruebas = {
  ...process.env, NODE_ENV: 'test', DATABASE_URL: urlPruebas.toString(), SESSION_SECRET: randomBytes(48).toString('base64url'),
  APP_ORIGIN: 'http://localhost:5173', TRUST_PROXY: 'none', SESSION_COOKIE_SECURE: 'false', SESSION_COOKIE_SAME_SITE: 'lax',
};
const urlAdministracion = new URL(urlPruebas); urlAdministracion.pathname = '/postgres';
const conexion = new pg.Client({ connectionString: urlAdministracion.toString() });
try {
  await conexion.connect();
  if (!(await conexion.query('SELECT 1 FROM pg_database WHERE datname=$1', ['nutri_test'])).rowCount) await conexion.query('CREATE DATABASE nutri_test');
} finally { await conexion.end(); }
execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit', env: entornoPruebas, windowsHide: true });
execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...(process.argv.includes('--integration') ? ['tests/integration'] : [])], { stdio: 'inherit', env: entornoPruebas, windowsHide: true });
