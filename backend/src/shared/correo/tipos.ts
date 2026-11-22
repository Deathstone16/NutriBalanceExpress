export interface CorreoSaliente {
  de: string;
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

export interface TransporteCorreo {
  enviar(correo: CorreoSaliente): Promise<void>;
}
