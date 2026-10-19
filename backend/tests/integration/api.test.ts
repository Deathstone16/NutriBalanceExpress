import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { DateTime } from 'luxon';
import { crearAplicacion } from '../../src/app.js';
import { baseDatos, cerrarConexiones } from '../../src/database/cliente.js';
import { crearConfiguracionHttp } from '../../src/config/http.js';

const correoPrueba = 'integracion@nutri.test';
const clavePrueba = 'clave-integracion-segura';
const nombreProfesional = 'Profesional de integración';
type AgentePrueba = ReturnType<typeof request.agent>;

function exigirBasePruebas() {
  const url = process.env.DATABASE_URL;
  if (!url || !/nutri_test(?:\?|$)/.test(url)) {
    throw new Error('Las pruebas de integración solo pueden ejecutarse con DATABASE_URL terminada en nutri_test.');
  }
}

async function credencialesPrivadas(agente: AgentePrueba) {
  const csrf = await agente.get('/api/v1/auth/csrf').expect(200);
  const login = await agente.post('/api/v1/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ email: correoPrueba, password: clavePrueba })
    .expect(200);
  return { csrfToken: login.body.csrfToken as string, usuario: login.body.user };
}

function crearPaciente(agente: AgentePrueba, csrfToken: string, datos: Record<string, unknown> = {}) {
  return agente.post('/api/v1/patients').set('X-CSRF-Token', csrfToken).send({
    firstName: 'Ana', lastName: 'Prueba', phone: '+5493624000000', ...datos,
  });
}

async function fechaProximoDiaHabil() {
  let dia = DateTime.now().setZone('America/Argentina/Buenos_Aires').startOf('day').plus({ days: 1 });
  while (dia.weekday > 5) dia = dia.plus({ days: 1 });
  const disponibilidad = await request(crearAplicacion()).get('/api/v1/availability').query({ date: dia.toISODate() }).expect(200);
  const horario = disponibilidad.body.slots[0];
  if (!horario) throw new Error(`No hay horarios futuros para fixture en ${dia.toISODate()}.`);
  return { date: dia.toISODate()!, startsAt: horario.startsAt as string };
}

function crearTurnoPublico(agente: AgentePrueba, csrfToken: string, startsAt: string) {
  return agente.post('/api/v1/appointment-requests').set('X-CSRF-Token', csrfToken).send({
    contactName: 'Ana Ejemplo', contactPhone: '+5493624000000', contactEmail: 'ana@example.test', startsAt,
  });
}

async function crearTurnoPasado(pacienteId: string, estado: 'confirmed' | 'cancelled' = 'confirmed') {
  const inicio = DateTime.now().setZone('America/Argentina/Buenos_Aires').minus({ minutes: 1 });
  return baseDatos.turno.create({ data: {
    pacienteId,
    nombreContacto: 'Ana Ejemplo',
    telefonoContacto: '+5493624000000',
    correoContacto: 'ana@example.test',
    inicio: inicio.toJSDate(),
    fin: inicio.plus({ minutes: 30 }).toJSDate(),
    estado,
  } });
}

describe('contrato HTTP de NutriTurnos', () => {
  beforeAll(async () => {
    exigirBasePruebas();
    await baseDatos.usuario.upsert({
      where: { correo: correoPrueba },
      create: {
        correo: correoPrueba,
        nombreVisible: nombreProfesional,
        claveHash: await argon2.hash(clavePrueba),
        rol: 'professional',
      },
      update: {
        nombreVisible: nombreProfesional,
        claveHash: await argon2.hash(clavePrueba),
        rol: 'professional',
      },
    });
  });

  beforeEach(async () => {
    exigirBasePruebas();
    await baseDatos.consulta.deleteMany();
    await baseDatos.turno.deleteMany();
    await baseDatos.paciente.deleteMany();
    await baseDatos.$executeRaw`DELETE FROM sessions`;
  });

  afterAll(async () => {
    await cerrarConexiones();
  });

  it('emite cookies HTTPS detrás de proxy local y usa los mismos atributos al cerrar sesión', async () => {
    const configuracion = crearConfiguracionHttp();
    configuracion.proxyConfiable = 'loopback';
    configuracion.cookie = { httpOnly: true, secure: true, sameSite: 'none', path: '/' };
    const aplicacion = crearAplicacion(configuracion);
    const csrf = await request(aplicacion).get('/api/v1/auth/csrf').set('X-Forwarded-Proto', 'https').expect(200);
    const cabecera = csrf.headers['set-cookie'] as unknown as string[];
    expect(cabecera[0]).toContain('Secure');
    expect(cabecera[0]).toContain('HttpOnly');
    expect(cabecera[0]).toContain('SameSite=None');
    const cookieAnonima = cabecera[0]!.split(';')[0]!;
    const ingreso = await request(aplicacion).post('/api/v1/auth/login')
      .set('X-Forwarded-Proto', 'https').set('Cookie', cookieAnonima).set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: correoPrueba, password: clavePrueba }).expect(200);
    const cookieIngreso = (ingreso.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    await request(aplicacion).get('/api/v1/auth/me').set('X-Forwarded-Proto', 'https').set('Cookie', cookieIngreso).expect(200);
    const salida = await request(aplicacion).post('/api/v1/auth/logout')
      .set('X-Forwarded-Proto', 'https').set('Cookie', cookieIngreso).set('X-CSRF-Token', ingreso.body.csrfToken).expect(204);
    expect((salida.headers['set-cookie'] as unknown as string[])[0]).toContain('Secure');
    expect((salida.headers['set-cookie'] as unknown as string[])[0]).toContain('SameSite=None');
  });

  it('no acepta el protocolo reenviado si no se confía en el proxy', async () => {
    const configuracion = crearConfiguracionHttp();
    configuracion.proxyConfiable = false;
    configuracion.cookie.secure = true;
    const respuesta = await request(crearAplicacion(configuracion))
      .get('/api/v1/auth/csrf').set('X-Forwarded-Proto', 'https').expect(200);
    expect(respuesta.headers['set-cookie']).toBeUndefined();
  });

  it('permite preflight con credenciales solo para el origen configurado del frontend', async () => {
    const configuracion = crearConfiguracionHttp();
    configuracion.origenFrontend = 'https://frontend.example.test';
    const aplicacion = crearAplicacion(configuracion);
    const respuesta = await request(aplicacion).options('/api/v1/auth/login')
      .set('Origin', configuracion.origenFrontend).set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-csrf-token').expect(204);
    expect(respuesta.headers['access-control-allow-origin']).toBe(configuracion.origenFrontend);
    expect(respuesta.headers['access-control-allow-credentials']).toBe('true');
    const otroOrigen = await request(aplicacion).options('/api/v1/auth/login')
      .set('Origin', 'https://no-permitido.example.test').set('Access-Control-Request-Method', 'POST').expect(204);
    expect(otroOrigen.headers['access-control-allow-origin']).not.toBe('https://no-permitido.example.test');
  });

  it('inicia sesión, devuelve identidad saneada, consulta /me y cierra la sesión', async () => {
    const agente = request.agent(crearAplicacion());
    const { csrfToken, usuario } = await credencialesPrivadas(agente);
    expect(usuario).toEqual({ id: expect.any(String), email: correoPrueba, displayName: nombreProfesional, role: 'professional' });
    expect(JSON.stringify(usuario)).not.toMatch(/hash|password|clave/i);
    const sesion = await agente.get('/api/v1/auth/me').expect(200);
    expect(sesion.body.user).toEqual(usuario);
    expect(sesion.body.csrfToken).toBe(csrfToken);
    expect(sesion.body).not.toHaveProperty('password');
    await agente.post('/api/v1/auth/logout').set('X-CSRF-Token', csrfToken).expect(204);
    const sinSesion = await agente.get('/api/v1/auth/me').expect(401);
    expect(sinSesion.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rechaza logout y lecturas privadas cuando no existe sesión', async () => {
    const agente = request.agent(crearAplicacion());
    const csrf = await agente.get('/api/v1/auth/csrf').expect(200);
    const logout = await agente.post('/api/v1/auth/logout').set('X-CSRF-Token', csrf.body.csrfToken).expect(401);
    expect(logout.body.error.code).toBe('UNAUTHENTICATED');
    const privado = await agente.get('/api/v1/patients').expect(401);
    expect(privado.body.error.code).toBe('UNAUTHENTICATED');
    expect(privado.body.requestId).toEqual(expect.any(String));
  });

  it('rechaza una sesión cuyo vencimiento absoluto pasó aunque la cookie siga presente', async () => {
    const agente = request.agent(crearAplicacion());
    await credencialesPrivadas(agente);
    await baseDatos.$executeRaw`UPDATE sessions SET sess = jsonb_set(sess::jsonb, '{venceEn}', '"2000-01-01T00:00:00Z"'::jsonb)::json WHERE sess::jsonb ? 'usuarioId'`;
    const respuesta = await agente.get('/api/v1/auth/me').expect(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('normaliza textos opcionales vacíos y no cambia el vínculo al repetir cancelación', async () => {
    const agente = request.agent(crearAplicacion());
    const { csrfToken } = await credencialesPrivadas(agente);
    const paciente = await crearPaciente(agente, csrfToken, { allergies: '', background: '   ' }).expect(201);
    expect(paciente.body).toMatchObject({ allergies: null, background: null });
    const consulta = await agente.post(`/api/v1/patients/${paciente.body.id}/consultations`)
      .set('X-CSRF-Token', csrfToken).send({ date: '2020-01-01', reason: 'Control', instructions: 'Prueba', objective: '', observations: '' }).expect(201);
    expect(consulta.body).toMatchObject({ objective: null, observations: null });
    const turno = await baseDatos.turno.create({ data: {
      nombreContacto: 'Solicitud cancelada', telefonoContacto: '123456',
      inicio: new Date('2020-01-01T12:00:00Z'), fin: new Date('2020-01-01T12:30:00Z'), estado: 'cancelled',
    } });
    const respuesta = await agente.patch(`/api/v1/appointments/${turno.id}`).set('X-CSRF-Token', csrfToken)
      .send({ status: 'cancelled', patientId: paciente.body.id }).expect(409);
    expect(respuesta.body.error.code).toBe('APPOINTMENT_PATIENT_MISMATCH');
  });

  it('exige CSRF para login y escrituras, y rota el token al autenticar', async () => {
    const agente = request.agent(crearAplicacion());
    const csrf = await agente.get('/api/v1/auth/csrf').expect(200);
    const loginSinToken = await agente.post('/api/v1/auth/login').send({ email: correoPrueba, password: clavePrueba }).expect(403);
    expect(loginSinToken.body.error.code).toBe('CSRF_INVALID');
    const login = await agente.post('/api/v1/auth/login').set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: correoPrueba, password: clavePrueba }).expect(200);
    expect(login.body.csrfToken).not.toBe(csrf.body.csrfToken);
    const tokenViejo = await crearPaciente(agente, csrf.body.csrfToken).expect(403);
    expect(tokenViejo.body.error.code).toBe('CSRF_INVALID');
    const tokenNuevo = await crearPaciente(agente, login.body.csrfToken).expect(201);
    expect(tokenNuevo.body.id).toEqual(expect.any(String));
  });

  it('rechaza credenciales incorrectas con error de contrato', async () => {
    const agente = request.agent(crearAplicacion());
    const csrf = await agente.get('/api/v1/auth/csrf').expect(200);
    const respuesta = await agente.post('/api/v1/auth/login').set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: correoPrueba, password: 'incorrecta' }).expect(401);
    expect(respuesta.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(respuesta.body.error.details).toEqual([]);
    expect(respuesta.body.requestId).toEqual(expect.any(String));
  });

  it('limita cinco intentos de login por aplicación e informa Retry-After al sexto', async () => {
    const agente = request.agent(crearAplicacion());
    const csrf = await agente.get('/api/v1/auth/csrf').expect(200);
    for (let intento = 0; intento < 5; intento += 1) {
      await agente.post('/api/v1/auth/login').set('X-CSRF-Token', csrf.body.csrfToken)
        .send({ email: correoPrueba, password: 'incorrecta' }).expect(401);
    }
    const limitado = await agente.post('/api/v1/auth/login').set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: correoPrueba, password: 'incorrecta' }).expect(429);
    expect(limitado.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limitado.headers['retry-after'])).toBeGreaterThan(0);
    expect(limitado.body.requestId).toEqual(expect.any(String));
  });

  it('crea pacientes con opcionales null y permite borrar campos nullable con PATCH', async () => {
    const agente = request.agent(crearAplicacion());
    const { csrfToken } = await credencialesPrivadas(agente);
    const creado = await crearPaciente(agente, csrfToken, { documentNumber: '99000001', allergies: 'Polen' }).expect(201);
    expect(creado.body).toMatchObject({ documentNumber: '99000001', allergies: 'Polen', email: null, birthDate: null, medication: null });
    const editado = await agente.patch(`/api/v1/patients/${creado.body.id}`).set('X-CSRF-Token', csrfToken)
      .send({ phone: '+5493624000001', allergies: null }).expect(200);
    expect(editado.body).toMatchObject({ phone: '+5493624000001', allergies: null, documentNumber: '99000001' });
  });

  it('rechaza documento duplicado y validaciones con requestId y details estables', async () => {
    const agente = request.agent(crearAplicacion());
    const { csrfToken } = await credencialesPrivadas(agente);
    await crearPaciente(agente, csrfToken, { documentNumber: '99000002' }).expect(201);
    const duplicado = await crearPaciente(agente, csrfToken, { documentNumber: '99000002' }).expect(409);
    expect(duplicado.body.error.code).toBe('PATIENT_DOCUMENT_EXISTS');
    expect(duplicado.body.requestId).toEqual(expect.any(String));
    const invalido = await crearPaciente(agente, csrfToken, { documentNumber: '123' }).expect(400);
    expect(invalido.body.error).toMatchObject({ code: 'VALIDATION_ERROR', details: expect.any(Array) });
    expect(invalido.body.error.details.length).toBeGreaterThan(0);
    expect(invalido.body.requestId).toEqual(expect.any(String));
  });

  it('lista pacientes con búsqueda, página y metadatos, y rechaza página fuera de rango válido', async () => {
    const agente = request.agent(crearAplicacion());
    const { csrfToken } = await credencialesPrivadas(agente);
    await crearPaciente(agente, csrfToken, { firstName: 'Zoe', lastName: 'Zeta' }).expect(201);
    await crearPaciente(agente, csrfToken, { firstName: 'Ana', lastName: 'Alfa' }).expect(201);
    const lista = await agente.get('/api/v1/patients').query({ q: 'Ana', page: 1, pageSize: 1 }).expect(200);
    expect(lista.body.data).toHaveLength(1);
    expect(lista.body.data[0].firstName).toBe('Ana');
    expect(lista.body.meta).toEqual({ page: 1, pageSize: 1, total: 1, totalPages: 1 });
    const invalida = await agente.get('/api/v1/patients').query({ page: 0 }).expect(400);
    expect(invalida.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('publica disponibilidad local y permite una sola reserva concurrente del mismo horario', async () => {
    const { startsAt, date } = await fechaProximoDiaHabil();
    const agenteUno = request.agent(crearAplicacion());
    const agenteDos = request.agent(crearAplicacion());
    const [csrfUno, csrfDos] = await Promise.all([
      agenteUno.get('/api/v1/auth/csrf').expect(200), agenteDos.get('/api/v1/auth/csrf').expect(200),
    ]);
    const disponibilidad = await agenteUno.get('/api/v1/availability').query({ date }).expect(200);
    expect(disponibilidad.body).toMatchObject({ date, timeZone: 'America/Argentina/Buenos_Aires' });
    expect(disponibilidad.body.slots).toContainEqual({ startsAt, endsAt: new Date(Date.parse(startsAt) + 30 * 60_000).toISOString() });
    const reservas = await Promise.all([
      crearTurnoPublico(agenteUno, csrfUno.body.csrfToken, startsAt),
      crearTurnoPublico(agenteDos, csrfDos.body.csrfToken, startsAt),
    ]);
    expect(reservas.map(respuesta => respuesta.status).sort()).toEqual([201, 409]);
    const exitosa = reservas.find(respuesta => respuesta.status === 201)!;
    const rechazada = reservas.find(respuesta => respuesta.status === 409)!;
    expect(exitosa.body).toMatchObject({ startsAt, status: 'pending', id: expect.any(String) });
    expect(rechazada.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('libera un horario cancelado para una nueva solicitud pública', async () => {
    const { startsAt } = await fechaProximoDiaHabil();
    const visitante = request.agent(crearAplicacion());
    const csrfVisitante = await visitante.get('/api/v1/auth/csrf').expect(200);
    const solicitud = await crearTurnoPublico(visitante, csrfVisitante.body.csrfToken, startsAt).expect(201);

    const profesional = request.agent(crearAplicacion());
    const { csrfToken } = await credencialesPrivadas(profesional);
    const cancelado = await profesional.patch(`/api/v1/appointments/${solicitud.body.id}`)
      .set('X-CSRF-Token', csrfToken).send({ status: 'cancelled' }).expect(200);
    expect(cancelado.body.status).toBe('cancelled');

    const visitanteNuevo = request.agent(crearAplicacion());
    const csrfNuevo = await visitanteNuevo.get('/api/v1/auth/csrf').expect(200);
    const nuevaSolicitud = await crearTurnoPublico(visitanteNuevo, csrfNuevo.body.csrfToken, startsAt).expect(201);
    expect(nuevaSolicitud.body).toMatchObject({ startsAt, status: 'pending' });
    expect(nuevaSolicitud.body.id).not.toBe(solicitud.body.id);
  });

  it('requiere paciente para confirmar y valida transiciones permitidas del turno', async () => {
    const agente = request.agent(crearAplicacion());
    const { csrfToken } = await credencialesPrivadas(agente);
    const paciente = await crearPaciente(agente, csrfToken).expect(201);
    const { startsAt } = await fechaProximoDiaHabil();
    const anonimo = request.agent(crearAplicacion());
    const csrfAnonimo = await anonimo.get('/api/v1/auth/csrf').expect(200);
    const solicitud = await crearTurnoPublico(anonimo, csrfAnonimo.body.csrfToken, startsAt).expect(201);
    const faltaPaciente = await agente.patch(`/api/v1/appointments/${solicitud.body.id}`).set('X-CSRF-Token', csrfToken)
      .send({ status: 'confirmed' }).expect(409);
    expect(faltaPaciente.body.error.code).toBe('PATIENT_REQUIRED');
    const confirmado = await agente.patch(`/api/v1/appointments/${solicitud.body.id}`).set('X-CSRF-Token', csrfToken)
      .send({ status: 'confirmed', patientId: paciente.body.id }).expect(200);
    expect(confirmado.body).toMatchObject({ status: 'confirmed', patientId: paciente.body.id });
    const atendido = await agente.patch(`/api/v1/appointments/${solicitud.body.id}`).set('X-CSRF-Token', csrfToken)
      .send({ status: 'attended' }).expect(200);
    expect(atendido.body.status).toBe('attended');
    const transicionInvalida = await agente.patch(`/api/v1/appointments/${solicitud.body.id}`).set('X-CSRF-Token', csrfToken)
      .send({ status: 'cancelled' }).expect(409);
    expect(transicionInvalida.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('lista agenda por fecha local, estado y paginación', async () => {
    const agente = request.agent(crearAplicacion());
    const { csrfToken } = await credencialesPrivadas(agente);
    const fecha = await fechaProximoDiaHabil();
    const anonimo = request.agent(crearAplicacion());
    const token = await anonimo.get('/api/v1/auth/csrf').expect(200);
    const solicitud = await crearTurnoPublico(anonimo, token.body.csrfToken, fecha.startsAt).expect(201);
    const lista = await agente.get('/api/v1/appointments').query({ from: fecha.date, to: fecha.date, status: 'pending', page: 1, pageSize: 5 }).expect(200);
    expect(lista.body.data).toHaveLength(1);
    expect(lista.body.data[0]).toMatchObject({ id: solicitud.body.id, status: 'pending' });
    expect(lista.body.meta).toEqual({ page: 1, pageSize: 5, total: 1, totalPages: 1 });
    const rangoInvalido = await agente.get('/api/v1/appointments').query({ from: fecha.date, to: DateTime.fromISO(fecha.date).plus({ days: 31 }).toISODate() }).expect(400);
    expect(rangoInvalido.body.error.code).toBe('VALIDATION_ERROR');
    expect(csrfToken).toEqual(expect.any(String));
  });

  it('registra consultas sin turno, devuelve el historial ordenado y conserva nulos', async () => {
    const agente = request.agent(crearAplicacion());
    const { csrfToken } = await credencialesPrivadas(agente);
    const paciente = await crearPaciente(agente, csrfToken).expect(201);
    const fecha = DateTime.now().setZone('America/Argentina/Buenos_Aires').toISODate()!;
    const consulta = await agente.post(`/api/v1/patients/${paciente.body.id}/consultations`).set('X-CSRF-Token', csrfToken)
      .send({ date: fecha, reason: 'Primera consulta', instructions: 'Indicaciones', observations: null, weightKg: 72.5 }).expect(201);
    expect(consulta.body).toMatchObject({ patientId: paciente.body.id, appointmentId: null, date: fecha, observations: null, weightKg: 72.5 });
    const historial = await agente.get(`/api/v1/patients/${paciente.body.id}/consultations`).query({ page: 1, pageSize: 10 }).expect(200);
    expect(historial.body.data).toEqual([consulta.body]);
    expect(historial.body.meta).toEqual({ page: 1, pageSize: 10, total: 1, totalPages: 1 });
    expect(await baseDatos.turno.count()).toBe(0);
  });

  it('vincula una consulta a turno confirmado pasado y lo marca atendido de forma atómica', async () => {
    const agente = request.agent(crearAplicacion());
    const { csrfToken } = await credencialesPrivadas(agente);
    const paciente = await crearPaciente(agente, csrfToken).expect(201);
    const turno = await crearTurnoPasado(paciente.body.id);
    const fecha = DateTime.fromJSDate(turno.inicio).setZone('America/Argentina/Buenos_Aires').toISODate()!;
    const respuesta = await agente.post(`/api/v1/patients/${paciente.body.id}/consultations`).set('X-CSRF-Token', csrfToken)
      .send({ date: fecha, reason: 'Control', instructions: 'Continuar plan', appointmentId: turno.id }).expect(201);
    expect(respuesta.body).toMatchObject({ patientId: paciente.body.id, appointmentId: turno.id, date: fecha });
    expect((await baseDatos.turno.findUniqueOrThrow({ where: { id: turno.id } })).estado).toBe('attended');
    const duplicada = await agente.post(`/api/v1/patients/${paciente.body.id}/consultations`).set('X-CSRF-Token', csrfToken)
      .send({ date: fecha, reason: 'Duplicada', instructions: 'Indicaciones', appointmentId: turno.id }).expect(409);
    expect(duplicada.body.error.code).toBe('APPOINTMENT_ALREADY_LINKED');
    expect(await baseDatos.consulta.count({ where: { turnoId: turno.id } })).toBe(1);
  });

  it('revierte el cambio de estado del turno si falla el insert de la consulta', async () => {
    const agente = request.agent(crearAplicacion());
    const { csrfToken } = await credencialesPrivadas(agente);
    const paciente = await crearPaciente(agente, csrfToken).expect(201);
    const turno = await crearTurnoPasado(paciente.body.id);
    const fecha = DateTime.fromJSDate(turno.inicio).setZone('America/Argentina/Buenos_Aires').toISODate()!;
    let restriccionCreada = false;
    try {
      exigirBasePruebas();
      await baseDatos.$executeRawUnsafe('ALTER TABLE consultations DROP CONSTRAINT IF EXISTS integration_force_consultation_failure');
      await baseDatos.$executeRawUnsafe(
        "ALTER TABLE consultations ADD CONSTRAINT integration_force_consultation_failure CHECK (reason <> 'forzar fallo')",
      );
      restriccionCreada = true;
      const respuesta = await agente.post(`/api/v1/patients/${paciente.body.id}/consultations`)
        .set('X-CSRF-Token', csrfToken)
        .send({ date: fecha, reason: 'forzar fallo', instructions: 'Indicaciones', appointmentId: turno.id })
        .expect(500);
      expect(respuesta.body.error.code).toBe('INTERNAL_ERROR');
      const estadoTurno = await baseDatos.turno.findUniqueOrThrow({ where: { id: turno.id } });
      expect(estadoTurno.estado).toBe('confirmed');
      expect(await baseDatos.consulta.count({ where: { turnoId: turno.id } })).toBe(0);
    } finally {
      if (restriccionCreada) {
        await baseDatos.$executeRawUnsafe('ALTER TABLE consultations DROP CONSTRAINT integration_force_consultation_failure');
      }
    }
  });

  it('rechaza vínculos con paciente distinto y turnos cancelados sin crear consultas', async () => {
    const agente = request.agent(crearAplicacion());
    const { csrfToken } = await credencialesPrivadas(agente);
    const pacienteUno = await crearPaciente(agente, csrfToken).expect(201);
    const pacienteDos = await crearPaciente(agente, csrfToken, { firstName: 'Eva', documentNumber: '99000003' }).expect(201);
    const turno = await crearTurnoPasado(pacienteUno.body.id);
    const fecha = DateTime.fromJSDate(turno.inicio).setZone('America/Argentina/Buenos_Aires').toISODate()!;
    const mismatch = await agente.post(`/api/v1/patients/${pacienteDos.body.id}/consultations`).set('X-CSRF-Token', csrfToken)
      .send({ date: fecha, reason: 'Control', instructions: 'Indicaciones', appointmentId: turno.id }).expect(409);
    expect(mismatch.body.error.code).toBe('APPOINTMENT_PATIENT_MISMATCH');
    const cancelado = await crearTurnoPasado(pacienteUno.body.id, 'cancelled');
    const noPermitida = await agente.post(`/api/v1/patients/${pacienteUno.body.id}/consultations`).set('X-CSRF-Token', csrfToken)
      .send({ date: fecha, reason: 'Control', instructions: 'Indicaciones', appointmentId: cancelado.id }).expect(409);
    expect(noPermitida.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect(await baseDatos.consulta.count()).toBe(0);
  });

  it('valida fecha de consulta y formato de mediciones', async () => {
    const agente = request.agent(crearAplicacion());
    const { csrfToken } = await credencialesPrivadas(agente);
    const paciente = await crearPaciente(agente, csrfToken).expect(201);
    const futura = DateTime.now().setZone('America/Argentina/Buenos_Aires').plus({ days: 1 }).toISODate();
    const error = await agente.post(`/api/v1/patients/${paciente.body.id}/consultations`).set('X-CSRF-Token', csrfToken)
      .send({ date: futura, reason: 'Control', instructions: 'Indicaciones', weightKg: '72.345' }).expect(400);
    expect(error.body.error.code).toBe('VALIDATION_ERROR');
    expect(error.body.error.details.length).toBeGreaterThan(0);
    expect(await baseDatos.consulta.count()).toBe(0);
  });
});
