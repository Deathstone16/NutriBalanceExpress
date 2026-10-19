import { Router } from 'express';
import { PacientesControlador } from './pacientes.controlador.js';
import { PacientesRepositorio } from './pacientes.repositorio.js';
import { PacientesServicio } from './pacientes.servicio.js';

export function crearRutasPacientes(): Router {
  const rutas = Router();
  const repositorio = new PacientesRepositorio();
  const servicio = new PacientesServicio(repositorio);
  const controlador = new PacientesControlador(servicio);

  rutas.get('/', controlador.listar);
  rutas.get('/:patientId', controlador.obtener);
  rutas.post('/', controlador.crear);
  rutas.patch('/:patientId', controlador.actualizar);
  return rutas;
}

