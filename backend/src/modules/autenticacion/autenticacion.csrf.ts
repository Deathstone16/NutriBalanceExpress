import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { DURACION_SESION_ANONIMA_MS } from '../../config/sesion.js';
import { ErrorAplicacion } from '../../shared/errors/error-aplicacion.js';

const errorCsrf = () => new ErrorAplicacion(403, 'CSRF_INVALID', 'El token CSRF no es válido.');

export function asegurarTokenCsrf(peticion: Request): string {
  if (!peticion.session.venceEn) {
    const venceEn = new Date(Date.now() + DURACION_SESION_ANONIMA_MS);
    peticion.session.venceEn = venceEn.toISOString();
    peticion.session.cookie.expires = venceEn;
  }

  if (!peticion.session.tokenCsrf) {
    peticion.session.tokenCsrf = randomBytes(32).toString('base64url');
  }

  return peticion.session.tokenCsrf;
}

export const verificarCsrf: RequestHandler = (peticion, _respuesta, siguiente) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(peticion.method)) {
    siguiente();
    return;
  }

  const tokenSesion = peticion.session.tokenCsrf;
  const tokenEnviado = peticion.get('X-CSRF-Token');
  const venceEn = peticion.session.venceEn ? Date.parse(peticion.session.venceEn) : NaN;
  if (!tokenSesion || !tokenEnviado || !Number.isFinite(venceEn) || Date.now() >= venceEn) {
    siguiente(errorCsrf());
    return;
  }

  const esperado = Buffer.from(tokenSesion);
  const recibido = Buffer.from(tokenEnviado);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) {
    siguiente(errorCsrf());
    return;
  }

  siguiente();
};
