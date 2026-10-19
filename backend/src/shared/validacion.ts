import { z } from 'zod';
import { DateTime } from 'luxon';
import { obtenerAhora } from './fechas.js';

export const esquemaUuid = z.uuid();
export const texto = (maximo: number) => z.string().trim().min(1).max(maximo);
export const textoOpcional = (maximo: number) => z.string().trim().max(maximo)
  .transform(valor => valor === '' ? null : valor).nullable().optional();
export const correo = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const esquemaFecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  valor => DateTime.fromISO(valor).isValid, 'La fecha no es válida.',
);
export const esquemaFechaNoFutura = esquemaFecha.refine(
  valor => valor <= obtenerAhora().toISODate()!, 'La fecha no puede ser futura.',
);
export const esquemaPaginacion = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export function crearMetadatos(pagina: number, tamanio: number, total: number) {
  return { page: pagina, pageSize: tamanio, total, totalPages: Math.ceil(total / tamanio) };
}
