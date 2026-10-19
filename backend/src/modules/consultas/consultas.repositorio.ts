import { baseDatos } from '../../database/cliente.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { fechaCivil } from '../../shared/fechas.js';
import type { DatosConsulta } from './consultas.esquemas.js';

export const repositorioConsultas = {
  crear: (transaccion: Prisma.TransactionClient, pacienteId: string, datos: DatosConsulta) => transaccion.consulta.create({ data: {
    pacienteId, turnoId: datos.appointmentId ?? null, fecha: fechaCivil(datos.date),
    motivo: datos.reason, objetivo: datos.objective ?? null, observaciones: datos.observations ?? null,
    pesoKg: datos.weightKg ?? null, alturaCm: datos.heightCm ?? null, cinturaCm: datos.waistCm ?? null,
    indicaciones: datos.instructions,
  } }),
  listar: (pacienteId: string, pagina: number, tamanio: number) => baseDatos.$transaction([
    baseDatos.consulta.findMany({ where: { pacienteId }, skip: (pagina - 1) * tamanio, take: tamanio, orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }, { id: 'desc' }] }),
    baseDatos.consulta.count({ where: { pacienteId } }),
  ]),
};
