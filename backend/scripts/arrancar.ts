import { existsSync } from 'node:fs';
import { spawnSync, fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as esperar } from 'node:timers/promises';
import { config } from 'dotenv';
import pg from 'pg';
import { crearEntornoTunel } from './perfil-tunel.js';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const argumentos = new Set(process.argv.slice(2));
if ([...argumentos].some(valor => !['--portable', '--tunel'].includes(valor))) {
  throw new Error('Opciones disponibles: --portable y --tunel.');
}

function ejecutar(argumentosNode: string[], entorno: NodeJS.ProcessEnv = process.env) {
  const resultado = spawnSync(process.execPath, argumentosNode, { stdio: 'inherit', env: entorno, windowsHide: true });
  if (resultado.error || resultado.status !== 0) throw new Error(`No se pudo completar ${argumentosNode[0]}.`);
}

if (!existsSync('.env')) ejecutar(['--import', 'tsx', 'scripts/preparar-local.ts', '--solo-entorno']);
config({ quiet: true });
const entorno = argumentos.has('--tunel') ? crearEntornoTunel(process.env) : { ...process.env };
// Validar secretos/configuración antes de iniciar una base o modificar su esquema.
const { esquemaEntorno } = await import('../src/config/entorno.js');
esquemaEntorno.parse(entorno);
const urlBase = new URL(entorno.DATABASE_URL!);
const procesos = new Set<ChildProcess>();
let cerrando = false;

async function baseDisponible() {
  const conexion = new pg.Client({ connectionString: entorno.DATABASE_URL, connectionTimeoutMillis: 1500 });
  try { await conexion.connect(); await conexion.query('SELECT 1'); return true; }
  catch (error) {
    // No confundir una contraseña incorrecta con una base apagada.
    if (error && typeof error === 'object' && 'code' in error && error.code === '28P01') {
      throw new Error('PostgreSQL rechazó las credenciales de DATABASE_URL. Se conserva la base existente.');
    }
    return false;
  } finally { await conexion.end(); }
}

function iniciar(archivo: string, execArgv: string[] = []) {
  const hijo = fork(archivo, [], { execArgv, env: entorno, stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true });
  procesos.add(hijo);
  hijo.on('error', () => { console.error(`No se pudo iniciar ${archivo}.`); void cerrar(1); });
  hijo.on('exit', codigo => {
    procesos.delete(hijo);
    if (!cerrando) { console.error(`${archivo} terminó (${codigo ?? 'señal'}).`); void cerrar(1); }
  });
  return hijo;
}

async function cerrar(codigo = 0) {
  if (cerrando) return;
  cerrando = true;
  // API primero; PostgreSQL después. Solo se detienen procesos creados por este comando.
  for (const hijo of [...procesos].reverse()) {
    if (hijo.exitCode !== null) continue;
    const terminado = new Promise<void>(resolver => hijo.once('exit', () => resolver()));
    if (hijo.connected) hijo.send('detener'); else hijo.kill();
    await Promise.race([terminado, esperar(12_000)]);
    if (hijo.exitCode === null) hijo.kill();
  }
  process.exit(codigo);
}
process.on('SIGINT', () => void cerrar());
process.on('SIGTERM', () => void cerrar());
process.on('message', mensaje => { if (mensaje === 'detener') void cerrar(); });

try {
  if (!await baseDisponible()) {
    if (!argumentos.has('--portable')) throw new Error('PostgreSQL no responde. Inicialo o usá serve:portable:tunnel para la base portable local.');
    if (!['localhost', '127.0.0.1'].includes(urlBase.hostname) || urlBase.pathname !== '/nutri_dev') {
      throw new Error('La base portable solo admite DATABASE_URL local terminada en /nutri_dev.');
    }
    iniciar('scripts/postgres-local.ts', ['--import', 'tsx']);
    let disponible = false;
    for (let intento = 0; intento < 60 && !cerrando; intento++) {
      if (await baseDisponible()) { disponible = true; break; }
      await esperar(500);
    }
    if (!disponible) throw new Error('PostgreSQL no quedó disponible. Revisá el puerto y la configuración local.');
  }
  console.log('Preparando cliente, migraciones y compilación de la API…');
  ejecutar(['node_modules/prisma/build/index.js', 'generate'], entorno);
  ejecutar(['node_modules/prisma/build/index.js', 'migrate', 'deploy'], entorno);
  // El seed crea únicamente la cuenta ficticia si no existe; nunca cambia contraseñas existentes.
  ejecutar(['--import', 'tsx', 'prisma/seed.ts'], entorno);
  ejecutar(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], entorno);
  iniciar('dist/server.js');
  console.log(argumentos.has('--tunel')
    ? `Perfil Cloudflare listo: origen ${entorno.APP_ORIGIN}, proxy local y cookie Secure. El túnel de api.neadev.com debe apuntar a http://127.0.0.1:${entorno.PORT}.`
    : 'Perfil local listo. Ctrl+C detiene la API y la base portable que inició este comando.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo iniciar la API.');
  await cerrar(1);
}
