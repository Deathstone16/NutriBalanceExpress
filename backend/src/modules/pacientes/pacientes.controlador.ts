import type { Request, Response } from 'express';
import { crearMetadatos } from '../../shared/validacion.js';
import {
  esquemaCrearPaciente,
  esquemaEditarPaciente,
  esquemaIdPaciente,
  esquemaListadoPacientes,
} from './pacientes.esquemas.js';
import { PacientesServicio } from './pacientes.servicio.js';

export class PacientesControlador {
  constructor(private readonly servicio: PacientesServicio) {}

  listar = async (solicitud: Request, respuesta: Response) => {
    const filtros = esquemaListadoPacientes.parse(solicitud.query);
    const resultado = await this.servicio.listar(filtros);
    respuesta.json({
      data: resultado.data,
      meta: crearMetadatos(filtros.page, filtros.pageSize, resultado.total),
    });
  };

  obtener = async (solicitud: Request, respuesta: Response) => {
    const { patientId } = esquemaIdPaciente.parse(solicitud.params);
    respuesta.json(await this.servicio.obtener(patientId));
  };

  crear = async (solicitud: Request, respuesta: Response) => {
    const datos = esquemaCrearPaciente.parse(solicitud.body);
    respuesta.status(201).json(await this.servicio.crear(datos));
  };

  actualizar = async (solicitud: Request, respuesta: Response) => {
    const { patientId } = esquemaIdPaciente.parse(solicitud.params);
    const datos = esquemaEditarPaciente.parse(solicitud.body);
    respuesta.json(await this.servicio.actualizar(patientId, datos));
  };
}

