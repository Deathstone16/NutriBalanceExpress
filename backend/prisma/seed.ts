import 'dotenv/config';
import { hash, argon2id } from 'argon2';
import { baseDatos, cerrarConexiones } from '../src/database/cliente.js';
import { z } from 'zod';

const datos = z.object({ SEED_PROFESSIONAL_EMAIL: z.email(), SEED_PROFESSIONAL_PASSWORD: z.string().min(12).max(128) }).parse(process.env);
try {
  const correo = datos.SEED_PROFESSIONAL_EMAIL.trim().toLowerCase();
  await baseDatos.usuario.upsert({ where: { correo }, update: {}, create: {
    correo, nombreVisible: 'Nutricionista de prueba', claveHash: await hash(datos.SEED_PROFESSIONAL_PASSWORD, { type: argon2id }),
  } });
  console.log('Cuenta profesional ficticia preparada. Una cuenta existente conserva su contraseña.');
} finally { await cerrarConexiones(); }
