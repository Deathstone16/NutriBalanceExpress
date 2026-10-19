import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { ErrorAplicacion } from '../../shared/errors/error-aplicacion.js';
import { AutenticacionRepositorio } from './autenticacion.repositorio.js';

// La verificación contra un resumen real mantiene un costo similar si el correo no existe.
const resumenClaveFicticio = argon2.hash(randomBytes(32), { type: argon2.argon2id });

export class AutenticacionServicio {
  constructor(private readonly repositorio: AutenticacionRepositorio) {}

  async verificarCredenciales(correo: string, clave: string) {
    const usuario = await this.repositorio.buscarPorCorreo(correo);
    const resumenClave = usuario?.claveHash ?? await resumenClaveFicticio;
    let claveValida = false;
    try {
      claveValida = await argon2.verify(resumenClave, clave);
    } catch {
      // Un resumen corrupto tampoco debe filtrar información del usuario.
    }
    if (!usuario || !claveValida) {
      throw new ErrorAplicacion(401, 'INVALID_CREDENTIALS', 'Credenciales incorrectas.');
    }
    return usuario;
  }

  async obtenerUsuario(id: string) {
    const usuario = await this.repositorio.buscarPorId(id);
    if (!usuario) {
      throw new ErrorAplicacion(401, 'UNAUTHENTICATED', 'Iniciá sesión para continuar.');
    }
    return usuario;
  }
}
