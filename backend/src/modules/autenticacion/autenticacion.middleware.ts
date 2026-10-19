import type { RequestHandler } from 'express';
import { ErrorAplicacion } from '../../shared/errors/error-aplicacion.js';

export const exigirAutenticacion: RequestHandler = (peticion, _respuesta, siguiente) => {
  const venceEn = peticion.session.venceEn ? Date.parse(peticion.session.venceEn) : NaN;
  if (!peticion.session.usuarioId || !Number.isFinite(venceEn) || Date.now() >= venceEn) {
    siguiente(new ErrorAplicacion(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar.'));
    return;
  }
  siguiente();
};
