import 'dotenv/config';
import { z } from 'zod';

export const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  // Sitio que abre la persona desde el correo. Si falta, se usa APP_ORIGIN. Hace falta cuando
  // APP_ORIGIN es el origen interno del gateway (protegido) y no la web pública.
  PUBLIC_WEB_ORIGIN: z.preprocess(valor => valor === '' ? undefined : valor, z.url().optional()),
  TRUST_PROXY: z.enum(['none', 'loopback', 'one']).optional(),
  SESSION_COOKIE_SECURE: z.enum(['true', 'false']).transform(valor => valor === 'true').optional(),
  SESSION_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  SESSION_SECRET: z.string().min(43),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(12),
  CLINIC_TIME_ZONE: z.literal('America/Argentina/Buenos_Aires').default('America/Argentina/Buenos_Aires'),
  // Correo saliente. Sin MAIL_SMTP_URL, en desarrollo los correos se guardan en .local/correos.
  MAIL_SMTP_URL: z.preprocess(valor => valor === '' ? undefined : valor,
    z.string().regex(/^smtps?:\/\//, 'Usá smtp://usuario:clave@servidor:587 o smtps://usuario:clave@servidor:465.').optional()),
  MAIL_FROM: z.string().trim().min(3).max(200).default('NutriBalance <no-reply@nutribalance.test>'),
}).superRefine((datos, contexto) => {
  const cookieSegura = datos.SESSION_COOKIE_SECURE ?? datos.NODE_ENV === 'production';
  if (datos.SESSION_COOKIE_SAME_SITE === 'none' && !cookieSegura) {
    contexto.addIssue({ code: 'custom', path: ['SESSION_COOKIE_SECURE'], message: 'SameSite=none requiere una cookie Secure y acceso HTTPS.' });
  }
  if (datos.NODE_ENV === 'production' && !cookieSegura) {
    contexto.addIssue({ code: 'custom', path: ['SESSION_COOKIE_SECURE'], message: 'En producción la cookie debe ser Secure.' });
  }
  for (const campo of ['APP_ORIGIN', 'PUBLIC_WEB_ORIGIN'] as const) {
    const valor = datos[campo];
    if (valor === undefined) continue;
    const origen = new URL(valor);
    if (!['http:', 'https:'].includes(origen.protocol) || origen.origin !== valor) {
      contexto.addIssue({ code: 'custom', path: [campo], message: 'Usá el origen exacto del frontend, sin rutas ni barra final.' });
    }
  }
});

export const entorno = esquemaEntorno.parse(process.env);
export type Entorno = z.infer<typeof esquemaEntorno>;
