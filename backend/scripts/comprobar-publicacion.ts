import { DateTime } from 'luxon';
import { ORIGEN_API, ORIGEN_FRONTEND } from './perfil-tunel.js';

// Solo lecturas: no crea turnos, no inicia sesión y nunca imprime cookies/tokens.
const fecha = DateTime.now().setZone('America/Argentina/Buenos_Aires').plus({ days: 1 }).toISODate()!;
type Resultado = { status?: unknown; date?: unknown; slots?: unknown; error?: { code?: unknown }; csrfToken?: unknown };
const controles = [
  { url: `${ORIGEN_API}/health`, estado: 200, validar: (valor: Resultado) => valor.status === 'ok' },
  { url: `${ORIGEN_API}/api/v1/availability?date=${fecha}`, estado: 200, validar: (valor: Resultado) => valor.date === fecha && Array.isArray(valor.slots) },
  { url: `${ORIGEN_API}/api/v1/patients`, estado: 401, validar: (valor: Resultado) => valor.error?.code === 'UNAUTHENTICATED' },
  { url: `${ORIGEN_FRONTEND}/api/v1/auth/csrf`, estado: 200, validar: (valor: Resultado) => typeof valor.csrfToken === 'string' && valor.csrfToken.length > 20 },
  { url: `${ORIGEN_FRONTEND}/api/v1/availability?date=${fecha}`, estado: 200, validar: (valor: Resultado) => valor.date === fecha && Array.isArray(valor.slots) },
];
let fallos = 0;
for (const control of controles) {
  try {
    const respuesta = await fetch(control.url, { redirect: 'manual', signal: AbortSignal.timeout(20_000), headers: { Accept: 'application/json', Origin: ORIGEN_FRONTEND } });
    const correcto = respuesta.status === control.estado && respuesta.headers.get('content-type')?.includes('application/json') && control.validar(await respuesta.json() as Resultado);
    console.log(`${correcto ? 'OK' : 'FALLO'} ${respuesta.status} ${control.url}`);
    if (!correcto) fallos++;
  } catch { console.log(`FALLO de conexión ${control.url}`); fallos++; }
}
process.exitCode = fallos ? 1 : 0;
