import { randomBytes } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Session } from 'express-session';
import { z } from 'zod';
import { DURACION_SESION_AUTENTICADA_MS, NOMBRE_COOKIE_SESION } from '../../config/sesion.js';
import type { OpcionesCookie } from '../../config/http.js';
import { asegurarTokenCsrf } from './autenticacion.csrf.js';
import { AutenticacionServicio } from './autenticacion.servicio.js';

const esquemaIngreso = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(128),
}).strict();

function guardarSesion(sesion: Session): Promise<void> {
  return new Promise((resolver, rechazar) => sesion.save(error => error ? rechazar(error) : resolver()));
}

function regenerarSesion(sesion: Session): Promise<void> {
  return new Promise((resolver, rechazar) => sesion.regenerate(error => error ? rechazar(error) : resolver()));
}

function destruirSesion(sesion: Session): Promise<void> {
  return new Promise((resolver, rechazar) => sesion.destroy(error => error ? rechazar(error) : resolver()));
}

export class AutenticacionControlador {
  constructor(private readonly servicio: AutenticacionServicio, private readonly opcionesCookie: OpcionesCookie) {}

  obtenerCsrf: RequestHandler = async (peticion, respuesta) => {
    const vencimiento = peticion.session.venceEn ? Date.parse(peticion.session.venceEn) : NaN;
    if (peticion.session.venceEn && (!Number.isFinite(vencimiento) || Date.now() >= vencimiento)) {
      await regenerarSesion(peticion.session);
    }
    const csrfToken = asegurarTokenCsrf(peticion);
    await guardarSesion(peticion.session);
    respuesta.status(200).json({ csrfToken });
  };

  ingresar: RequestHandler = async (peticion, respuesta) => {
    const { email: correo, password: clave } = esquemaIngreso.parse(peticion.body);
    const usuario = await this.servicio.verificarCredenciales(correo, clave);

    await regenerarSesion(peticion.session);
    peticion.session.usuarioId = usuario.id;
    peticion.session.tokenCsrf = randomBytes(32).toString('base64url');
    const vencimiento = new Date(Date.now() + DURACION_SESION_AUTENTICADA_MS);
    peticion.session.venceEn = vencimiento.toISOString();
    peticion.session.cookie.expires = vencimiento;
    await guardarSesion(peticion.session);

    respuesta.status(200).json({
      user: { id: usuario.id, email: usuario.correo, displayName: usuario.nombreVisible, role: usuario.rol },
      csrfToken: peticion.session.tokenCsrf,
      expiresAt: peticion.session.venceEn,
    });
  };

  obtenerSesion: RequestHandler = async (peticion, respuesta) => {
    const usuario = await this.servicio.obtenerUsuario(peticion.session.usuarioId!);
    const faltabaToken = !peticion.session.tokenCsrf;
    const csrfToken = asegurarTokenCsrf(peticion);
    if (faltabaToken) await guardarSesion(peticion.session);
    respuesta.status(200).json({
      user: { id: usuario.id, email: usuario.correo, displayName: usuario.nombreVisible, role: usuario.rol },
      csrfToken,
      expiresAt: peticion.session.venceEn,
    });
  };

  salir: RequestHandler = async (peticion, respuesta) => {
    await destruirSesion(peticion.session);
    respuesta.clearCookie(NOMBRE_COOKIE_SESION, this.opcionesCookie);
    respuesta.sendStatus(204);
  };
}
