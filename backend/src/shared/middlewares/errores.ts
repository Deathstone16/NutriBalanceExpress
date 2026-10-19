import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ErrorAplicacion } from '../errors/error-aplicacion.js';

export const manejarErrores: ErrorRequestHandler = (error: unknown, _peticion, respuesta, _siguiente) => {
  let fallo = error instanceof ErrorAplicacion ? error : undefined;
  if (error instanceof ZodError) fallo = new ErrorAplicacion(400, 'VALIDATION_ERROR', 'Revisá los campos indicados.', error.issues.map(detalle => ({
    field: detalle.path.join('.') || '_', message: detalle.message,
  })));
  if (!fallo && error && typeof error === 'object' && 'status' in error && (error.status === 400 || error.status === 413)) {
    fallo = new ErrorAplicacion(400, 'VALIDATION_ERROR', 'El cuerpo JSON no es válido o supera el límite de 32 KiB.');
  }
  if (!fallo) {
    console.error(JSON.stringify({ requestId: respuesta.locals.identificadorPeticion, evento: 'error_interno', tipo: error instanceof Error ? error.name : 'Unknown' }));
    fallo = new ErrorAplicacion(500, 'INTERNAL_ERROR', 'No se pudo completar la operación.');
  }
  respuesta.status(fallo.estadoHttp).json({ error: { code: fallo.codigo, message: fallo.message, details: fallo.detalles }, requestId: respuesta.locals.identificadorPeticion });
};
