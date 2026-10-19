import { describe, expect, it } from 'vitest';
import { esquemaFecha, esquemaFechaNoFutura } from '../../src/shared/validacion.js';
import { esquemaConsulta } from '../../src/modules/consultas/consultas.esquemas.js';

describe('fechas civiles y mediciones', () => {
  it('rechaza fechas imposibles sin normalizarlas silenciosamente', () => {
    expect(esquemaFecha.safeParse('2026-02-30').success).toBe(false);
    expect(esquemaFecha.safeParse('2024-02-29').success).toBe(true);
    expect(esquemaFechaNoFutura.safeParse('2099-01-01').success).toBe(false);
  });
  it('requiere números de hasta dos decimales y rechaza campos desconocidos', () => {
    const datos = { date: '2020-01-01', reason: 'Prueba', instructions: 'Prueba', weightKg: 72.15 };
    expect(esquemaConsulta.safeParse(datos).success).toBe(true);
    expect(esquemaConsulta.safeParse({ ...datos, weightKg: 72.155 }).success).toBe(false);
    expect(esquemaConsulta.safeParse({ ...datos, weightKg: '72.15' }).success).toBe(false);
    expect(esquemaConsulta.safeParse({ ...datos, patientId: 'extra' }).success).toBe(false);
  });
});
