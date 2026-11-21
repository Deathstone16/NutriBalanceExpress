import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { entorno } from '../../config/entorno.js';
import { enviarPorSmtp } from './smtp.js';
import type { CorreoSaliente, TransporteCorreo } from './tipos.js';

/** En pruebas los correos quedan en memoria para poder leer el enlace de confirmación. */
export const correosDePrueba: CorreoSaliente[] = [];

const transporteMemoria: TransporteCorreo = { enviar: async correo => { correosDePrueba.push(correo); } };

/** Desarrollo sin SMTP: guarda cada correo como HTML en .local/correos para abrirlo en el navegador. */
const transporteBandejaLocal: TransporteCorreo = {
  enviar: async correo => {
    const directorio = path.resolve('.local/correos');
    await mkdir(directorio, { recursive: true });
    const archivo = path.join(directorio, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.html`);
    await writeFile(archivo, correo.html, 'utf8');
    await writeFile(archivo.replace(/\.html$/, '.txt'), `Para: ${correo.para}\nAsunto: ${correo.asunto}\n\n${correo.texto}\n`, 'utf8');
    console.log(JSON.stringify({ evento: 'correo_guardado', archivo }));
  },
};

export function crearTransporte(): TransporteCorreo {
  if (entorno.NODE_ENV === 'test') return transporteMemoria;
  const url = entorno.MAIL_SMTP_URL;
  if (url) return { enviar: correo => enviarPorSmtp(url, correo) };
  if (entorno.NODE_ENV === 'production') {
    // No se guardan correos en disco en producción: sin SMTP la solicitud falla con un aviso claro.
    console.warn(JSON.stringify({ evento: 'correo_sin_configurar', detalle: 'Definí MAIL_SMTP_URL para enviar la confirmación de turnos.' }));
    return { enviar: async () => { throw new Error('MAIL_SMTP_URL no está configurado.'); } };
  }
  return transporteBandejaLocal;
}

export const remitente = () => entorno.MAIL_FROM;
