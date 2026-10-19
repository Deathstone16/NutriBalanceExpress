import { z } from 'zod';
import { esquemaFechaNoFutura, esquemaPaginacion, esquemaUuid, texto, textoOpcional } from '../../shared/validacion.js';

const medida = (maximo: number) => z.number().positive().max(maximo).refine(valor =>
  Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-7, 'Usá como máximo dos decimales.',
).nullable().optional();
export const esquemaIdPaciente = z.object({ patientId: esquemaUuid }).strict();
export const esquemaHistorial = esquemaPaginacion.strict();
export const esquemaConsulta = z.object({
  date: esquemaFechaNoFutura, reason: texto(500), instructions: texto(4000),
  objective: textoOpcional(1000), observations: textoOpcional(4000),
  weightKg: medida(500), heightCm: medida(250), waistCm: medida(300),
  appointmentId: esquemaUuid.nullable().optional(),
}).strict();
export type DatosConsulta = z.infer<typeof esquemaConsulta>;
