import { describe, expect, it } from 'vitest';
import { esquemaEntorno } from '../../src/config/entorno.js';
import { crearConfiguracionHttp } from '../../src/config/http.js';

const valoresLocales = {
  NODE_ENV: 'development', DATABASE_URL: 'postgresql://prueba:prueba@localhost:5433/nutri_test',
  SESSION_SECRET: 's'.repeat(64), APP_ORIGIN: 'http://localhost:5173',
};

describe('configuración HTTP local y detrás de túnel', () => {
  it('conserva el comportamiento de desarrollo local por defecto', () => {
    const configuracion = crearConfiguracionHttp(esquemaEntorno.parse(valoresLocales));
    expect(configuracion.proxyConfiable).toBe(false);
    expect(configuracion.cookie).toMatchObject({ secure: false, sameSite: 'lax', httpOnly: true });
  });
  it('habilita HTTPS y cookies cross-site únicamente mediante opciones explícitas', () => {
    const configuracion = crearConfiguracionHttp(esquemaEntorno.parse({
      ...valoresLocales, TRUST_PROXY: 'loopback', SESSION_COOKIE_SECURE: 'true', SESSION_COOKIE_SAME_SITE: 'none',
    }));
    expect(configuracion.proxyConfiable).toBe('loopback');
    expect(configuracion.cookie).toMatchObject({ secure: true, sameSite: 'none' });
    expect(esquemaEntorno.safeParse({ ...valoresLocales, SESSION_COOKIE_SAME_SITE: 'none', SESSION_COOKIE_SECURE: 'false' }).success).toBe(false);
  });
  it('rechaza cookies inseguras en producción y un origen que contenga una ruta', () => {
    expect(esquemaEntorno.safeParse({ ...valoresLocales, NODE_ENV: 'production', SESSION_COOKIE_SECURE: 'false' }).success).toBe(false);
    expect(esquemaEntorno.safeParse({ ...valoresLocales, APP_ORIGIN: 'https://frontend.example.test/login' }).success).toBe(false);
  });
});

describe('origen público del enlace de confirmación', () => {
  it('es opcional y acepta un origen exacto distinto de APP_ORIGIN', () => {
    expect(esquemaEntorno.parse(valoresLocales).PUBLIC_WEB_ORIGIN).toBeUndefined();
    expect(esquemaEntorno.parse({ ...valoresLocales, PUBLIC_WEB_ORIGIN: '' }).PUBLIC_WEB_ORIGIN).toBeUndefined();
    const datos = esquemaEntorno.parse({ ...valoresLocales, APP_ORIGIN: 'https://api.example.test', PUBLIC_WEB_ORIGIN: 'https://web.example.test' });
    expect(datos.PUBLIC_WEB_ORIGIN).toBe('https://web.example.test');
  });
  it('rechaza rutas o barra final', () => {
    for (const valor of ['https://web.example.test/', 'https://web.example.test/confirmar']) {
      const resultado = esquemaEntorno.safeParse({ ...valoresLocales, PUBLIC_WEB_ORIGIN: valor });
      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues.some(issue => issue.path[0] === 'PUBLIC_WEB_ORIGIN')).toBe(true);
    }
  });
});
