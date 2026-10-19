import { Router } from 'express';
import { controladorTurnos } from './turnos.controlador.js';
import { exigirAutenticacion } from '../autenticacion/autenticacion.middleware.js';
import { crearLimiteDisponibilidad, crearLimiteSolicitudes } from '../../shared/middlewares/limites.js';

export function crearRutasTurnos() {
  const rutas = Router();
  rutas.get('/availability', crearLimiteDisponibilidad(), controladorTurnos.disponibilidad);
  rutas.post('/appointment-requests', crearLimiteSolicitudes(), controladorTurnos.solicitar);
  rutas.get('/appointments', exigirAutenticacion, controladorTurnos.listar);
  rutas.get('/appointments/:appointmentId', exigirAutenticacion, controladorTurnos.obtener);
  rutas.patch('/appointments/:appointmentId', exigirAutenticacion, controladorTurnos.cambiar);
  return rutas;
}
