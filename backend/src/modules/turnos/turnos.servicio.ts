import { createHash, randomBytes } from 'node:crypto';
import { DateTime } from 'luxon';
import { Prisma } from '../../generated/prisma/client.js';
import { baseDatos } from '../../database/cliente.js';
import { ErrorAplicacion, recursoNoEncontrado } from '../../shared/errors/error-aplicacion.js';
import { obtenerAhora, ZONA_CONSULTORIO, fechaLocal } from '../../shared/fechas.js';
import { crearMetadatos } from '../../shared/validacion.js';
import { entorno } from '../../config/entorno.js';
import { crearTransporte, remitente } from '../../shared/correo/transporte.js';
import { correoConfirmacionTurno } from '../../shared/correo/plantillas.js';
import { bloquearTurno, repositorioTurnos } from './turnos.repositorio.js';
import { presentarRecibo, presentarTurno } from './turnos.presentador.js';
import type { CambioTurno, FiltroAgenda, ReenvioConfirmacion, SolicitudTurno, TurnoInterno } from './turnos.esquemas.js';

/** Tiempo para confirmar el correo; pasado ese plazo la solicitud se cancela y el horario se libera. */
export const VIGENCIA_CONFIRMACION_HORAS = 2;
/** Espera mínima entre dos envíos del correo de una misma solicitud. */
export const ESPERA_REENVIO_SEGUNDOS = 60;
const transporteCorreo = crearTransporte();
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

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
  await repositorioTurnos.expirarSinConfirmar();
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
  await repositorioTurnos.expirarSinConfirmar();
  // El recibo público no revela si la persona fue reconocida; el vínculo solo se ve en el panel.
  const pacienteId = await repositorioTurnos.reconocerPaciente(datos.contactDocumentNumber, datos.contactEmail);
  const token = randomBytes(32).toString('base64url');
  const venceEn = obtenerAhora().plus({ hours: VIGENCIA_CONFIRMACION_HORAS });
  let turno;
  try {
    turno = await repositorioTurnos.crear(datos, pacienteId, inicio.toJSDate(), inicio.plus({ minutes: 30 }).toJSDate(), hashToken(token), venceEn.toJSDate());
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ErrorAplicacion(409, 'SLOT_UNAVAILABLE', 'El horario ya no está disponible.');
    }
    throw error;
  }
  try {
    await enviarConfirmacion(datos.contactName, datos.contactEmail, inicio, token, venceEn);
  } catch (error) {
    // Sin correo la persona no puede confirmar: se libera el horario y se informa el fallo.
    await repositorioTurnos.cancelar(turno.id);
    console.error(JSON.stringify({ evento: 'correo_no_enviado', turnoId: turno.id, motivo: error instanceof Error ? error.message : 'desconocido' }));
    throw new ErrorAplicacion(502, 'EMAIL_DELIVERY_FAILED', 'No pudimos enviar el correo de confirmación. Revisá la dirección e intentá de nuevo.', [{ field: 'contactEmail', message: 'No pudimos enviar el correo a esta dirección.' }]);
  }
  return presentarRecibo(turno);
}

/** La profesional agenda a un paciente existente: el turno nace confirmado (sin correo de por medio). */
export async function crearTurnoInterno(datos: TurnoInterno) {
  const inicio = DateTime.fromISO(datos.startsAt).setZone(ZONA_CONSULTORIO);
  const horarioValido = generarHorarios(inicio.toISODate()!).some(horario => Date.parse(horario.startsAt) === inicio.toMillis());
  if (!horarioValido) throw new ErrorAplicacion(400, 'VALIDATION_ERROR', 'Elegí un horario futuro ofrecido por la agenda.', [{ field: 'startsAt', message: 'Horario inválido.' }]);
  const paciente = await baseDatos.paciente.findUnique({ where: { id: datos.patientId } });
  if (!paciente) throw recursoNoEncontrado('No se encontró el paciente.');
  await repositorioTurnos.expirarSinConfirmar();
  try {
    return presentarTurno(await repositorioTurnos.crearConfirmado(paciente, inicio.toJSDate(), inicio.plus({ minutes: 30 }).toJSDate()));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ErrorAplicacion(409, 'SLOT_UNAVAILABLE', 'El horario ya no está disponible.');
    }
    throw error;
  }
}

function enviarConfirmacion(nombre: string, correo: string, inicio: DateTime, token: string, venceEn: DateTime) {
  return transporteCorreo.enviar(correoConfirmacionTurno(correo, remitente(), {
    nombre,
    fecha: inicio.setLocale('es-AR').toFormat("cccc d 'de' LLLL 'de' yyyy"),
    hora: inicio.toFormat('HH:mm'),
    enlace: `${entorno.PUBLIC_WEB_ORIGIN ?? entorno.APP_ORIGIN}/confirmar-turno?token=${token}`,
    venceHora: venceEn.setZone(ZONA_CONSULTORIO).toFormat('HH:mm'),
  }));
}

/**
 * Reenvía el correo de confirmación, con token nuevo (el anterior deja de servir), y permite
 * corregir la dirección. El vencimiento original no se extiende, así que reenviar no sirve
 * para retener un horario indefinidamente; entre envíos hay una espera.
 */
export async function reenviarConfirmacion(datos: ReenvioConfirmacion) {
  await repositorioTurnos.expirarSinConfirmar();
  const turno = await repositorioTurnos.buscar(datos.id);
  if (!turno || !turno.correoContacto) throw recursoNoEncontrado('No encontramos la solicitud.');
  if (turno.correoConfirmadoEn) throw new ErrorAplicacion(409, 'ALREADY_CONFIRMED', 'Tu correo ya está confirmado.');
  if (turno.estado !== 'pending' || !turno.confirmacionVenceEn || turno.confirmacionVenceEn.getTime() <= Date.now()) {
    throw new ErrorAplicacion(409, 'CONFIRMATION_EXPIRED', 'La solicitud venció y el horario se liberó. Pedí un nuevo turno.');
  }
  const espera = ESPERA_REENVIO_SEGUNDOS - Math.floor((Date.now() - turno.actualizadoEn.getTime()) / 1000);
  if (espera > 0) {
    throw new ErrorAplicacion(429, 'RESEND_TOO_SOON', `Esperá ${espera} segundos para volver a pedir el correo.`, [], espera);
  }
  const correo = datos.contactEmail ?? turno.correoContacto;
  const token = randomBytes(32).toString('base64url');
  const inicio = DateTime.fromJSDate(turno.inicio).setZone(ZONA_CONSULTORIO);
  try {
    await enviarConfirmacion(turno.nombreContacto, correo, inicio, token, DateTime.fromJSDate(turno.confirmacionVenceEn));
  } catch (error) {
    console.error(JSON.stringify({ evento: 'correo_no_reenviado', turnoId: turno.id, motivo: error instanceof Error ? error.message : 'desconocido' }));
    throw new ErrorAplicacion(502, 'EMAIL_DELIVERY_FAILED', 'No pudimos enviar el correo. Revisá la dirección e intentá de nuevo.', [{ field: 'contactEmail', message: 'No pudimos enviar el correo a esta dirección.' }]);
  }
  const cambioCorreo = correo !== turno.correoContacto;
  const pacienteId = cambioCorreo && !turno.pacienteId && turno.documentoContacto
    ? await repositorioTurnos.reconocerPaciente(turno.documentoContacto, correo) : turno.pacienteId;
  await repositorioTurnos.actualizarConfirmacion(turno.id, { correoContacto: correo, tokenConfirmacionHash: hashToken(token), pacienteId });
  return { sentTo: correo, emailChanged: cambioCorreo, confirmationExpiresAt: turno.confirmacionVenceEn.toISOString() };
}

/** La persona abre el enlace del correo: su solicitud pasa a "correo confirmado". */
export async function confirmarCorreoTurno(token: string) {
  const encontrado = await repositorioTurnos.buscarPorToken(hashToken(token));
  if (!encontrado) throw new ErrorAplicacion(404, 'CONFIRMATION_LINK_INVALID', 'El enlace no es válido.');
  const resultado = await baseDatos.$transaction(async transaccion => {
    const turno = await bloquearTurno(transaccion, encontrado.id);
    if (!turno) return { tipo: 'invalido' as const };
    if (turno.correoConfirmadoEn) return { tipo: 'ok' as const, turno, yaConfirmado: true };
    const vencido = turno.estado === 'cancelled' || (turno.confirmacionVenceEn !== null && turno.confirmacionVenceEn < new Date());
    if (vencido) {
      if (turno.estado === 'pending') await transaccion.turno.update({ where: { id: turno.id }, data: { estado: 'cancelled' } });
      return { tipo: 'vencido' as const };
    }
    return { tipo: 'ok' as const, yaConfirmado: false, turno: await transaccion.turno.update({ where: { id: turno.id }, data: { correoConfirmadoEn: new Date() } }) };
  });
  if (resultado.tipo === 'invalido') throw new ErrorAplicacion(404, 'CONFIRMATION_LINK_INVALID', 'El enlace no es válido.');
  if (resultado.tipo === 'vencido') throw new ErrorAplicacion(409, 'CONFIRMATION_EXPIRED', 'El enlace venció y el horario se liberó. Pedí un nuevo turno.');
  const { turno } = resultado;
  return { emailConfirmed: true, alreadyConfirmed: resultado.yaConfirmado, startsAt: turno.inicio.toISOString(), endsAt: turno.fin.toISOString(), status: turno.estado };
}

export async function listarAgenda(filtros: FiltroAgenda) {
  await repositorioTurnos.expirarSinConfirmar();
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
    if (cambio.status === 'confirmed' && !turno.correoConfirmadoEn) {
      throw new ErrorAplicacion(409, 'EMAIL_NOT_CONFIRMED', 'La persona todavía no confirmó su turno desde el correo.');
    }
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
  if (fechaLocal(turno.inicio) !== fecha) {
    throw new ErrorAplicacion(400, 'VALIDATION_ERROR', 'La consulta debe corresponder al día del turno.', [{ field: 'appointmentId', message: 'La fecha de la consulta debe coincidir con la del turno.' }]);
  }
  await transaccion.turno.update({ where: { id: turnoId }, data: { estado: 'attended' } });
}
