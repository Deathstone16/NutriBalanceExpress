import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type { RequestHandler } from 'express';
import { poolSesiones } from '../database/cliente.js';
import { entorno } from './entorno.js';
import { crearConfiguracionHttp, type OpcionesCookie } from './http.js';

export const NOMBRE_COOKIE_SESION = 'nutri.sid';
export const DURACION_SESION_ANONIMA_MS = Math.min(60 * 60 * 1000, entorno.SESSION_TTL_HOURS * 60 * 60 * 1000);
export const DURACION_SESION_AUTENTICADA_MS = entorno.SESSION_TTL_HOURS * 60 * 60 * 1000;

export function configurarSesion(opcionesCookie: OpcionesCookie = crearConfiguracionHttp().cookie): RequestHandler {
  const AlmacenPostgres = connectPgSimple(session);

  const middlewareSesion = session({
    name: NOMBRE_COOKIE_SESION,
    secret: entorno.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    unset: 'destroy',
    store: new AlmacenPostgres({
      pool: poolSesiones,
      tableName: 'sessions',
      createTableIfMissing: false,
      disableTouch: true,
    }),
    cookie: {
      ...opcionesCookie,
      maxAge: DURACION_SESION_ANONIMA_MS,
    },
  });

  return (peticion, respuesta, siguiente) => middlewareSesion(peticion, respuesta, error => {
    if (error) {
      siguiente(error);
      return;
    }

    // express-session toca la cookie al responder. Reducir su maxAge al tiempo
    // realmente restante conserva el vencimiento absoluto en cada respuesta.
    if (peticion.session.venceEn) {
      const vencimiento = Date.parse(peticion.session.venceEn);
      if (Number.isFinite(vencimiento)) {
        peticion.session.cookie.originalMaxAge = Math.max(0, vencimiento - Date.now());
      }
    }
    siguiente();
  });
}
