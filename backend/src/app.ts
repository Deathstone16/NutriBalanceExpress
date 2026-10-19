import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { crearConfiguracionHttp, type ConfiguracionHttp } from './config/http.js';
import { configurarSesion } from './config/sesion.js';
import { crearRutasAutenticacion } from './modules/autenticacion/autenticacion.rutas.js';
import { exigirAutenticacion } from './modules/autenticacion/autenticacion.middleware.js';
import { verificarCsrf } from './modules/autenticacion/autenticacion.csrf.js';
import { crearRutasPacientes } from './modules/pacientes/pacientes.rutas.js';
import { crearRutasConsultas } from './modules/consultas/consultas.rutas.js';
import { crearRutasTurnos } from './modules/turnos/turnos.rutas.js';
import { manejarErrores } from './shared/middlewares/errores.js';
import { crearLimiteLogin } from './shared/middlewares/limites.js';
import { ErrorAplicacion } from './shared/errors/error-aplicacion.js';
import { baseDatos } from './database/cliente.js';

export function crearAplicacion(configuracion: ConfiguracionHttp = crearConfiguracionHttp()) {
  const aplicacion = express();
  aplicacion.disable('x-powered-by');
  aplicacion.set('trust proxy', configuracion.proxyConfiable);
  aplicacion.use((_peticion, respuesta, siguiente) => {
    respuesta.locals.identificadorPeticion = randomUUID();
    respuesta.setHeader('X-Request-Id', respuesta.locals.identificadorPeticion);
    respuesta.setHeader('Cache-Control', 'no-store');
    siguiente();
  });
  aplicacion.use(helmet());
  aplicacion.use(cors({ origin: configuracion.origenFrontend, credentials: true, exposedHeaders: ['X-Request-Id', 'Retry-After'] }));
  aplicacion.get('/health', async (_peticion, respuesta) => {
    await baseDatos.$queryRaw`SELECT 1`;
    respuesta.json({ status: 'ok' });
  });
  aplicacion.use('/api/v1', express.json({ limit: '32kb' }));
  aplicacion.use('/api/v1', configurarSesion(configuracion.cookie));
  aplicacion.post('/api/v1/auth/login', crearLimiteLogin());
  aplicacion.use('/api/v1', (peticion, _respuesta, siguiente) => {
    const mutacion = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(peticion.method);
    if (mutacion && !['/auth/login', '/appointment-requests'].includes(peticion.path)) {
      exigirAutenticacion(peticion, _respuesta, error => error ? siguiente(error) : verificarCsrf(peticion, _respuesta, siguiente));
    } else if (mutacion) verificarCsrf(peticion, _respuesta, siguiente);
    else siguiente();
  });
  aplicacion.use('/api/v1', (peticion, _respuesta, siguiente) => {
    if (['POST', 'PATCH', 'PUT'].includes(peticion.method) && peticion.get('content-length') !== '0' && !peticion.is('application/json') && peticion.path !== '/auth/logout') {
      siguiente(new ErrorAplicacion(400, 'VALIDATION_ERROR', 'Usá Content-Type: application/json.'));
    } else siguiente();
  });
  aplicacion.use('/api/v1/auth', crearRutasAutenticacion(configuracion.cookie));
  aplicacion.use('/api/v1/patients/:patientId/consultations', exigirAutenticacion, crearRutasConsultas());
  aplicacion.use('/api/v1/patients', exigirAutenticacion, crearRutasPacientes());
  aplicacion.use('/api/v1', crearRutasTurnos());
  aplicacion.use((_peticion, _respuesta, siguiente) => siguiente(new ErrorAplicacion(404, 'NOT_FOUND', 'No se encontró el recurso.')));
  aplicacion.use(manejarErrores);
  return aplicacion;
}
