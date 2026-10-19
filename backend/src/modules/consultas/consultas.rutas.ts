import { Router } from 'express';
import { esquemaConsulta, esquemaHistorial, esquemaIdPaciente } from './consultas.esquemas.js';
import { listarHistorial, registrarConsulta } from './consultas.servicio.js';

export function crearRutasConsultas() {
  const rutas = Router({ mergeParams: true });
  rutas.get('/', async (peticion, respuesta) => {
    const { patientId } = esquemaIdPaciente.parse(peticion.params);
    const { page, pageSize } = esquemaHistorial.parse(peticion.query);
    respuesta.json(await listarHistorial(patientId, page, pageSize));
  });
  rutas.post('/', async (peticion, respuesta) => {
    const { patientId } = esquemaIdPaciente.parse(peticion.params);
    respuesta.status(201).json(await registrarConsulta(patientId, esquemaConsulta.parse(peticion.body)));
  });
  return rutas;
}
