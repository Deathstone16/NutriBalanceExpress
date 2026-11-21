import { baseDatos } from '../../database/cliente.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { SolicitudTurno } from './turnos.esquemas.js';

export const repositorioTurnos = {
  buscar: (id: string) => baseDatos.turno.findUnique({ where: { id } }),
  buscarOcupados: (desde: Date, hasta: Date) => baseDatos.turno.findMany({
    where: { inicio: { gte: desde, lt: hasta }, estado: { not: 'cancelled' } }, select: { inicio: true },
  }),
  crear: (datos: SolicitudTurno, pacienteId: string | null, inicio: Date, fin: Date, tokenHash: string, venceEn: Date) => baseDatos.turno.create({ data: {
    pacienteId, nombreContacto: datos.contactName, telefonoContacto: datos.contactPhone,
    correoContacto: datos.contactEmail, documentoContacto: datos.contactDocumentNumber, inicio, fin,
    tokenConfirmacionHash: tokenHash, confirmacionVenceEn: venceEn,
  } }),
  buscarPorToken: (tokenHash: string) => baseDatos.turno.findFirst({ where: { tokenConfirmacionHash: tokenHash }, select: { id: true } }),
  // Libera horarios de solicitudes cuyo correo no se confirmó a tiempo.
  expirarSinConfirmar: () => baseDatos.turno.updateMany({
    where: { estado: 'pending', correoConfirmadoEn: null, confirmacionVenceEn: { lt: new Date() } },
    data: { estado: 'cancelled' },
  }),
  cancelar: (id: string) => baseDatos.turno.update({ where: { id }, data: { estado: 'cancelled' } }),
  // Reconoce a quien ya es paciente: primero por DNI (único); si no, por correo solo cuando
  // hay una única ficha con ese correo y sin DNI cargado (un DNI distinto indica otra persona).
  reconocerPaciente: async (documento: string, correo?: string | null) => {
    const porDocumento = await baseDatos.paciente.findUnique({ where: { documento }, select: { id: true } });
    if (porDocumento) return porDocumento.id;
    if (!correo) return null;
    const porCorreo = await baseDatos.paciente.findMany({
      where: { correo: { equals: correo, mode: 'insensitive' }, documento: null }, select: { id: true }, take: 2,
    });
    return porCorreo.length === 1 ? porCorreo[0]!.id : null;
  },
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
