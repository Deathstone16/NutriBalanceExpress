import { DateTime } from 'luxon';

export const ZONA_CONSULTORIO = 'America/Argentina/Buenos_Aires';
export const obtenerAhora = () => DateTime.now().setZone(ZONA_CONSULTORIO);
export const fechaLocal = (fecha: Date) => DateTime.fromJSDate(fecha).setZone(ZONA_CONSULTORIO).toISODate()!;
export const fechaCivil = (valor: string) => new Date(`${valor}T00:00:00.000Z`);
export const mostrarFechaCivil = (valor: Date) => valor.toISOString().slice(0, 10);
