import { rateLimit } from 'express-rate-limit';

function crearLimite(maximo: number, ventanaMs: number) {
  return rateLimit({ windowMs: ventanaMs, limit: maximo, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_peticion, respuesta) => respuesta.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intentá más tarde.', details: [] }, requestId: respuesta.locals.identificadorPeticion }),
  });
}
export const crearLimiteLogin = () => crearLimite(5, 15 * 60_000);
export const crearLimiteSolicitudes = () => crearLimite(10, 15 * 60_000);
export const crearLimiteDisponibilidad = () => crearLimite(60, 60_000);
