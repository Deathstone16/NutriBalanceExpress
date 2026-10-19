import { entorno, type Entorno } from './entorno.js';

export interface OpcionesCookie {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: '/';
}

export interface ConfiguracionHttp {
  origenFrontend: string;
  proxyConfiable: false | 1 | 'loopback';
  cookie: OpcionesCookie;
}

export function crearConfiguracionHttp(datos: Entorno = entorno): ConfiguracionHttp {
  const proxy = datos.TRUST_PROXY ?? (datos.NODE_ENV === 'production' ? 'one' : 'none');
  return {
    origenFrontend: datos.APP_ORIGIN,
    proxyConfiable: proxy === 'loopback' ? 'loopback' : proxy === 'one' ? 1 : false,
    cookie: {
      httpOnly: true,
      secure: datos.SESSION_COOKIE_SECURE ?? datos.NODE_ENV === 'production',
      sameSite: datos.SESSION_COOKIE_SAME_SITE,
      path: '/',
    },
  };
}
