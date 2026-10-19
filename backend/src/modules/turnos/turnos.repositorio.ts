import { baseDatos } from '../../database/cliente.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { SolicitudTurno } from './turnos.esquemas.js';

export const repositorioTurnos = {
  buscar: (id: string) => baseDatos.turno.findUnique({ where: { id } }),
  buscarOcupados: (desde: Date, hasta: Date) => baseDatos.turno.findMany({
    where: { inicio: { gte: desde, lt: hasta }, estado: { not: 'cancelled' } }, select: { inicio: true },
  }),
  crear: (datos: SolicitudTurno, inicio: Date, fin: Date) => baseDatos.turno.create({ data: {
    nombreContacto: datos.contactName, telefonoContacto: datos.contactPhone,
    correoContacto: datos.contactEmail ?? null, inicio, fin,
  } }),
  listar: (condicion: Prisma.TurnoWhereInput, pagina: number, tamanio: number) => baseDatos.$transaction([
    baseDatos.turno.findMany({ where: condicion, skip: (pagina - 1) * tamanio, take: tamanio, orderBy: [{ inicio: 'asc' }, { id: 'asc' }] }),
    baseDatos.turno.count({ where: condicion }),
  ]),
};

// Bloqueo compartido por los casos de uso que escriben sobre un turno.
export async function bloquearTurno(transaccion: Prisma.TransactionClient, id: string) {
  await transaccion.$queryRaw`SELECT id FROM appointments WHERE id = ${id}::uuid FOR UPDATE`;
  return transaccion.turno.findUnique({ where: { id } });
}
