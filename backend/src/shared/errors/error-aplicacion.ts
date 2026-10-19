export interface DetalleError { field: string; message: string }

export class ErrorAplicacion extends Error {
  constructor(
    public readonly estadoHttp: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalles: DetalleError[] = [],
  ) { super(mensaje); this.name = 'ErrorAplicacion'; }
}

export const recursoNoEncontrado = (mensaje = 'No se encontró el recurso.') =>
  new ErrorAplicacion(404, 'NOT_FOUND', mensaje);
