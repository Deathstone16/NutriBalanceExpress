import net from 'node:net';
import tls from 'node:tls';
import { randomUUID } from 'node:crypto';
import type { CorreoSaliente } from './tipos.js';

/**
 * Cliente SMTP mínimo (sin dependencias): smtps:// usa TLS directo (465) y smtp:// usa
 * STARTTLS (587). Con credenciales, exige TLS salvo que el servidor sea local.
 */
const TIEMPO_MAXIMO_MS = 15_000;
const sinSaltos = (valor: string) => valor.replace(/[\r\n]+/g, ' ').trim();
const base64 = (valor: string) => Buffer.from(valor, 'utf8').toString('base64');
const palabraCodificada = (valor: string) => /^[\x20-\x7e]*$/.test(valor) ? valor : `=?UTF-8?B?${base64(valor)}?=`;

export function extraerDireccion(valor: string) {
  const entre = /<([^<>\s]+)>/.exec(valor);
  const direccion = sinSaltos(entre ? entre[1]! : valor);
  if (!/^[^\s@<>]+@[^\s@<>]+$/.test(direccion)) throw new Error('Dirección de correo inválida.');
  return direccion;
}

function encabezadoDireccion(valor: string) {
  const entre = /^(.*?)\s*<([^<>]+)>\s*$/.exec(sinSaltos(valor));
  if (!entre || !entre[1]) return sinSaltos(valor);
  return `${palabraCodificada(entre[1].replace(/^"|"$/g, ''))} <${entre[2]}>`;
}

function trozos(valor: string) {
  return (base64(valor).match(/.{1,76}/g) ?? []).join('\r\n');
}

/** Mensaje MIME multipart/alternative (texto + HTML) listo para DATA. */
export function construirMensaje(correo: CorreoSaliente, dominio: string) {
  const limite = `=_nutri_${randomUUID()}`;
  const cabeceras = [
    `From: ${encabezadoDireccion(correo.de)}`,
    `To: ${encabezadoDireccion(correo.para)}`,
    `Subject: ${palabraCodificada(sinSaltos(correo.asunto))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@${dominio}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${limite}"`,
  ];
  const parte = (tipo: string, cuerpo: string) => [
    `--${limite}`, `Content-Type: ${tipo}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', trozos(cuerpo),
  ].join('\r\n');
  return [...cabeceras, '', parte('text/plain', correo.texto), parte('text/html', correo.html), `--${limite}--`, ''].join('\r\n');
}

class Conexion {
  private buffer = '';
  private esperando: { resolver: (respuesta: { codigo: number; texto: string }) => void; rechazar: (error: Error) => void } | null = null;
  private pendientes: { codigo: number; texto: string }[] = [];
  private lineas: string[] = [];
  private error: Error | null = null;
  constructor(public socket: net.Socket | tls.TLSSocket) { this.escuchar(socket); }

  private escuchar(socket: net.Socket) {
    socket.setTimeout(TIEMPO_MAXIMO_MS, () => this.fallar(new Error('El servidor de correo no respondió a tiempo.')));
    socket.on('error', error => this.fallar(error));
    socket.on('close', () => this.fallar(new Error('El servidor de correo cerró la conexión.')));
    socket.on('data', datos => {
      this.buffer += datos.toString('utf8');
      let corte: number;
      while ((corte = this.buffer.indexOf('\r\n')) >= 0) {
        const linea = this.buffer.slice(0, corte);
        this.buffer = this.buffer.slice(corte + 2);
        this.lineas.push(linea);
        if (/^\d{3} /.test(linea) || /^\d{3}$/.test(linea)) {
          this.entregar({ codigo: Number(linea.slice(0, 3)), texto: this.lineas.join('\n') });
          this.lineas = [];
        }
      }
    });
  }
  private entregar(respuesta: { codigo: number; texto: string }) {
    if (this.esperando) { const { resolver } = this.esperando; this.esperando = null; resolver(respuesta); } else this.pendientes.push(respuesta);
  }
  private fallar(error: Error) {
    this.error ??= error;
    if (this.esperando) { const { rechazar } = this.esperando; this.esperando = null; rechazar(error); }
  }
  leer() {
    const lista = this.pendientes.shift();
    if (lista) return Promise.resolve(lista);
    if (this.error) return Promise.reject(this.error);
    return new Promise<{ codigo: number; texto: string }>((resolver, rechazar) => { this.esperando = { resolver, rechazar }; });
  }
  async comando(linea: string, esperados: number[]) {
    this.socket.write(`${linea}\r\n`);
    const respuesta = await this.leer();
    if (!esperados.includes(respuesta.codigo)) throw new Error(`El servidor de correo rechazó el comando (${respuesta.codigo}).`);
    return respuesta;
  }
  reemplazar(socket: net.Socket | tls.TLSSocket) {
    // El socket TCP original queda envuelto por TLS y ya no emite datos propios.
    this.socket = socket; this.buffer = ''; this.lineas = []; this.pendientes = []; this.error = null;
    this.escuchar(socket);
  }
}

const esLocal = (servidor: string) => ['localhost', '127.0.0.1', '::1'].includes(servidor);

export async function enviarPorSmtp(urlSmtp: string, correo: CorreoSaliente) {
  const url = new URL(urlSmtp);
  const directo = url.protocol === 'smtps:';
  const servidor = url.hostname.replace(/^\[|\]$/g, '');
  const puerto = Number(url.port || (directo ? 465 : 587));
  const usuario = decodeURIComponent(url.username), clave = decodeURIComponent(url.password);
  const conectar = () => new Promise<net.Socket | tls.TLSSocket>((resolver, rechazar) => {
    const socket = directo ? tls.connect({ host: servidor, port: puerto, servername: servidor }, () => resolver(socket))
      : net.connect({ host: servidor, port: puerto }, () => resolver(socket));
    socket.once('error', rechazar);
  });
  const conexion = new Conexion(await conectar());
  try {
    const saludo = await conexion.leer();
    if (saludo.codigo !== 220) throw new Error('El servidor de correo no aceptó la conexión.');
    const nombre = 'nutribalance.local';
    let capacidades = (await conexion.comando(`EHLO ${nombre}`, [250])).texto;
    let cifrado = directo;
    if (!directo && /STARTTLS/i.test(capacidades)) {
      await conexion.comando('STARTTLS', [220]);
      const seguro = tls.connect({ socket: conexion.socket as net.Socket, servername: servidor });
      await new Promise<void>((resolver, rechazar) => { seguro.once('secureConnect', resolver); seguro.once('error', rechazar); });
      conexion.reemplazar(seguro);
      capacidades = (await conexion.comando(`EHLO ${nombre}`, [250])).texto;
      cifrado = true;
    }
    if (usuario) {
      if (!cifrado && !esLocal(servidor)) throw new Error('El servidor de correo no ofrece TLS; no se envían credenciales sin cifrar.');
      await conexion.comando(`AUTH PLAIN ${base64(`\0${usuario}\0${clave}`)}`, [235]);
    }
    await conexion.comando(`MAIL FROM:<${extraerDireccion(correo.de)}>`, [250]);
    await conexion.comando(`RCPT TO:<${extraerDireccion(correo.para)}>`, [250, 251]);
    await conexion.comando('DATA', [354]);
    const mensaje = construirMensaje(correo, nombre).replace(/^\./gm, '..');
    conexion.socket.write(`${mensaje}\r\n.\r\n`);
    const fin = await conexion.leer();
    if (fin.codigo !== 250) throw new Error(`El servidor de correo no aceptó el mensaje (${fin.codigo}).`);
    conexion.socket.write('QUIT\r\n');
  } finally {
    conexion.socket.destroy();
  }
}
