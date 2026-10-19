import type { Turno } from '../../generated/prisma/client.js';

export function presentarTurno(turno: Turno) {
  return {
    id: turno.id, patientId: turno.pacienteId, contactName: turno.nombreContacto,
    contactPhone: turno.telefonoContacto, contactEmail: turno.correoContacto,
    startsAt: turno.inicio.toISOString(), endsAt: turno.fin.toISOString(), status: turno.estado,
    createdAt: turno.creadoEn.toISOString(), updatedAt: turno.actualizadoEn.toISOString(),
  };
}
export function presentarRecibo(turno: Turno) {
  return { id: turno.id, startsAt: turno.inicio.toISOString(), endsAt: turno.fin.toISOString(), status: turno.estado };
}
