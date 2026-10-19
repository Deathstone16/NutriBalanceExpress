import { baseDatos } from '../../database/cliente.js';
import { recursoNoEncontrado } from '../../shared/errors/error-aplicacion.js';
import { crearMetadatos } from '../../shared/validacion.js';
import { prepararAtencion } from '../turnos/turnos.servicio.js';
import { repositorioConsultas } from './consultas.repositorio.js';
import { presentarConsulta } from './consultas.presentador.js';
import type { DatosConsulta } from './consultas.esquemas.js';

async function exigirPaciente(id: string) {
  if (!await baseDatos.paciente.findUnique({ where: { id }, select: { id: true } })) throw recursoNoEncontrado('No se encontró el paciente.');
}
export async function registrarConsulta(pacienteId: string, datos: DatosConsulta) {
  await exigirPaciente(pacienteId);
  const consulta = await baseDatos.$transaction(async transaccion => {
    if (datos.appointmentId) await prepararAtencion(transaccion, datos.appointmentId, pacienteId, datos.date);
    return repositorioConsultas.crear(transaccion, pacienteId, datos);
  });
  return presentarConsulta(consulta);
}
export async function listarHistorial(pacienteId: string, pagina: number, tamanio: number) {
  await exigirPaciente(pacienteId);
  const [consultas, total] = await repositorioConsultas.listar(pacienteId, pagina, tamanio);
  return { data: consultas.map(presentarConsulta), meta: crearMetadatos(pagina, tamanio, total) };
}
