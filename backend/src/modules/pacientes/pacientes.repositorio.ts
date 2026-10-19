import { Prisma } from '../../generated/prisma/client.js';
import { baseDatos } from '../../database/cliente.js';
import type { PacienteRegistro } from './pacientes.presentador.js';

export interface FiltrosPacientes {
  busqueda?: string;
  pagina: number;
  tamanio: number;
}

export interface DatosCreacionPaciente {
  nombre: string;
  apellido: string;
  telefono: string;
  documento?: string | null;
  fechaNacimiento?: Date | null;
  correo?: string | null;
  antecedentes?: string | null;
  alergias?: string | null;
  medicacion?: string | null;
}

export type DatosEdicionPaciente = Partial<DatosCreacionPaciente>;

const seleccionPaciente = {
  id: true,
  nombre: true,
  apellido: true,
  telefono: true,
  documento: true,
  fechaNacimiento: true,
  correo: true,
  antecedentes: true,
  alergias: true,
  medicacion: true,
  creadoEn: true,
  actualizadoEn: true,
} satisfies Prisma.PacienteSelect;

export class PacientesRepositorio {
  async listar(filtros: FiltrosPacientes): Promise<{ pacientes: PacienteRegistro[]; total: number }> {
    const filtro: Prisma.PacienteWhereInput = filtros.busqueda
      ? {
          OR: [
            { nombre: { contains: filtros.busqueda, mode: 'insensitive' } },
            { apellido: { contains: filtros.busqueda, mode: 'insensitive' } },
            { documento: { contains: filtros.busqueda, mode: 'insensitive' } },
          ],
        }
      : {};
    const [pacientes, total] = await baseDatos.$transaction([
      baseDatos.paciente.findMany({
        where: filtro,
        select: seleccionPaciente,
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }, { id: 'asc' }],
        skip: (filtros.pagina - 1) * filtros.tamanio,
        take: filtros.tamanio,
      }),
      baseDatos.paciente.count({ where: filtro }),
    ]);
    return { pacientes, total };
  }

  obtenerPorId(id: string): Promise<PacienteRegistro | null> {
    return baseDatos.paciente.findUnique({ where: { id }, select: seleccionPaciente });
  }

  crear(datos: DatosCreacionPaciente): Promise<PacienteRegistro> {
    return baseDatos.paciente.create({
      data: datos,
      select: seleccionPaciente,
    });
  }

  actualizar(id: string, datos: DatosEdicionPaciente): Promise<PacienteRegistro> {
    return baseDatos.paciente.update({
      where: { id },
      data: datos,
      select: seleccionPaciente,
    });
  }
}

