import { z } from 'zod';
import { correo, esquemaFecha, esquemaPaginacion, esquemaUuid, texto } from '../../shared/validacion.js';
import { DateTime } from 'luxon';

export const esquemaDisponibilidad = z.object({ date: esquemaFecha }).strict();
export const esquemaSolicitudTurno = z.object({
  contactName: texto(160), contactPhone: texto(30).min(6),
  contactEmail: correo.nullable().optional(),
  startsAt: z.iso.datetime({ offset: true }).refine(valor => DateTime.fromISO(valor).isValid),
}).strict();
export const esquemaAgenda = esquemaPaginacion.extend({
  from: esquemaFecha, to: esquemaFecha,
  status: z.enum(['pending', 'confirmed', 'attended', 'cancelled']).optional(),
  patientId: esquemaUuid.optional(),
}).strict().refine(datos => {
  const dias = DateTime.fromISO(datos.to).diff(DateTime.fromISO(datos.from), 'days').days;
  return dias >= 0 && dias < 31;
}, { path: ['to'], message: 'El rango debe abarcar entre 1 y 31 días.' });
export const esquemaIdTurno = z.object({ appointmentId: esquemaUuid }).strict();
export const esquemaCambioTurno = z.object({
  status: z.enum(['confirmed', 'attended', 'cancelled']), patientId: esquemaUuid.optional(),
}).strict();
export type SolicitudTurno = z.infer<typeof esquemaSolicitudTurno>;
export type FiltroAgenda = z.infer<typeof esquemaAgenda>;
export type CambioTurno = z.infer<typeof esquemaCambioTurno>;
