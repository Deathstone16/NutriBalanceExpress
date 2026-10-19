import { baseDatos } from '../../database/cliente.js';

export class AutenticacionRepositorio {
  buscarPorCorreo(correo: string) {
    return baseDatos.usuario.findUnique({
      where: { correo },
      select: { id: true, correo: true, nombreVisible: true, claveHash: true, rol: true },
    });
  }

  buscarPorId(id: string) {
    return baseDatos.usuario.findUnique({
      where: { id },
      select: { id: true, correo: true, nombreVisible: true, rol: true },
    });
  }
}
