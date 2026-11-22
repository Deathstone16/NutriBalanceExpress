import { Router } from 'express';
import { controladorTurnos } from './turnos.controlador.js';
import { exigirAutenticacion } from '../autenticacion/autenticacion.middleware.js';
import { crearLimiteConfirmaciones, crearLimiteDisponibilidad, crearLimiteReenvios, crearLimiteSolicitudes } from '../../shared/middlewares/limites.js';

export function crearRutasTurnos() {
  const rutas = Router();
  rutas.get('/availability', crearLimiteDisponibilidad(), controladorTurnos.disponibilidad);
  rutas.post('/appointment-requests', crearLimiteSolicitudes(), controladorTurnos.solicitar);
  rutas.post('/appointment-requests/confirm-email', crearLimiteConfirmaciones(), controladorTurnos.confirmarCorreo);
  rutas.post('/appointment-requests/resend-confirmation', crearLimiteReenvios(), controladorTurnos.reenviarConfirmacion);
  rutas.post('/appointments', exigirAutenticacion, controladorTurnos.crearInterno);
  rutas.get('/appointments', exigirAutenticacion, controladorTurnos.listar);
  rutas.get('/appointments/:appointmentId', exigirAutenticacion, controladorTurnos.obtener);
  rutas.patch('/appointments/:appointmentId', exigirAutenticacion, controladorTurnos.cambiar);
  return rutas;
}
