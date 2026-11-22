import { z } from 'zod';
import { correo, esquemaFecha, esquemaPaginacion, esquemaUuid, texto } from '../../shared/validacion.js';
import { DateTime } from 'luxon';

export const esquemaDisponibilidad = z.object({ date: esquemaFecha }).strict();
export const esquemaSolicitudTurno = z.object({
  contactName: texto(160), contactPhone: texto(30).min(6),
  contactEmail: correo,
  contactDocumentNumber: z.string().trim().regex(/^\d{7,9}$/, 'Ingresá un DNI de 7 a 9 números, sin puntos.'),
  startsAt: z.iso.datetime({ offset: true }).refine(valor => DateTime.fromISO(valor).isValid),
}).strict();
// Token de 32 bytes en base64url (43 caracteres), enviado solo por correo.
export const esquemaConfirmarCorreo = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'El enlace no es válido.') }).strict();
// Turno cargado por la profesional para un paciente existente: nace confirmado, sin correo de por medio.
export const esquemaTurnoInterno = z.object({
  patientId: esquemaUuid,
  startsAt: z.iso.datetime({ offset: true }).refine(valor => DateTime.fromISO(valor).isValid),
}).strict();
// Reenvío del correo de una solicitud sin confirmar; con contactEmail también corrige la dirección.
export const esquemaReenvioConfirmacion = z.object({ id: esquemaUuid, contactEmail: correo.optional() }).strict();
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
export type TurnoInterno = z.infer<typeof esquemaTurnoInterno>;
export type ReenvioConfirmacion =z.infer<typeof esquemaReenvioConfirmacion>;
export type FiltroAgenda =z.infer<typeof esquemaAgenda>;
export type CambioTurno = z.infer<typeof esquemaCambioTurno>;
