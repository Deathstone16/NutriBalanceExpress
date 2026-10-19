import type { Consulta } from '../../generated/prisma/client.js';
import { mostrarFechaCivil } from '../../shared/fechas.js';

export function presentarConsulta(consulta: Consulta) {
  return {
    id: consulta.id, patientId: consulta.pacienteId, appointmentId: consulta.turnoId,
    date: mostrarFechaCivil(consulta.fecha), reason: consulta.motivo, objective: consulta.objetivo,
    observations: consulta.observaciones, weightKg: consulta.pesoKg?.toNumber() ?? null,
    heightCm: consulta.alturaCm?.toNumber() ?? null, waistCm: consulta.cinturaCm?.toNumber() ?? null,
    instructions: consulta.indicaciones, createdAt: consulta.creadoEn.toISOString(), updatedAt: consulta.actualizadoEn.toISOString(),
  };
}
