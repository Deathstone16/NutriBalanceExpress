import { describe, it, expect } from 'vitest';
import { crearEntornoTunel, ORIGEN_FRONTEND } from '../../scripts/perfil-tunel.js';
import { esquemaEntorno } from '../../src/config/entorno.js';
import { crearConfiguracionHttp } from '../../src/config/http.js';

describe('perfil compatible con el gateway del frontend actual', () => {
  it('activa el origen correcto, HTTPS y confianza exclusiva en el proxy local sin perder secretos', () => {
    const original = {
      DATABASE_URL: 'postgresql://prueba:prueba@localhost:5433/nutri_test', SESSION_SECRET: 's'.repeat(64),
      APP_ORIGIN: 'http://localhost:5173', SESSION_COOKIE_SECURE: 'false', TRUST_PROXY: 'none',
    };
    const entorno = crearEntornoTunel(original);
    expect(original.SESSION_COOKIE_SECURE).toBe('false');
    expect(entorno.DATABASE_URL).toBe(original.DATABASE_URL);
    expect(entorno.SESSION_SECRET).toBe(original.SESSION_SECRET);
    expect(entorno.APP_ORIGIN).toBe(ORIGEN_FRONTEND);
    const http = crearConfiguracionHttp(esquemaEntorno.parse(entorno));
    expect(http.proxyConfiable).toBe('loopback');
    expect(http.cookie).toMatchObject({ secure: true, sameSite: 'lax', httpOnly: true });
    expect(entorno.HOST).toBe('127.0.0.1');
  });
  it('rechaza un origen inseguro o con ruta y conserva un puerto configurado', () => {
    expect(() => crearEntornoTunel({ TUNNEL_APP_ORIGIN: 'http://example.test' })).toThrow();
    expect(() => crearEntornoTunel({ TUNNEL_APP_ORIGIN: 'https://example.test/login' })).toThrow();
    expect(crearEntornoTunel({ PORT: '3001' }).PORT).toBe('3001');
  });
});
