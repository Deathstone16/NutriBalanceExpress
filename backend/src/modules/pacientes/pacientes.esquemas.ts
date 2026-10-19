import { z } from 'zod';
import { correo, esquemaFechaNoFutura, esquemaPaginacion, esquemaUuid, texto, textoOpcional } from '../../shared/validacion.js';

const campoOpcionalNullable = <T extends z.ZodType>(esquema: T) => esquema.nullable().optional();

export const esquemaIdPaciente = z.object({ patientId: esquemaUuid }).strict();

export const esquemaListadoPacientes = esquemaPaginacion.extend({
  q: z.string().trim().max(100).optional(),
}).strict();

const camposPaciente = {
  firstName: texto(80),
  lastName: texto(80),
  phone: z.string().trim().min(6).max(30),
  documentNumber: campoOpcionalNullable(z.string().regex(/^\d{7,9}$/)),
  birthDate: campoOpcionalNullable(esquemaFechaNoFutura),
  email: campoOpcionalNullable(correo),
  background: textoOpcional(4000),
  allergies: textoOpcional(2000),
  medication: textoOpcional(2000),
};

export const esquemaCrearPaciente = z.object(camposPaciente).strict();

export const esquemaEditarPaciente = z.object(camposPaciente).partial().strict().refine(
  datos => Object.keys(datos).length > 0,
  { message: 'Enviá al menos un campo para actualizar.', path: [] },
);

