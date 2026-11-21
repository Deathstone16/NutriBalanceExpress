import { describe, expect, it } from 'vitest';
import { esquemaSolicitudTurno } from '../../src/modules/turnos/turnos.esquemas.js';
import { esquemaCrearPaciente } from '../../src/modules/pacientes/pacientes.esquemas.js';
import { esquemaConsulta } from '../../src/modules/consultas/consultas.esquemas.js';

const solicitud = { contactName: 'Ana', contactPhone: '3624000000', contactEmail: 'ana@example.test', contactDocumentNumber: '30111222', startsAt: '2099-01-05T12:00:00Z' };
const mensajes = (esquema: { safeParse: (valor: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, datos: unknown) => {
  const resultado = esquema.safeParse(datos);
  return Object.fromEntries((resultado.error?.issues ?? []).map(problema => [problema.path.join('.'), problema.message]));
};

describe('mensajes de validación en español', () => {
  it('explica cada error de la solicitud de turno con palabras claras', () => {
    expect(mensajes(esquemaSolicitudTurno, { ...solicitud, contactPhone: '12345' }).contactPhone).toBe('Ingresá al menos 6 caracteres.');
    expect(mensajes(esquemaSolicitudTurno, { ...solicitud, contactEmail: 'a@b' }).contactEmail).toBe('Ingresá un correo válido, por ejemplo nombre@dominio.com.');
    expect(mensajes(esquemaSolicitudTurno, { ...solicitud, contactName: '   ' }).contactName).toBe('Completá este campo.');
    expect(mensajes(esquemaSolicitudTurno, { ...solicitud, contactName: 'N'.repeat(161) }).contactName).toBe('Ingresá hasta 160 caracteres.');
    const { contactEmail, ...sinCorreo } = solicitud;
    expect(contactEmail).toBeDefined();
    expect(mensajes(esquemaSolicitudTurno, sinCorreo).contactEmail).toBe('Completá este campo.');
  });

  it('conserva los mensajes propios de cada campo y rechaza campos de más sin jerga técnica', () => {
    expect(mensajes(esquemaSolicitudTurno, { ...solicitud, contactDocumentNumber: '123' }).contactDocumentNumber).toBe('Ingresá un DNI de 7 a 9 números, sin puntos.');
    expect(mensajes(esquemaSolicitudTurno, { ...solicitud, extra: 1 })['']).toBe('Hay un dato que no corresponde a este formulario.');
  });

  it('no deja textos en inglés en pacientes ni consultas', () => {
    const todos = [
      ...Object.values(mensajes(esquemaCrearPaciente, { firstName: '', lastName: 'X'.repeat(81), phone: '1', email: 'no', documentNumber: '12' })),
      ...Object.values(mensajes(esquemaConsulta, { date: '2020-01-01', reason: '', instructions: '', weightKg: 600 })),
    ];
    expect(todos.length).toBeGreaterThan(4);
    for (const mensaje of todos) expect(mensaje).not.toMatch(/Too |expected|Invalid|string|number/i);
  });
});
