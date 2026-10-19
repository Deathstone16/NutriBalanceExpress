import { DateTime } from 'luxon';
import { Prisma } from '../../generated/prisma/client.js';
import { baseDatos } from '../../database/cliente.js';
import { ErrorAplicacion, recursoNoEncontrado } from '../../shared/errors/error-aplicacion.js';
import { obtenerAhora, ZONA_CONSULTORIO, fechaLocal } from '../../shared/fechas.js';
import { crearMetadatos } from '../../shared/validacion.js';
import { bloquearTurno, repositorioTurnos } from './turnos.repositorio.js';
import { presentarRecibo, presentarTurno } from './turnos.presentador.js';
import type { CambioTurno, FiltroAgenda, SolicitudTurno } from './turnos.esquemas.js';

export function generarHorarios(fecha: string, ahora = obtenerAhora()) {
  const dia = DateTime.fromISO(fecha, { zone: ZONA_CONSULTORIO }).startOf('day');
  if (dia < ahora.startOf('day') || dia > ahora.startOf('day').plus({ days: 60 })) {
    throw new ErrorAplicacion(400, 'VALIDATION_ERROR', 'Elegí una fecha entre hoy y los próximos 60 días.', [{ field: 'date', message: 'Fecha fuera del rango disponible.' }]);
  }
  if (dia.weekday > 5) return [];
  return Array.from({ length: 16 }, (_, indice) => dia.set({ hour: 9 }).plus({ minutes: 30 * indice }))
    .filter(inicio => inicio > ahora)
    .map(inicio => ({ startsAt: inicio.toUTC().toISO()!, endsAt: inicio.plus({ minutes: 30 }).toUTC().toISO()! }));
}

export async function consultarDisponibilidad(fecha: string) {
  const horarios = generarHorarios(fecha);
  const dia = DateTime.fromISO(fecha, { zone: ZONA_CONSULTORIO });
  const ocupados = await repositorioTurnos.buscarOcupados(dia.toJSDate(), dia.plus({ days: 1 }).toJSDate());
  const iniciosOcupados = new Set(ocupados.map(turno => turno.inicio.getTime()));
  return { date: fecha, timeZone: ZONA_CONSULTORIO, slots: horarios.filter(horario => !iniciosOcupados.has(Date.parse(horario.startsAt))) };
}

export async function solicitarTurno(datos: SolicitudTurno) {
  const inicio = DateTime.fromISO(datos.startsAt).setZone(ZONA_CONSULTORIO);
  const horarioValido = generarHorarios(inicio.toISODate()!).some(horario => Date.parse(horario.startsAt) === inicio.toMillis());
  if (!horarioValido) throw new ErrorAplicacion(400, 'VALIDATION_ERROR', 'Elegí un horario futuro ofrecido por la agenda.', [{ field: 'startsAt', message: 'Horario inválido.' }]);
  try {
    const turno = await repositorioTurnos.crear(datos, inicio.toJSDate(), inicio.plus({ minutes: 30 }).toJSDate());
    return presentarRecibo(turno);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ErrorAplicacion(409, 'SLOT_UNAVAILABLE', 'El horario ya no está disponible.');
    }
    throw error;
  }
}

export async function listarAgenda(filtros: FiltroAgenda) {
  const desde = DateTime.fromISO(filtros.from, { zone: ZONA_CONSULTORIO }).toJSDate();
  const hasta = DateTime.fromISO(filtros.to, { zone: ZONA_CONSULTORIO }).plus({ days: 1 }).toJSDate();
  const condicion: Prisma.TurnoWhereInput = { inicio: { gte: desde, lt: hasta } };
  if (filtros.status) condicion.estado = filtros.status;
  if (filtros.patientId) condicion.pacienteId = filtros.patientId;
  const [turnos, total] = await repositorioTurnos.listar(condicion, filtros.page, filtros.pageSize);
  return { data: turnos.map(presentarTurno), meta: crearMetadatos(filtros.page, filtros.pageSize, total) };
}

export async function obtenerTurno(id: string) {
  const turno = await repositorioTurnos.buscar(id);
  if (!turno) throw recursoNoEncontrado('No se encontró el turno.');
  return presentarTurno(turno);
}

export async function cambiarTurno(id: string, cambio: CambioTurno) {
  return baseDatos.$transaction(async transaccion => {
    const turno = await bloquearTurno(transaccion, id);
    if (!turno) throw recursoNoEncontrado('No se encontró el turno.');
    if (cambio.patientId && turno.estado !== 'pending' && cambio.patientId !== turno.pacienteId) {
      throw new ErrorAplicacion(409, 'APPOINTMENT_PATIENT_MISMATCH', 'El turno ya está vinculado a otro paciente.');
    }
    if (turno.estado === cambio.status) return presentarTurno(turno);
    const destinos: Record<string, string[]> = { pending: ['confirmed', 'cancelled'], confirmed: ['attended', 'cancelled'], attended: [], cancelled: [] };
    if (!destinos[turno.estado]?.includes(cambio.status)) throw new ErrorAplicacion(409, 'INVALID_STATUS_TRANSITION', 'El cambio de estado no está permitido.');
    if (turno.estado === 'pending' && cambio.status === 'cancelled' && cambio.patientId) {
      throw new ErrorAplicacion(409, 'APPOINTMENT_PATIENT_MISMATCH', 'No se vincula paciente al cancelar una solicitud.');
    }
    let pacienteId = turno.pacienteId;
    if (cambio.status === 'confirmed') {
      if (!cambio.patientId) throw new ErrorAplicacion(409, 'PATIENT_REQUIRED', 'Seleccioná un paciente para confirmar.');
      if (!await transaccion.paciente.findUnique({ where: { id: cambio.patientId }, select: { id: true } })) throw recursoNoEncontrado('No se encontró el paciente.');
      pacienteId = cambio.patientId;
    }
    return presentarTurno(await transaccion.turno.update({ where: { id }, data: { estado: cambio.status, pacienteId } }));
  });
}

// Interfaz pública del módulo: consultas coordina este caso de uso en su transacción.
export async function prepararAtencion(transaccion: Prisma.TransactionClient, turnoId: string, pacienteId: string, fecha: string) {
  const turno = await bloquearTurno(transaccion, turnoId);
  if (!turno) throw recursoNoEncontrado('No se encontró el turno.');
  if (turno.pacienteId !== pacienteId) throw new ErrorAplicacion(409, 'APPOINTMENT_PATIENT_MISMATCH', 'El turno no corresponde al paciente.');
  if (await transaccion.consulta.findUnique({ where: { turnoId }, select: { id: true } })) throw new ErrorAplicacion(409, 'APPOINTMENT_ALREADY_LINKED', 'El turno ya tiene una consulta registrada.');
  if (turno.estado !== 'confirmed') throw new ErrorAplicacion(409, 'INVALID_STATUS_TRANSITION', 'Solo se puede atender un turno confirmado.');
  if (fechaLocal(turno.inicio) !== fecha || turno.inicio.getTime() > Date.now()) {
    throw new ErrorAplicacion(400, 'VALIDATION_ERROR', 'La consulta debe corresponder al día del turno y su horario debe haber comenzado.', [{ field: 'appointmentId', message: 'Fecha u horario de atención inválidos.' }]);
  }
  await transaccion.turno.update({ where: { id: turnoId }, data: { estado: 'attended' } });
}
