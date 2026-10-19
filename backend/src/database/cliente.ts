import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { entorno } from '../config/entorno.js';

export const poolSesiones = new pg.Pool({ connectionString: entorno.DATABASE_URL, max: 5 });
export const baseDatos = new PrismaClient({
  adapter: new PrismaPg({ connectionString: entorno.DATABASE_URL, max: 10 }),
});

export async function cerrarConexiones() {
  await Promise.all([baseDatos.$disconnect(), poolSesiones.end()]);
}
