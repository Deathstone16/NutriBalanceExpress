import { ErrorAplicacion, recursoNoEncontrado } from '../../shared/errors/error-aplicacion.js';
import { fechaCivil } from '../../shared/fechas.js';
import type { z } from 'zod';
import {
  esquemaCrearPaciente,
  esquemaEditarPaciente,
  esquemaListadoPacientes,
} from './pacientes.esquemas.js';
import {
  PacientesRepositorio,
  type DatosCreacionPaciente,
  type DatosEdicionPaciente,
} from './pacientes.repositorio.js';
import { presentarPaciente } from './pacientes.presentador.js';

type DatosCreacion = z.infer<typeof esquemaCrearPaciente>;
type DatosEdicion = z.infer<typeof esquemaEditarPaciente>;
type FiltrosListado = z.infer<typeof esquemaListadoPacientes>;

function convertirDatosCreacion(datos: DatosCreacion): DatosCreacionPaciente {
  return {
    nombre: datos.firstName,
    apellido: datos.lastName,
    telefono: datos.phone,
    documento: datos.documentNumber,
    fechaNacimiento: datos.birthDate === undefined || datos.birthDate === null ? null : fechaCivil(datos.birthDate),
    correo: datos.email,
    antecedentes: datos.background,
    alergias: datos.allergies,
    medicacion: datos.medication,
  };
}

function convertirDatosEdicion(datos: DatosEdicion): DatosEdicionPaciente {
  const resultado: DatosEdicionPaciente = {};
  if (datos.firstName !== undefined) resultado.nombre = datos.firstName;
  if (datos.lastName !== undefined) resultado.apellido = datos.lastName;
  if (datos.phone !== undefined) resultado.telefono = datos.phone;
  if (datos.documentNumber !== undefined) resultado.documento = datos.documentNumber;
  if (datos.birthDate !== undefined) {
    resultado.fechaNacimiento = datos.birthDate === null ? null : fechaCivil(datos.birthDate);
  }
  if (datos.email !== undefined) resultado.correo = datos.email;
  if (datos.background !== undefined) resultado.antecedentes = datos.background;
  if (datos.allergies !== undefined) resultado.alergias = datos.allergies;
  if (datos.medication !== undefined) resultado.medicacion = datos.medication;
  return resultado;
}

function esDocumentoDuplicado(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export class PacientesServicio {
  constructor(private readonly repositorio: PacientesRepositorio) {}

  async listar(filtros: FiltrosListado) {
    const pagina = await this.repositorio.listar({
      busqueda: filtros.q || undefined,
      pagina: filtros.page,
      tamanio: filtros.pageSize,
    });
    return {
      data: pagina.pacientes.map(presentarPaciente),
      total: pagina.total,
    };
  }

  async obtener(id: string) {
    const paciente = await this.repositorio.obtenerPorId(id);
    if (!paciente) throw recursoNoEncontrado('No se encontró el paciente.');
    return presentarPaciente(paciente);
  }

  async crear(datos: DatosCreacion) {
    try {
      return presentarPaciente(await this.repositorio.crear(convertirDatosCreacion(datos)));
    } catch (error) {
      if (esDocumentoDuplicado(error)) {
        throw new ErrorAplicacion(409, 'PATIENT_DOCUMENT_EXISTS', 'El documento ya está registrado.');
      }
      throw error;
    }
  }

  async actualizar(id: string, datos: DatosEdicion) {
    try {
      return presentarPaciente(await this.repositorio.actualizar(id, convertirDatosEdicion(datos)));
    } catch (error) {
      if (esDocumentoDuplicado(error)) {
        throw new ErrorAplicacion(409, 'PATIENT_DOCUMENT_EXISTS', 'El documento ya está registrado.');
      }
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
        throw recursoNoEncontrado('No se encontró el paciente.');
      }
      throw error;
    }
  }
}

