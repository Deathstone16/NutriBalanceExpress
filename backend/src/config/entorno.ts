import 'dotenv/config';
import { z } from 'zod';

export const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  TRUST_PROXY: z.enum(['none', 'loopback', 'one']).optional(),
  SESSION_COOKIE_SECURE: z.enum(['true', 'false']).transform(valor => valor === 'true').optional(),
  SESSION_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  SESSION_SECRET: z.string().min(43),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(12),
  CLINIC_TIME_ZONE: z.literal('America/Argentina/Buenos_Aires').default('America/Argentina/Buenos_Aires'),
}).superRefine((datos, contexto) => {
  const cookieSegura = datos.SESSION_COOKIE_SECURE ?? datos.NODE_ENV === 'production';
  if (datos.SESSION_COOKIE_SAME_SITE === 'none' && !cookieSegura) {
    contexto.addIssue({ code: 'custom', path: ['SESSION_COOKIE_SECURE'], message: 'SameSite=none requiere una cookie Secure y acceso HTTPS.' });
  }
  if (datos.NODE_ENV === 'production' && !cookieSegura) {
    contexto.addIssue({ code: 'custom', path: ['SESSION_COOKIE_SECURE'], message: 'En producción la cookie debe ser Secure.' });
  }
  const origen = new URL(datos.APP_ORIGIN);
  if (!['http:', 'https:'].includes(origen.protocol) || origen.origin !== datos.APP_ORIGIN) {
    contexto.addIssue({ code: 'custom', path: ['APP_ORIGIN'], message: 'Usá el origen exacto del frontend, sin rutas ni barra final.' });
  }
});

export const entorno = esquemaEntorno.parse(process.env);
export type Entorno = z.infer<typeof esquemaEntorno>;
