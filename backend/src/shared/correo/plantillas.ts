import type { CorreoSaliente } from './tipos.js';

export interface DatosConfirmacionTurno {
  nombre: string;
  fecha: string;      // "lunes 23 de noviembre de 2026"
  hora: string;       // "10:00"
  enlace: string;     // URL absoluta de confirmación
  venceHora: string;  // "12:05"
  venceHoras: number; // validez en horas
}

export const escaparHtml = (valor: string) => valor
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Paleta y tipografía de la landing (home.css): verde bosque, lima, crema, títulos condensados.
const bosque = '#103b2e', lima = '#d7f16d', crema = '#f7f4e8', marco = '#dce7d6', tarjeta = '#fbfae8', linea = '#749b73', texto = '#41614d', arcilla = '#955e44';
const titulos = "'Barlow Condensed','Arial Narrow',Impact,sans-serif";
const cuerpo = "'DM Sans','Segoe UI',Arial,sans-serif";
const serif = "'Source Serif 4',Georgia,'Times New Roman',serif";
const cursiva = "'Instrument Serif',Georgia,'Times New Roman',serif";

export function correoConfirmacionTurno(para: string, de: string, datos: DatosConfirmacionTurno): CorreoSaliente {
  const nombre = escaparHtml(datos.nombre), enlace = escaparHtml(datos.enlace);
  const asunto = 'Confirmá tu turno en NutriBalance';
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${asunto}</title></head>
<body style="margin:0;padding:0;background:${marco};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Un último paso: confirmá tu solicitud de turno antes de las ${escaparHtml(datos.venceHora)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${marco};"><tr><td align="center" style="padding:16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${crema};border-radius:6px;">
  <tr><td style="padding:28px 40px 22px;border-bottom:1px solid #d9dcc6;">
    <span style="font-family:${serif};font-size:32px;line-height:1;color:${bosque};letter-spacing:-0.02em;">nutribalance<span style="color:${arcilla};">.</span></span>
  </td></tr>
  <tr><td style="padding:0 16px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bosque};border-radius:6px;margin-top:16px;"><tr><td style="padding:40px 32px 36px;">
      <div style="font-family:${cuerpo};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${lima};">Atención nutricional</div>
      <h1 style="margin:18px 0 0;font-family:${titulos};font-size:52px;line-height:0.95;font-weight:700;letter-spacing:-0.02em;text-transform:uppercase;color:#fff9e9;">Un último paso <span style="font-family:${cursiva};font-style:italic;font-weight:400;text-transform:none;color:${lima};letter-spacing:-0.04em;">para tu turno.</span></h1>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:32px 40px 8px;font-family:${cuerpo};font-size:16px;line-height:1.6;color:${bosque};">
    <p style="margin:0 0 14px;">Hola ${nombre},</p>
    <p style="margin:0;color:${texto};">Recibimos tu solicitud de turno. Para que quede registrada, confirmala desde este correo.</p>
  </td></tr>
  <tr><td style="padding:20px 40px 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${tarjeta};border:1px solid ${linea};border-radius:17px;"><tr><td style="padding:22px 26px;font-family:${cuerpo};">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${texto};">Tu solicitud</div>
      <div style="margin-top:8px;font-family:${titulos};font-size:30px;line-height:1.05;font-weight:700;text-transform:uppercase;color:${bosque};">${escaparHtml(datos.fecha)}</div>
      <div style="margin-top:4px;font-family:${cursiva};font-style:italic;font-size:30px;line-height:1.1;color:${arcilla};">${escaparHtml(datos.hora)} h · Argentina</div>
      <div style="margin-top:10px;font-size:14px;color:${texto};">Consulta de 30 minutos</div>
    </td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:30px 40px 10px;">
    <a href="${enlace}" style="display:block;padding:18px 24px;background:${lima};border:1px solid ${bosque};border-radius:100px;font-family:${titulos};font-size:24px;line-height:1;font-weight:700;letter-spacing:0.01em;text-transform:uppercase;text-decoration:none;color:${bosque};">Confirmar mi turno</a>
  </td></tr>
  <tr><td style="padding:14px 40px 8px;font-family:${cuerpo};font-size:14px;line-height:1.6;color:${texto};">
    <p style="margin:0 0 12px;"><strong style="color:${bosque};">El enlace vale ${datos.venceHoras} horas</strong> (hasta las ${escaparHtml(datos.venceHora)}). Si no lo confirmás, el horario se libera para otra persona.</p>
    <p style="margin:0;">Una vez confirmado, la solicitud queda pendiente de la aprobación del consultorio.</p>
  </td></tr>
  <tr><td style="padding:22px 40px 34px;font-family:${cuerpo};font-size:12px;line-height:1.6;color:${texto};">
    <div style="border-top:1px solid #d9dcc6;padding-top:18px;">
      Si el botón no funciona, copiá este enlace en tu navegador:<br>
      <a href="${enlace}" style="color:${bosque};word-break:break-all;">${enlace}</a><br><br>
      Si no pediste este turno, ignorá este correo: no se va a reservar nada.
    </div>
  </td></tr>
</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;"><tr><td align="center" style="padding:18px 8px 6px;font-family:${cuerpo};font-size:12px;color:${texto};">NutriBalance · Mauricio Pelozo</td></tr></table>
</td></tr></table>
</body></html>`;
  const textoPlano = [
    `Hola ${datos.nombre},`, '',
    'Recibimos tu solicitud de turno en NutriBalance. Para que quede registrada, confirmala con este enlace:', '',
    datos.enlace, '',
    `Turno solicitado: ${datos.fecha}, ${datos.hora} h (Argentina), consulta de 30 minutos.`,
    `El enlace vale ${datos.venceHoras} horas (hasta las ${datos.venceHora}). Si no lo confirmás, el horario se libera.`,
    'Una vez confirmado, la solicitud queda pendiente de la aprobación del consultorio.', '',
    'Si no pediste este turno, ignorá este correo.', '', 'NutriBalance · Mauricio Pelozo',
  ].join('\n');
  return { de, para, asunto, texto: textoPlano, html };
}
