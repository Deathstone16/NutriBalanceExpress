import { entorno } from '../src/config/entorno.js';
import { enviarPorSmtp, extraerDireccion } from '../src/shared/correo/smtp.js';
import { correoConfirmacionTurno } from '../src/shared/correo/plantillas.js';

// Uso: npm run mail:test -- destino@correo.com
// Envía el correo de confirmación con datos de ejemplo usando MAIL_SMTP_URL, para comprobar
// la cuenta (por ejemplo Gmail con clave de aplicación) sin crear un turno. No imprime la clave.
const destino = process.argv[2];
if (!destino) {
  console.error('Indicá el destinatario: npm run mail:test -- destino@correo.com');
  process.exit(1);
}
if (!entorno.MAIL_SMTP_URL) {
  console.error('Falta MAIL_SMTP_URL en backend/.env (ejemplo: smtps://tucuenta%40gmail.com:CLAVE@smtp.gmail.com:465).');
  process.exit(1);
}
const servidor = new URL(entorno.MAIL_SMTP_URL);
try {
  extraerDireccion(destino);
  await enviarPorSmtp(entorno.MAIL_SMTP_URL, correoConfirmacionTurno(destino, entorno.MAIL_FROM, {
    nombre: 'Ana Ejemplo',
    fecha: 'lunes 23 de noviembre de 2026',
    hora: '10:00',
    enlace: `${entorno.APP_ORIGIN}/confirmar-turno?token=${'x'.repeat(43)}`,
    venceHora: '12:00',
  }));
  console.log(`Correo de prueba enviado a ${destino} por ${servidor.hostname}:${servidor.port || '(puerto por defecto)'}. Revisá la bandeja y la carpeta de spam.`);
} catch (error) {
  console.error(`No se pudo enviar por ${servidor.hostname}: ${error instanceof Error ? error.message : 'error desconocido'}`);
  console.error('Si usás Gmail: la clave debe ser una "clave de aplicación" de 16 letras (sin espacios) y la cuenta necesita verificación en dos pasos.');
  process.exit(1);
}
