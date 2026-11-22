import type { Request, Response } from 'express';
import { esquemaAgenda, esquemaCambioTurno, esquemaConfirmarCorreo, esquemaDisponibilidad, esquemaIdTurno, esquemaReenvioConfirmacion, esquemaSolicitudTurno, esquemaTurnoInterno } from './turnos.esquemas.js';
import { cambiarTurno, confirmarCorreoTurno, consultarDisponibilidad, crearTurnoInterno, listarAgenda, obtenerTurno, reenviarConfirmacion, solicitarTurno } from './turnos.servicio.js';

export const controladorTurnos = {
  disponibilidad: async (peticion: Request, respuesta: Response) => { const datos = esquemaDisponibilidad.parse(peticion.query); respuesta.json(await consultarDisponibilidad(datos.date)); },
  solicitar: async (peticion: Request, respuesta: Response) => { respuesta.status(201).json(await solicitarTurno(esquemaSolicitudTurno.parse(peticion.body))); },
  reenviarConfirmacion: async (peticion: Request, respuesta: Response) => { respuesta.json(await reenviarConfirmacion(esquemaReenvioConfirmacion.parse(peticion.body))); },
  confirmarCorreo: async (peticion: Request, respuesta: Response) => { respuesta.json(await confirmarCorreoTurno(esquemaConfirmarCorreo.parse(peticion.body).token)); },
  crearInterno: async (peticion: Request, respuesta: Response) => { respuesta.status(201).json(await crearTurnoInterno(esquemaTurnoInterno.parse(peticion.body))); },
  listar: async (peticion: Request, respuesta: Response) => { respuesta.json(await listarAgenda(esquemaAgenda.parse(peticion.query))); },
  obtener: async (peticion: Request, respuesta: Response) => { const datos = esquemaIdTurno.parse(peticion.params); respuesta.json(await obtenerTurno(datos.appointmentId)); },
  cambiar: async (peticion: Request, respuesta: Response) => { const datos = esquemaIdTurno.parse(peticion.params); respuesta.json(await cambiarTurno(datos.appointmentId, esquemaCambioTurno.parse(peticion.body))); },
};
