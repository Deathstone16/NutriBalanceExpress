# NutriTurnos API

API para el MVP académico de NutriTurnos, con solicitudes públicas de turnos y panel profesional privado. Requiere Node.js 24 y npm; la API escucha en `http://localhost:3000` y expone el contrato bajo `/api/v1`. El estado de pacientes, turnos, consultas y sesiones se guarda en PostgreSQL. Usar exclusivamente datos ficticios.

## Preparación local

Desde `backend/`, instalá dependencias:

```powershell
npm ci
```

Para usar Docker, `npm run setup:local` crea `.env` si falta, levanta PostgreSQL con Compose, crea `nutri_test`, genera Prisma, aplica migraciones y ejecuta el seed. En este host Docker Compose falla al conectarse al socket, así que el flujo práctico es el modo portable de abajo.

Si Docker no está disponible, prepará primero el entorno y luego iniciá PostgreSQL portable en una terminal:

```powershell
npm run setup:env
npm run db:local
```

Los datos quedan en `backend/.local/postgres`. Dejá ese proceso abierto y, en otra terminal desde `backend/`, prepará las bases, el cliente y el seed:

```powershell
npm run setup:local -- --sin-docker
```

`setup:env` crea `.env` con secretos aleatorios si no existe y conserva uno ya creado. `db:local` crea `nutri_dev` y `nutri_test` y se detiene con Ctrl+C. No compartas `.env`: la contraseña demo se guarda únicamente en `SEED_PROFESSIONAL_PASSWORD` y no debe publicarse. `embedded-postgres` solo se usa para desarrollo; el paquete fija PostgreSQL 17 y sus binarios desde npm.

## Desarrollo y producción

Desarrollo con recarga:

```powershell
npm run dev
```

Comprobación de tipos y compilación de producción:

```powershell
npm run typecheck
npm run build
npm start
```

`build` genera el cliente Prisma y compila TypeScript a `dist/`; `start` ejecuta ese JavaScript. En despliegues, configurá `NODE_ENV=production`, `SESSION_COOKIE_SECURE=true`, secretos y URLs fuera del repositorio, aplicá migraciones con `npm run db:deploy` y ejecutá la aplicación compilada. El seed local no forma parte del arranque de producción. Usar HTTPS mediante un proxy confiable. `HOST=0.0.0.0` solo es necesario si la plataforma recibe tráfico desde otra interfaz; un túnel instalado en la misma máquina usa `127.0.0.1`.

La ruta `GET /health` verifica la conexión a la base. Las pruebas usan exclusivamente `nutri_test`: `npm test` prepara esa base y ejecuta la suite, mientras que `npm run test:unit` ejecuta solo las pruebas unitarias de Vitest. No configures `TEST_DATABASE_URL` contra `nutri_dev` ni una base de producción; la preparación y las pruebas pueden modificar la base de test.

## Sesión y CSRF

La sesión autenticada usa una cookie y persiste en PostgreSQL. Para iniciar sesión desde el navegador, primero obtené el token CSRF:

```js
const baseApi = 'http://localhost:3000/api/v1';
const csrfResponse = await fetch(`${baseApi}/auth/csrf`, { credentials: 'include' });
const { csrfToken } = await csrfResponse.json();

const loginResponse = await fetch(`${baseApi}/auth/login`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
  body: JSON.stringify({ email: 'nutri@example.test', password }),
});
const sesion = await loginResponse.json();
```

Usá `sesion.csrfToken` en las siguientes escrituras privadas, junto con `credentials: 'include'`. El correo de ejemplo es ficticio; la contraseña sembrada está en el `.env` local.

El origen local permitido es `http://localhost:5173` (`APP_ORIGIN`). Usar localhost tanto en frontend como en API y no mezclar con 127.0.0.1. Consultá `loginResponse.ok` antes de tratar el cuerpo como sesión. No almacenar contraseña ni cookie en localStorage. Un POST fallido por red no se reintenta automáticamente: consultá el estado para evitar duplicados.

## Módulos y contrato

Las rutas y el contrato HTTP usan campos en inglés. El código interno usa nombres en español para que el modelo Prisma y las reglas de negocio sean claros. El módulo de pacientes separa rutas, controlador, servicio, repositorio, esquemas y presentador; los demás módulos mantienen las capas y composición que requiere su flujo.

El contrato vigente está en [`../docs/api/contrato-api-frontend.md`](../docs/api/contrato-api-frontend.md). Las decisiones y el árbol actual están en [`../docs/desarrollo-api.md`](../docs/desarrollo-api.md).

## Preparado para Cloudflare Tunnel

El proyecto no crea túneles, no instala cloudflared y no requiere credenciales de Cloudflare. Cuando configures tu túnel, su servicio de origen será **`http://127.0.0.1:3000`** (sin `/api/v1` en esa URL). La API pública conservará `/api/v1` y `/health`.

Para cloudflared ejecutándose en esta misma máquina, ajustar estas variables en `.env` y reiniciar la API:

```dotenv
HOST=127.0.0.1
PORT=3000
TRUST_PROXY=loopback
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=lax
APP_ORIGIN=https://frontend.example.com
```

Reemplazar `APP_ORIGIN` por el origen EXACTO del frontend, con protocolo, sin ruta ni barra final. No es la URL de la API. Si el frontend sigue en localhost:5173, ese es su origen. CORS mantiene credenciales y un único origen explícito; no usa comodines.

`TRUST_PROXY=loopback` permite reconocer el HTTPS reenviado por cloudflared cuando conecta por localhost. No desactiva la autenticación ni el CSRF. El backend puede seguir corriendo en modo development con recarga; Secure depende de su propia variable y no del modo Node. El logout elimina la cookie con los mismos atributos que al crearla.

**Frontend y API en sitios distintos:** cambiar `SESSION_COOKIE_SAME_SITE=none` y conservar `SESSION_COOKIE_SECURE=true`; el cliente sigue usando `credentials: 'include'`. Ejemplo: frontend local que llama a una API en un hostname de túnel. Algunos navegadores bloquean cookies de terceros incluso con estas opciones; para una integración confiable, servir frontend y API bajo el mismo sitio o usar un proxy del frontend para `/api`. Dos URLs temporales de túnel no garantizan que el navegador las considere del mismo sitio.

**Desarrollo local sin túnel:** `TRUST_PROXY=none`, `SESSION_COOKIE_SECURE=false`, `SESSION_COOKIE_SAME_SITE=lax`, `APP_ORIGIN=http://localhost:5173`. Una cookie Secure no se emite mediante HTTP local; para probar ese perfil hay que entrar por la URL HTTPS del túnel.

Si cloudflared corre dentro de otro contenedor/máquina, loopback ya no identifica al proxy. En ese caso adaptar la red de origen y la confianza del proxy a esa topología; no cambiar a confianza total para resolverlo. Las opciones disponibles son none, loopback y one (un único salto, solo con acceso al backend restringido al proxy).

La base de datos permanece privada en localhost:5433. El túnel apunta al puerto HTTP de la API, nunca al puerto de PostgreSQL. Esta preparación no publica el sistema ni cambia el `.env` local existente.

## Verificaciones realizadas

El 19/10/2026 pasaron typecheck, build y 27 pruebas (22 de integración con PostgreSQL real y 5 unitarias). Incluyen CSRF, vencimiento absoluto, doble reserva concurrente, transiciones, rollback de consulta/turno y perfil HTTPS detrás de proxy local con cookies Secure y CORS. La auditoría de dependencias de producción realizada durante la implementación no reportó vulnerabilidades conocidas. El servidor compilado también se verificó por HTTP real (health, login, pacientes y logout). No se creó un túnel ni se probó deploy público o el frontend externo.
