import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { construirMensaje, enviarPorSmtp, extraerDireccion } from '../../src/shared/correo/smtp.js';
import { correoConfirmacionTurno, escaparHtml } from '../../src/shared/correo/plantillas.js';

const correo = {
  de: 'NutriBalance <no-reply@nutribalance.test>', para: 'ana@example.test',
  asunto: 'Confirmá tu turno\r\nBcc: intruso@example.test', texto: 'Hola\n.punto inicial\nChau', html: '<p>Hola ñandú</p>',
};

/** Servidor SMTP de pruebas: registra lo que recibe y responde como uno real. */
function servidorSmtp(rechazarRcpt = false) {
  const recibido: string[] = [];
  let datos = '';
  const servidor = net.createServer(socket => {
    let enDatos = false;
    socket.on('error', () => {}); // el cliente puede cortar la conexión tras un rechazo
    socket.write('220 prueba ESMTP\r\n');
    socket.on('data', trozo => {
      const texto = trozo.toString('utf8');
      if (enDatos) {
        datos += texto;
        if (datos.endsWith('\r\n.\r\n')) { enDatos = false; recibido.push(`DATA:${datos}`); socket.write('250 aceptado\r\n'); }
        return;
      }
      for (const linea of texto.split('\r\n').filter(Boolean)) {
        recibido.push(linea);
        if (linea.startsWith('EHLO')) socket.write('250-prueba\r\n250 AUTH PLAIN\r\n');
        else if (linea.startsWith('AUTH')) socket.write('235 ok\r\n');
        else if (linea.startsWith('MAIL')) socket.write('250 ok\r\n');
        else if (linea.startsWith('RCPT')) socket.write(rechazarRcpt ? '550 no existe\r\n' : '250 ok\r\n');
        else if (linea === 'DATA') { enDatos = true; datos = ''; socket.write('354 adelante\r\n'); }
        else if (linea === 'QUIT') socket.end('221 chau\r\n');
      }
    });
  });
  return new Promise<{ url: string; recibido: string[]; cerrar: () => void }>(resolver => {
    servidor.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address() as net.AddressInfo;
      resolver({ url: `smtp://usuario:cl%40ve@127.0.0.1:${port}`, recibido, cerrar: () => servidor.close() });
    });
  });
}

describe('correo saliente', () => {
  let cerrar = () => {};
  afterEach(() => cerrar());

  it('entrega el mensaje por SMTP con autenticación y sin permitir inyección de encabezados', async () => {
    const servidor = await servidorSmtp();
    cerrar = servidor.cerrar;
    await enviarPorSmtp(servidor.url, correo);
    expect(servidor.recibido).toContain(`AUTH PLAIN ${Buffer.from('\0usuario\0cl@ve').toString('base64')}`);
    expect(servidor.recibido).toContain('MAIL FROM:<no-reply@nutribalance.test>');
    expect(servidor.recibido).toContain('RCPT TO:<ana@example.test>');
    const mensaje = servidor.recibido.find(linea => linea.startsWith('DATA:'))!;
    expect(mensaje).toContain('Content-Type: multipart/alternative');
    expect(mensaje).not.toMatch(/^Bcc:/m);
    const textoBase64 = /text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/.exec(mensaje)![1]!;
    expect(Buffer.from(textoBase64.replace(/\r\n/g, ''), 'base64').toString('utf8')).toBe(correo.texto);
  });

  it('informa cuando el servidor rechaza al destinatario', async () => {
    const servidor = await servidorSmtp(true);
    cerrar = servidor.cerrar;
    await expect(enviarPorSmtp(servidor.url, correo)).rejects.toThrow(/550/);
  });

  it('codifica asuntos con tildes y valida direcciones', () => {
    const mensaje = construirMensaje({ ...correo, asunto: 'Confirmá tu turno' }, 'nutribalance.test');
    expect(mensaje).toMatch(/^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/m);
    expect(extraerDireccion('NutriBalance <no-reply@nutribalance.test>')).toBe('no-reply@nutribalance.test');
    expect(() => extraerDireccion('no es un correo')).toThrow();
  });
});

describe('plantilla de confirmación de turno', () => {
  const datos = { nombre: 'Ana <script>alert(1)</script>', fecha: 'lunes 23 de noviembre de 2026', hora: '10:00', enlace: 'https://nutri.test/confirmar-turno?token=abc"onmouseover="x', venceHora: '12:00', venceHoras: 2 };

  it('escapa los datos de la persona y usa la paleta de la landing', () => {
    const resultado = correoConfirmacionTurno('ana@example.test', 'NutriBalance <no-reply@nutribalance.test>', datos);
    expect(resultado.html).not.toContain('<script>');
    expect(resultado.html).toContain('Ana &lt;script&gt;');
    expect(resultado.html).not.toContain('token=abc"onmouseover');
    expect(resultado.html).toContain('#103b2e');
    expect(resultado.html).toContain('#d7f16d');
    expect(resultado.html).toContain('Confirmar mi turno');
    expect(resultado.texto).toContain('lunes 23 de noviembre de 2026, 10:00 h');
  });

  it('escapa los caracteres especiales de HTML', () => {
    expect(escaparHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
});
