import { Router } from 'express';
import { AutenticacionControlador } from './autenticacion.controlador.js';
import { exigirAutenticacion } from './autenticacion.middleware.js';
import { AutenticacionRepositorio } from './autenticacion.repositorio.js';
import { AutenticacionServicio } from './autenticacion.servicio.js';
import { crearConfiguracionHttp, type OpcionesCookie } from '../../config/http.js';

export function crearRutasAutenticacion(opcionesCookie: OpcionesCookie = crearConfiguracionHttp().cookie): Router {
  const rutas = Router();
  const repositorio = new AutenticacionRepositorio();
  const servicio = new AutenticacionServicio(repositorio);
  const controlador = new AutenticacionControlador(servicio, opcionesCookie);

  rutas.get('/csrf', controlador.obtenerCsrf);
  rutas.post('/login', controlador.ingresar);
  rutas.get('/me', exigirAutenticacion, controlador.obtenerSesion);
  rutas.post('/logout', exigirAutenticacion, controlador.salir);

  return rutas;
}
