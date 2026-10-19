import { mostrarFechaCivil } from '../../shared/fechas.js';

export interface PacienteRegistro {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
  documento: string | null;
  fechaNacimiento: Date | null;
  correo: string | null;
  antecedentes: string | null;
  alergias: string | null;
  medicacion: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

export function presentarPaciente(paciente: PacienteRegistro) {
  return {
    id: paciente.id,
    firstName: paciente.nombre,
    lastName: paciente.apellido,
    phone: paciente.telefono,
    documentNumber: paciente.documento,
    birthDate: paciente.fechaNacimiento ? mostrarFechaCivil(paciente.fechaNacimiento) : null,
    email: paciente.correo,
    background: paciente.antecedentes,
    allergies: paciente.alergias,
    medication: paciente.medicacion,
    createdAt: paciente.creadoEn.toISOString(),
    updatedAt: paciente.actualizadoEn.toISOString(),
  };
}

