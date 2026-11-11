/** El frontend existente usa un gateway y conserva su cookie en el mismo origen. */
export const ORIGEN_FRONTEND = 'https://nutribalance-mauricio.maauri.chatgpt.site';
export const ORIGEN_API = 'https://api.neadev.com';

export function crearEntornoTunel(variables: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const origen = variables.TUNNEL_APP_ORIGIN || ORIGEN_FRONTEND;
  const url = new URL(origen);
  if (url.protocol !== 'https:' || url.origin !== origen) {
    throw new Error('TUNNEL_APP_ORIGIN debe ser un origen HTTPS exacto, sin ruta ni barra final.');
  }
  return {
    ...variables,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: variables.PORT || '3000',
    APP_ORIGIN: origen,
    TRUST_PROXY: 'loopback',
    SESSION_COOKIE_SECURE: 'true',
    SESSION_COOKIE_SAME_SITE: 'lax',
  };
}
