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
